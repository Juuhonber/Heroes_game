import { Rng } from '../core/math';
import type { Rect } from '../core/math';
import { BLOCK, GROUND_Y, ORB_RADIUS, PIT_EDGE_GRACE, PIXELS_PER_METRE, SPIKE_HITBOX } from './constants';
import { CHUNKS } from './chunks';
import type { Chunk } from './chunks';
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
  /** Pinnan y, jolla piikki seisoo (maa tai palikan yläpinta). */
  base: number;
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
  kind: 'fork' | 'pad' | 'orb';
}

type LevelInput = Pick<Destination, 'id' | 'goalDistance'>;

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
  readonly goalX: number;
  /** Kenttäpalojen nimet järjestyksessä (testit ja vianetsintä). */
  readonly layout: string[] = [];

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
    let forkPlaced = false;
    let higherPlaced = false;
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
      previous = chunk.name;
      // Tauko palojen välissä: laskeutuminen ja uusi rytmi mahtuvat väliin.
      cursor += chunk.length + rng.int(3, 5);
    };

    const pick = (pool: Chunk[]): Chunk | undefined => {
      const options = pool.filter((c) => c.name !== previous && cursor + c.length <= goalBlocks - endMargin);
      return options.length > 0 ? rng.pick(options) : undefined;
    };

    const easy = CHUNKS.filter((c) => c.difficulty === 1 && !c.fork && !c.higher);
    const medium = CHUNKS.filter((c) => c.difficulty === 2 && !c.fork && !c.higher);
    const hard = CHUNKS.filter((c) => c.difficulty === 3);
    const higher = CHUNKS.filter((c) => c.higher);
    const forks = CHUNKS.filter((c) => c.fork);

    if (forced) {
      for (const name of forced) {
        const chunk = CHUNKS.find((c) => c.name === name);
        if (!chunk) throw new Error(`Tuntematon kenttäpala: ${name}`);
        place(chunk);
      }
      return;
    }

    // Kaksi helppoa palaa alkuun: pelaaja oppii hypyn ennen kuin rata tihenee.
    for (let i = 0; i < 2; i++) {
      const chunk = pick(easy);
      if (chunk) place(chunk);
    }

    while (cursor < goalBlocks - endMargin) {
      const progress = cursor / goalBlocks;
      let chunk: Chunk | undefined;
      if (!forkPlaced && progress >= 0.42) {
        chunk = pick(forks);
        if (chunk) forkPlaced = true;
      } else if (!higherPlaced && progress >= 0.22) {
        chunk = pick(higher);
        if (chunk) higherPlaced = true;
      } else if (progress < 0.3) {
        chunk = pick(rng.next() < 0.5 ? easy : medium);
      } else if (progress < 0.65) {
        chunk = pick(rng.next() < 0.2 ? higher : medium);
      } else {
        const roll = rng.next();
        chunk = pick(roll < 0.45 ? hard : roll < 0.65 ? higher : medium);
      }
      if (!chunk) break;
      place(chunk);
    }
  }

  private add(item: Chunk['items'][number], originBlocks: number): void {
    const x = (originBlocks + item.x) * BLOCK;
    switch (item.t) {
      case 'spike':
        this.spikes.push({ x, base: GROUND_Y - item.y * BLOCK, hit: false, grown: false });
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
      y: s.base - BLOCK + SPIKE_HITBOX.top,
      w: BLOCK - SPIKE_HITBOX.inset * 2,
      h: BLOCK - SPIKE_HITBOX.top,
    };
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
