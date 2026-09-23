import { overlaps } from '../core/math';
import type { Destination } from '../data/destinations';
import {
  GROUND_Y,
  PHYSICS,
  PIXELS_PER_METRE,
  PLAYER_SIZE,
  POWER,
  POWER_TUNING,
  TOKEN_REACH,
} from './constants';
import { Level } from './Level';
import { Player } from './Player';
import { POWER_FOR_STRENGTH } from './powers';
import type { PowerKind } from './powers';

export type SimEvent =
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'token'; x: number; y: number }
  | { type: 'crash'; reason: 'obstacle' | 'pit' }
  | { type: 'goal' }
  | { type: 'power'; kind: PowerKind }
  | { type: 'powerEnd'; kind: PowerKind }
  | { type: 'noCharge' }
  | { type: 'smash'; x: number; y: number }
  | { type: 'grow'; from: number; to: number };

export type RunPhase = 'run' | 'crashed' | 'finished';

export interface RunSimOptions {
  /**
   * Testien ajoitusvara: laajentaa esteitä ja kuoppia vaakasuunnassa. Jos
   * rata on läpäistävissä laajennetuilla vaaroilla, jokaisella hypyllä on
   * vähintään tämän verran pelivaraa kumpaankin suuntaan.
   */
  hazardMargin?: number;
}

type DestinationInput = Pick<Destination, 'id' | 'goalDistance' | 'obstacleDensity' | 'strength'>;

/**
 * Yhden juoksun koko pelilogiikka ilman piirtoa: fysiikka, esteet, kuutiot,
 * supervoimat ja maali. PlayState piirtää tämän tilan ja välittää syötteen.
 */
export class RunSim {
  readonly level: Level;
  readonly player = new Player();
  readonly power: PowerKind;
  phase: RunPhase = 'run';
  charges: number = POWER.startCharges;
  tokensTaken = 0;
  jumps = 0;
  powersUsed = 0;
  activePower: PowerKind | null = null;
  powerTimer = 0;
  /** Kulunut todellinen aika sekunteina. */
  time = 0;
  private pending: ('jump' | 'power')[] = [];
  private readonly margin: number;

  constructor(destination: DestinationInput, options: RunSimOptions = {}) {
    this.level = new Level(destination);
    this.power = POWER_FOR_STRENGTH[destination.strength];
    this.margin = options.hazardMargin ?? 0;
  }

  press(action: 'jump' | 'power'): void {
    this.pending.push(action);
  }

  /** Hidastus hidastaa koko maailmaa, myös painovoimaa. */
  get timeScale(): number {
    return this.activePower === 'slowmo' ? POWER_TUNING.slowmo.timeScale : 1;
  }

  get shielded(): boolean {
    return this.activePower === 'shield';
  }

  /** Esteet eivät satuta suojan, lennon tai lennon jälkeisen laskeutumisen aikana. */
  get invulnerable(): boolean {
    return this.shielded || this.player.mode === 'rocket' || this.player.safeUntilLanding;
  }

  get distanceMetres(): number {
    return Math.round(Math.min(this.player.worldX, this.level.goalX) / PIXELS_PER_METRE);
  }

  get progress(): number {
    return Math.min(1, this.player.worldX / this.level.goalX);
  }

  step(realDt: number): SimEvent[] {
    const events: SimEvent[] = [];
    this.time += realDt;

    if (this.phase !== 'run') {
      this.pending.length = 0;
      if (this.phase === 'crashed') {
        this.player.step(realDt, this.level.isOverPit(this.player.worldX), false);
      } else {
        this.player.step(realDt, false, true);
      }
      return events;
    }

    for (const action of this.pending) {
      if (action === 'jump') {
        if (this.player.mode !== 'rocket') this.player.requestJump();
      } else {
        this.activatePower(events);
      }
    }
    this.pending.length = 0;

    if (this.activePower) {
      this.powerTimer -= realDt;
      if (this.powerTimer <= 0) this.tryEndPower(events);
    }

    const dt = realDt * this.timeScale;
    const overPit = !this.shielded && this.level.isOverPit(this.player.worldX, this.margin);
    const moved = this.player.step(dt, overPit, true);
    if (moved === 'jump') {
      this.jumps += 1;
      events.push({ type: 'jump' });
    } else if (moved === 'land') {
      events.push({ type: 'land' });
    }

    this.collectTokens(events);
    this.checkHazards(events);

    if (this.phase === 'run' && this.player.worldX >= this.level.goalX) {
      this.phase = 'finished';
      if (this.activePower) this.activePower = null;
      events.push({ type: 'goal' });
    }
    return events;
  }

  private activatePower(events: SimEvent[]): void {
    if (this.activePower || this.player.mode === 'hurt') return;
    if (this.charges <= 0) {
      events.push({ type: 'noCharge' });
      return;
    }
    this.charges -= 1;
    this.powersUsed += 1;
    events.push({ type: 'power', kind: this.power });

    switch (this.power) {
      case 'shield':
        this.activePower = 'shield';
        this.powerTimer = POWER_TUNING.shield.duration;
        break;
      case 'rocket':
        this.activePower = 'rocket';
        this.powerTimer = POWER_TUNING.rocket.duration;
        this.player.startRocket(POWER_TUNING.rocket.altitude);
        break;
      case 'slowmo':
        this.activePower = 'slowmo';
        this.powerTimer = POWER_TUNING.slowmo.duration;
        break;
      case 'grow': {
        // Kertavaikutus: edessä olevat esteet muuttuvat pensaiksi ja kuopat
        // kasvavat umpeen.
        const from = this.player.worldX - PLAYER_SIZE.w;
        const to = this.player.worldX + POWER_TUNING.grow.range;
        for (const o of this.level.obstacles) {
          if (o.x + o.w >= from && o.x <= to) o.grown = true;
        }
        for (const pit of this.level.pits) {
          if (pit.x + pit.w >= from && pit.x <= to) pit.bridged = true;
        }
        events.push({ type: 'grow', from, to });
        break;
      }
    }
  }

  /**
   * Voima päättyy vasta, kun lopettaminen on turvallista: raketti ei pudota
   * pelaajaa esteen tai kuopan päälle, eikä suoja lopu kuopan kohdalla.
   */
  private tryEndPower(events: SimEvent[]): void {
    const kind = this.activePower;
    if (!kind) return;
    if (kind === 'rocket' && !this.landingZoneClear()) {
      this.powerTimer = 0.05;
      return;
    }
    if (kind === 'shield' && this.level.isOverPit(this.player.worldX)) {
      this.powerTimer = 0.05;
      return;
    }
    if (kind === 'rocket') this.player.endRocket();
    this.activePower = null;
    this.powerTimer = 0;
    events.push({ type: 'powerEnd', kind });
  }

  private landingZoneClear(): boolean {
    const p = this.player;
    const height = GROUND_Y - p.y;
    const fallTime = Math.sqrt((2 * Math.max(0, height)) / PHYSICS.gravity);
    const landX = p.worldX + p.speed * fallTime;
    // Laskeutumispaikan ympärille jää tilaa reagoida seuraavaan esteeseen.
    const zoneStart = landX - PLAYER_SIZE.w;
    const zoneEnd = landX + p.speed * 0.45;
    for (const o of this.level.obstacles) {
      if (o.hit || o.grown) continue;
      if (o.x < zoneEnd && o.x + o.w > zoneStart) return false;
    }
    for (const pit of this.level.pits) {
      if (pit.bridged) continue;
      if (pit.x < zoneEnd && pit.x + pit.w > zoneStart) return false;
    }
    return true;
  }

  private collectTokens(events: SimEvent[]): void {
    const cy = this.player.y - PLAYER_SIZE.h / 2;
    for (const token of this.level.tokens) {
      if (token.taken) continue;
      if (Math.abs(token.x - this.player.worldX) > TOKEN_REACH.x) continue;
      if (Math.abs(token.y - cy) > TOKEN_REACH.y) continue;
      token.taken = true;
      this.tokensTaken += 1;
      this.charges = Math.min(POWER.maxCharges, this.charges + 1);
      events.push({ type: 'token', x: token.x, y: token.y });
    }
  }

  private checkHazards(events: SimEvent[]): void {
    const p = this.player;
    if (p.y > GROUND_Y + 60) {
      this.crash(events, 'pit');
      return;
    }
    const box = p.hitbox;
    for (const o of this.level.obstacles) {
      if (o.hit || o.grown) continue;
      if (o.x + o.w < p.worldX - 300) continue;
      if (o.x > p.worldX + 300) break;
      const rect = this.level.obstacleRect(o, this.margin);
      if (!overlaps(box, rect)) continue;
      if (this.shielded) {
        o.hit = true;
        events.push({ type: 'smash', x: o.x + o.w / 2, y: GROUND_Y - o.h / 2 });
      } else if (!this.invulnerable) {
        this.crash(events, 'obstacle');
        return;
      }
    }
  }

  private crash(events: SimEvent[], reason: 'obstacle' | 'pit'): void {
    this.phase = 'crashed';
    this.activePower = null;
    this.player.crash();
    events.push({ type: 'crash', reason });
  }

  /** Tilan kopio hakualgoritmeja varten (testit). */
  snapshot(): RunSnapshot {
    return {
      player: { ...this.player },
      phase: this.phase,
      charges: this.charges,
      tokensTaken: this.tokensTaken,
      jumps: this.jumps,
      powersUsed: this.powersUsed,
      activePower: this.activePower,
      powerTimer: this.powerTimer,
      time: this.time,
      obstacles: this.level.obstacles.map((o) => [o.hit, o.grown] as const),
      pits: this.level.pits.map((p) => p.bridged),
      tokens: this.level.tokens.map((t) => t.taken),
    };
  }

  restore(s: RunSnapshot): void {
    Object.assign(this.player, s.player);
    this.phase = s.phase;
    this.charges = s.charges;
    this.tokensTaken = s.tokensTaken;
    this.jumps = s.jumps;
    this.powersUsed = s.powersUsed;
    this.activePower = s.activePower;
    this.powerTimer = s.powerTimer;
    this.time = s.time;
    this.pending.length = 0;
    s.obstacles.forEach(([hit, grown], i) => {
      const o = this.level.obstacles[i]!;
      o.hit = hit;
      o.grown = grown;
    });
    s.pits.forEach((b, i) => (this.level.pits[i]!.bridged = b));
    s.tokens.forEach((t, i) => (this.level.tokens[i]!.taken = t));
  }
}

export interface RunSnapshot {
  player: Record<string, unknown>;
  phase: RunPhase;
  charges: number;
  tokensTaken: number;
  jumps: number;
  powersUsed: number;
  activePower: PowerKind | null;
  powerTimer: number;
  time: number;
  obstacles: (readonly [boolean, boolean])[];
  pits: boolean[];
  tokens: boolean[];
}
