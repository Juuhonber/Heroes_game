import { Rng } from '../core/math';
import type { Rect } from '../core/math';
import { BLOCK, GROUND_Y, ORB_RADIUS, PIT_EDGE_GRACE, PIXELS_PER_METRE, SPIKE_HITBOX } from './constants';
import { CHUNKS } from './chunks';
import type { Chunk, SignKind } from './chunks';
import type { Destination } from '../data/destinations';

/** Kiinteä palikka. Koordinaatit ovat ruudun pikseleitä: top on yläpinta. */
export interface Block {
  x: number;
  top: number;
  w: number;
  h: number;
  /** Suojavoima murskasi palikan. */
  hit: boolean;
}

export interface Spike {
  x: number;
  /**
   * Pinnan y, johon piikki on kiinni: maa tai palikan yläpinta, kattopiikillä
   * palikan alapinta.
   */
  base: number;
  /** Kattopiikki: kärki osoittaa alas. */
  down: boolean;
  hit: boolean;
  /** Kasvuvoima muutti piikin vaarattomaksi kasviksi. */
  grown: boolean;
}

export interface Pit {
  x: number;
  w: number;
  bridged: boolean;
}

/** Pomppulevy: kosketus lennättää normaalia korkeammalle. */
export interface Pad {
  x: number;
  surface: number;
}

/** Hyppyrengas: ilmassa painettu hyppy lähtee renkaan kohdalta uudelleen. */
export interface Orb {
  x: number;
  y: number;
  used: boolean;
}

export interface Pickup {
  x: number;
  y: number;
  kind: 'credit' | 'module';
  taken: boolean;
}

/** Ohjekyltti ensimmäisen pomppulevyn, renkaan tai reittivalinnan kohdalla. */
export interface Sign {
  x: number;
  y: number;
  kind: SignKind;
}

/** Nopeusportti: portista eteenpäin juoksunopeus on perusnopeus × factor. */
export interface SpeedGate {
  x: number;
  factor: number;
}

/** Nostetuulivyöhyke: painovoima on pienempi. */
export interface GravZone {
  x: number;
  w: number;
}

type LevelInput = Pick<Destination, 'id' | 'goalDistance'> & Partial<Pick<Destination, 'level'>>;

/**
 * Rata kootaan kenttäpaloista kohteen id:stä johdetulla siemenellä, joten
 * sama kohde tuottaa aina saman radan ja uusi yritys on reilu. Jokaisella
 * radalla on ainakin yksi korkea hyppy ja täsmälleen yksi reittivalinta,
 * jonka ylemmällä reitillä on oppimiskokonaisuus.
 */
export class Level {
  readonly blocks: Block[] = [];
  readonly spikes: Spike[] = [];
  readonly pits: Pit[] = [];
  readonly pads: Pad[] = [];
  readonly orbs: Orb[] = [];
  readonly pickups: Pickup[] = [];
  readonly signs: Sign[] = [];
  readonly gates: SpeedGate[] = [];
  readonly gravZones: GravZone[] = [];
  readonly goalX: number;
  /** Kenttäpalojen nimet järjestyksessä (testit ja vianetsintä). */
  readonly layout: string[] = [];
  /** Palojen alkukohdat maailman pikseleinä (vianetsintä ja kuvakaappaukset). */
  readonly segments: { name: string; x: number }[] = [];

  /**
   * @param forced Testejä varten: rakentaa radan juuri näistä paloista
   * annetussa järjestyksessä satunnaisvalinnan sijaan.
   */
  constructor(destination: LevelInput, forced?: string[]) {
    this.goalX = destination.goalDistance * PIXELS_PER_METRE;
    const rng = new Rng(hash(destination.id));
    const goalBlocks = this.goalX / BLOCK;
    const endMargin = 14;
    const seenSigns = new Set<string>();

    let cursor = 24;
    let previous = '';

    const place = (chunk: Chunk): void => {
      for (const item of chunk.items) {
        if (item.t === 'sign') {
          // Ohjekyltti vain lajinsa ensimmäiseen kohtaan.
          if (seenSigns.has(item.kind)) continue;
          seenSigns.add(item.kind);
        }
        this.add(item, cursor);
      }
      this.layout.push(chunk.name);
      this.segments.push({ name: chunk.name, x: cursor * BLOCK });
      previous = chunk.name;
      // Tauko palojen välissä: laskeutuminen ja uusi rytmi mahtuvat väliin.
      cursor += chunk.length + rng.int(5, 7);
    };

    const fits = (c: Chunk): boolean => cursor + c.length <= goalBlocks - endMargin;
    const pick = (pool: Chunk[]): Chunk | undefined => {
      const options = pool.filter((c) => c.name !== previous && fits(c));
      return options.length > 0 ? rng.pick(options) : undefined;
    };

    if (forced) {
      for (const name of forced) {
        const chunk = CHUNKS.find((c) => c.name === name);
        if (!chunk) throw new Error(`Tuntematon kenttäpala: ${name}`);
        place(chunk);
      }
      return;
    }

    /*
     * Jokaisella radalla on oma luonteensa: sen omat palat (owner) käytetään
     * kaikki, vuorotellen yhteisten palojen kanssa, ja reittivalinta tulee
     * radan profiilista. Yhteiset palat valitaan vaikeuden mukaan.
     */
    const forkName = destination.level?.fork ?? 'fork-orb';
    const fork = CHUNKS.find((c) => c.name === forkName);
    if (!fork?.fork) throw new Error(`Tuntematon reittivalinta: ${forkName}`);
    const own = CHUNKS.filter((c) => c.owner === destination.id && !c.fork);
    const shared = CHUNKS.filter((c) => !c.owner && !c.fork);
    const easy = shared.filter((c) => c.difficulty === 1 && !c.higher);
    const medium = shared.filter((c) => c.difficulty === 2 && !c.higher);
    const hard = shared.filter((c) => c.difficulty === 3 && !c.higher);
    const higher = shared.filter((c) => c.higher);

    const queue = [...own];
    for (let i = queue.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [queue[i], queue[j]] = [queue[j]!, queue[i]!];
    }
    // Oma korkea hyppy ei tule heti alkuun.
    queue.sort((a, b) => Number(Boolean(a.higher)) - Number(Boolean(b.higher)));
    let higherPlaced = own.some((c) => c.higher);
    let forkPlaced = false;
    let turn = 0;

    const takeOwn = (): Chunk | undefined => {
      const next = queue.findIndex(fits);
      if (next >= 0) return queue.splice(next, 1)[0];
      return queue.length === 0 ? pick(own) : undefined;
    };
    const takeShared = (progress: number): Chunk | undefined => {
      const roll = rng.next();
      const pool = progress < 0.3 ? (roll < 0.5 ? easy : medium) : progress < 0.65 ? medium : roll < 0.55 ? hard : medium;
      return pick(pool) ?? pick(shared);
    };

    const intro = pick(easy);
    if (intro) place(intro);

    while (cursor < goalBlocks - endMargin) {
      const progress = cursor / goalBlocks;
      const room = goalBlocks - endMargin - cursor;
      const ownLeft = queue.reduce((sum, c) => sum + c.length + 6, 0);
      let chunk: Chunk | undefined;
      if (!forkPlaced && progress >= 0.42 && fits(fork)) {
        chunk = fork;
        forkPlaced = true;
      } else if (!higherPlaced && progress >= 0.22) {
        chunk = pick(higher);
        higherPlaced = Boolean(chunk);
      } else {
        // Omat ja yhteiset palat vuorotellen; jos tila käy vähiin, omat ensin,
        // jotta radan luonne säilyy.
        const forkReserve = forkPlaced ? 0 : fork.length + 6;
        const ownFirst = turn % 2 === 0 || room - forkReserve <= ownLeft + 20;
        chunk = ownFirst ? (takeOwn() ?? takeShared(progress)) : (takeShared(progress) ?? takeOwn());
        turn += 1;
      }
      if (!chunk) chunk = pick([...own, ...shared]);
      if (!chunk) break;
      place(chunk);
    }
  }

  private add(item: Chunk['items'][number], originBlocks: number): void {
    const x = (originBlocks + item.x) * BLOCK;
    switch (item.t) {
      case 'spike':
        this.spikes.push({ x, base: GROUND_Y - item.y * BLOCK, down: false, hit: false, grown: false });
        break;
      case 'cspike':
        this.spikes.push({ x, base: GROUND_Y - item.y * BLOCK, down: true, hit: false, grown: false });
        break;
      case 'speed':
        this.gates.push({ x, factor: item.factor });
        this.gates.sort((a, b) => a.x - b.x);
        break;
      case 'grav':
        this.gravZones.push({ x, w: item.w * BLOCK });
        break;
      case 'block':
        this.blocks.push({
          x,
          top: GROUND_Y - (item.y + item.h) * BLOCK,
          w: item.w * BLOCK,
          h: item.h * BLOCK,
          hit: false,
        });
        break;
      case 'pit':
        this.pits.push({ x, w: item.w * BLOCK, bridged: false });
        break;
      case 'pad':
        this.pads.push({ x, surface: GROUND_Y - item.y * BLOCK });
        break;
      case 'orb':
        this.orbs.push({ x: x + BLOCK / 2, y: GROUND_Y - item.y * BLOCK, used: false });
        break;
      case 'credit':
      case 'module':
        this.pickups.push({ x, y: GROUND_Y - item.y * BLOCK, kind: item.t, taken: false });
        break;
      case 'sign':
        this.signs.push({ x, y: GROUND_Y - item.y * BLOCK, kind: item.kind });
        break;
    }
  }

  /** Onko pelaajan keskipiste kuopan kohdalla. Reunoilla on pieni armonvara. */
  isOverPit(worldX: number): boolean {
    for (const pit of this.pits) {
      if (pit.bridged) continue;
      if (worldX > pit.x + PIT_EDGE_GRACE && worldX < pit.x + pit.w - PIT_EDGE_GRACE) return true;
    }
    return false;
  }

  blockRect(b: Block): Rect {
    return { x: b.x, y: b.top, w: b.w, h: b.h };
  }

  /** Piikin törmäysalue on piirrettyä kolmiota pienempi. */
  spikeRect(s: Spike): Rect {
    return {
      x: s.x + SPIKE_HITBOX.inset,
      y: s.down ? s.base : s.base - BLOCK + SPIKE_HITBOX.top,
      w: BLOCK - SPIKE_HITBOX.inset * 2,
      h: BLOCK - SPIKE_HITBOX.top,
    };
  }

  /** Nopeuskerroin kohdassa x: viimeisimmän ohitetun portin arvo. */
  speedFactorAt(worldX: number): number {
    let factor = 1;
    for (const gate of this.gates) {
      if (gate.x > worldX) break;
      factor = gate.factor;
    }
    return factor;
  }

  inLowGravity(worldX: number): boolean {
    return this.gravZones.some((z) => worldX >= z.x && worldX <= z.x + z.w);
  }

  orbTouches(orb: Orb, box: Rect): boolean {
    const cx = Math.max(box.x, Math.min(orb.x, box.x + box.w));
    const cy = Math.max(box.y, Math.min(orb.y, box.y + box.h));
    return Math.hypot(orb.x - cx, orb.y - cy) <= ORB_RADIUS;
  }

  get creditTotal(): number {
    return this.pickups.filter((p) => p.kind === 'credit').length;
  }

  get moduleTotal(): number {
    return this.pickups.filter((p) => p.kind === 'module').length;
  }
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
