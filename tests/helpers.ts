import content from '../src/assets/data/destinations.json';
import type { Destination } from '../src/data/destinations';
import { RunSim } from '../src/game/RunSim';
import type { RunPhase, RunSnapshot } from '../src/game/RunSim';

export const DT = 1 / 60;
export const destinations = content.destinations as unknown as Destination[];

/** step() muuttaa tilaa, jota TypeScript ei näe: luetaan vaihe funktion kautta. */
const phaseOf = (sim: RunSim): RunPhase => sim.phase;

export interface SolveOptions {
  /**
   * Ajoitusvara ruutuina (60 Hz). Hyppy hyväksytään vain, jos painallus millä
   * tahansa 2k+1 peräkkäisellä ruudulla johtaa voittoon. k = 4 tarkoittaa
   * 150 ms ikkunaa, k = 2 tarkoittaa 83 ms.
   */
  window: number;
  /** Rengaspainallusten ajoitusvara ruutuina. */
  orbWindow?: number;
  /** Voittoon vaaditaan kaikki oppimiskokonaisuudet (bonusreitti). */
  requireModules?: boolean;
  /** Pakotettu kenttäpalojen järjestys (yksittäisten palojen testit). */
  chunks?: string[];
}

/**
 * Hakee voittavan strategian muistiin tallentavalla syvyyshaulla. Tila on
 * ruutu, korkeus ja pystynopeus: koska nopeus on vakio, vaakasijainti
 * määräytyy ajasta. Haku käyttää oikeaa RunSim-simulaatiota, joten se testaa
 * samaa koodia, jota peli ajaa.
 */
export class Solver {
  readonly sim: RunSim;
  private memoGround = new Map<string, boolean>();
  private memoAir = new Map<string, boolean>();
  private readonly k: number;
  private readonly kOrb: number;
  private readonly requireModules: boolean;
  private readonly moduleTotal: number;
  steps = 0;

  constructor(destination: Destination, options: SolveOptions) {
    this.sim = new RunSim(destination, options.chunks);
    this.k = options.window;
    this.kOrb = options.orbWindow ?? Math.min(2, options.window);
    this.requireModules = options.requireModules ?? false;
    this.moduleTotal = this.sim.level.moduleTotal;
  }

  private initial!: RunSnapshot;

  solve(): boolean {
    this.initial = this.sim.snapshot();
    return this.winGround(this.initial);
  }

  private key(): string {
    const s = this.sim;
    const p = s.player;
    return [
      Math.round(s.time / DT),
      Math.round(p.y),
      Math.round(p.vy / 20),
      p.onGround ? 1 : 0,
      p.buffer > 0 ? 1 : 0,
      p.coyote > 0 ? 1 : 0,
      s.touchingOrb ? 1 : 0,
      this.requireModules ? s.modules : 0,
    ].join('|');
  }

  private tick(): void {
    this.sim.step(DT);
    this.steps += 1;
  }

  private won(): boolean {
    return !this.requireModules || this.sim.modules >= this.moduleTotal;
  }

  /** Pelaaja on maassa. Kerätään maassaolon ruudut ja kokeillaan hyppyä kustakin. */
  private winGround(start: RunSnapshot): boolean {
    this.sim.restore(start);
    const key = this.key();
    const cached = this.memoGround.get(key);
    if (cached !== undefined) return cached;
    this.memoGround.set(key, false);

    const segment: RunSnapshot[] = [];
    let airborne: RunSnapshot | null = null;
    let finished = false;
    for (let f = 0; f < 2000; f++) {
      segment.push(this.sim.snapshot());
      this.tick();
      if (phaseOf(this.sim) === 'finished') {
        finished = this.won();
        break;
      }
      if (phaseOf(this.sim) !== 'run') break;
      if (!this.sim.player.onGround) {
        // Pudotus reunalta tai pomppulevy: jatko ratkeaa ilmassa.
        airborne = this.sim.snapshot();
        break;
      }
    }

    let result = finished;
    for (let t = 0; !result && t < segment.length; t++) result = this.robustJump(segment, t);
    if (!result && airborne) result = this.winAir(airborne);
    this.memoGround.set(key, result);
    return result;
  }

  /** Hyppy ruudulla t kelpaa, jos myös k seuraavaa ruutua kummallekin puolelle toimii. */
  private robustJump(segment: RunSnapshot[], t: number): boolean {
    const width = 2 * this.k + 1;
    if (t + width > segment.length) return false;
    for (let j = 0; j < width; j++) {
      this.sim.restore(segment[t + j]!);
      this.sim.press('jump');
      this.tick();
      if (!this.continueFrom()) return false;
    }
    return true;
  }

  private continueFrom(): boolean {
    const phase = phaseOf(this.sim);
    if (phase === 'finished') return this.won();
    if (phase !== 'run') return false;
    const snap = this.sim.snapshot();
    return this.sim.player.onGround ? this.winGround(snap) : this.winAir(snap);
  }

  /** Pelaaja on ilmassa. Ainoa valinta on painaa renkaan kohdalla. */
  private winAir(start: RunSnapshot): boolean {
    this.sim.restore(start);
    const key = this.key();
    const cached = this.memoAir.get(key);
    if (cached !== undefined) return cached;
    this.memoAir.set(key, false);

    let current = start;
    let result = false;
    for (let f = 0; f < 600; f++) {
      this.sim.restore(current);
      if (this.sim.touchingOrb && this.robustOrb(current)) {
        result = true;
        break;
      }
      this.sim.restore(current);
      this.tick();
      const phase = phaseOf(this.sim);
      if (phase === 'finished') {
        result = this.won();
        break;
      }
      if (phase !== 'run') break;
      if (this.sim.player.onGround) {
        result = this.winGround(this.sim.snapshot());
        break;
      }
      current = this.sim.snapshot();
    }
    this.memoAir.set(key, result);
    return result;
  }

  plan(): number[] {
    const presses: number[] = [];
    const sim = this.sim;
    let state = this.initial;
    for (let guard = 0; guard < 400; guard++) {
      sim.restore(state);
      if (phaseOf(sim) === 'finished') return presses;
      if (sim.player.onGround) {
        const segment: RunSnapshot[] = [];
        let next: RunSnapshot | null = null;
        for (let f = 0; f < 2000; f++) {
          segment.push(sim.snapshot());
          this.tick();
          if (phaseOf(sim) !== 'run' || !sim.player.onGround) break;
        }
        const t = segment.findIndex((_, i) => this.robustJump(segment, i));
        if (t >= 0) {
          sim.restore(segment[t + this.k]!);
          presses.push(sim.time);
          sim.press('jump');
          this.tick();
          next = sim.snapshot();
        } else {
          // Ei hyppyä: juostaan segmentin loppuun (maali tai pudotus reunalta).
          sim.restore(segment[segment.length - 1]!);
          this.tick();
          next = sim.snapshot();
        }
        state = next;
      } else {
        let current = state;
        for (let f = 0; f < 600; f++) {
          sim.restore(current);
          if (sim.touchingOrb && this.robustOrb(current)) {
            sim.restore(current);
            for (let w = 0; w < this.kOrb; w++) this.tick();
            presses.push(sim.time);
            sim.press('jump');
          } else {
            sim.restore(current);
          }
          this.tick();
          current = sim.snapshot();
          if (phaseOf(sim) !== 'run' || sim.player.onGround) break;
        }
        state = current;
      }
      if (phaseOf(sim) === 'crashed') throw new Error('Suunnitelma kaatui: muistin ja purun ero');
    }
    return presses;
  }

  private robustOrb(start: RunSnapshot): boolean {
    const width = 2 * this.kOrb + 1;
    for (let j = 0; j < width; j++) {
      this.sim.restore(start);
      for (let w = 0; w < j; w++) {
        this.tick();
        if (phaseOf(this.sim) !== 'run' || this.sim.player.onGround) return false;
      }
      this.sim.press('jump');
      this.tick();
      if (!this.continueFrom()) return false;
    }
    return true;
  }
}

/**
 * Purkaa voittavan strategian painallusajoiksi (sekunteina juoksun alusta).
 * Kutsu solve() ensin: purku käyttää sen muistia. Painallus valitaan
 * ajoitusikkunan keskeltä, jolloin suunnitelma sietää ajoitusvirhettä
 * kumpaankin suuntaan.
 */
export function extractPlan(solver: Solver): number[] {
  return (solver as unknown as { plan(): number[] }).plan();
}

export function solve(destination: Destination, options: SolveOptions): boolean {
  return new Solver(destination, options).solve();
}
