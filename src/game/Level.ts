import { Rng } from '../core/math';
import type { Rect } from '../core/math';
import {
  GROUND_Y,
  JUMP_AIRTIME,
  OBSTACLE_INSET,
  PHYSICS,
  PIT_EDGE_GRACE,
  PIXELS_PER_METRE,
} from './constants';
import type { Destination } from '../data/destinations';

export type ObstacleKind = 'block' | 'tall' | 'wide';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  w: number;
  h: number;
  /** Suojavoima murskasi esteen. */
  hit: boolean;
  /** Kasvuvoima muutti esteen vaarattomaksi pensaaksi. */
  grown: boolean;
}

export interface Pit {
  x: number;
  w: number;
  /** Kasvuvoima kasvatti kuopan yli sillan. */
  bridged: boolean;
}

export interface Token {
  x: number;
  y: number;
  taken: boolean;
}

export const OBSTACLE_SHAPES: Record<ObstacleKind, { w: number; h: number }> = {
  block: { w: 90, h: 100 },
  tall: { w: 70, h: 150 },
  wide: { w: 160, h: 80 },
};

/** Kuutio esteen yllä on hyvin ajoitetun hypyn lakipisteen kohdalla. */
const TOKEN_HIGH = GROUND_Y - 300;
/**
 * Tasaisella osuudella kuutio on matalalla, joten mikä tahansa hyppy yltää,
 * mutta pelkkä juokseminen ei riitä.
 */
const TOKEN_LOW = GROUND_Y - 205;

/** Juoksunopeus paikassa x, kun nopeus kasvaa tasaisesti ajan funktiona. */
export function speedAt(x: number): number {
  const v = Math.sqrt(PHYSICS.baseSpeed ** 2 + 2 * PHYSICS.speedRamp * Math.max(0, x));
  return Math.min(PHYSICS.maxSpeed, v);
}

/**
 * Rata luodaan kerralla kohteen id:stä johdetulla siemenellä: sama kohde
 * tuottaa aina saman radan, joten uusi yritys on reilu ja rata opittavissa.
 *
 * Esteiden välit lasketaan hypyn fysiikasta. Tavallinen väli on selvästi
 * hypyn pituutta pidempi, ja tiukat esteparit jättävät silti aikaa laskeutua
 * ja ponnistaa uudelleen. tests/fairness.test.ts todentaa jokaisen radan
 * läpäistäväksi ajoitusvaralla.
 */
export class Level {
  readonly obstacles: Obstacle[] = [];
  readonly pits: Pit[] = [];
  readonly tokens: Token[] = [];
  readonly goalX: number;

  constructor(destination: Pick<Destination, 'id' | 'goalDistance' | 'obstacleDensity'>) {
    this.goalX = destination.goalDistance * PIXELS_PER_METRE;
    const rng = new Rng(hash(destination.id));
    const density = destination.obstacleDensity;

    let x = 1500;
    let index = 0;
    const end = this.goalX - 700;
    while (x < end) {
      const v = speedAt(x);
      const progress = x / end;
      const roll = rng.next();
      let hazardEnd: number;

      if (index >= 2 && x > 3200 && roll < 0.16) {
        const w = rng.range(150, 205);
        this.pits.push({ x, w, bridged: false });
        hazardEnd = x + w;
      } else {
        // Kaksi ensimmäistä estettä ovat matalia: pelaaja oppii hypyn ensin.
        const kind: ObstacleKind =
          index < 2 ? 'block' : roll < 0.52 ? 'block' : roll < 0.78 ? 'tall' : 'wide';
        hazardEnd = this.addObstacle(kind, x, rng);

        if (index >= 2 && progress > 0.4 && rng.next() < 0.25) {
          // Esteparin väli: laskeutuminen ja uusi ponnistus mahtuvat väliin.
          const pairGap = 90 + v * rng.range(0.5, 0.62);
          const second: ObstacleKind = rng.next() < 0.6 ? 'block' : 'tall';
          hazardEnd = this.addObstacle(second, hazardEnd + pairGap, rng);
        }
      }

      const gap = (v * rng.range(1.25, 1.8)) / density;
      if (gap > v * JUMP_AIRTIME * 1.6 && rng.next() < 0.4) {
        this.tokens.push({ x: hazardEnd + gap * 0.5, y: TOKEN_LOW, taken: false });
      }
      x = hazardEnd + gap;
      index += 1;
    }
  }

  private addObstacle(kind: ObstacleKind, x: number, rng: Rng): number {
    const shape = OBSTACLE_SHAPES[kind];
    this.obstacles.push({ kind, x, w: shape.w, h: shape.h, hit: false, grown: false });
    if (rng.next() < 0.6) {
      this.tokens.push({ x: x + shape.w / 2, y: TOKEN_HIGH, taken: false });
    }
    return x + shape.w;
  }

  /** Onko maata tässä kohdassa. Kuopan reunoilla on pieni armonvara. */
  isOverPit(worldX: number, margin = 0): boolean {
    const grace = PIT_EDGE_GRACE - margin;
    for (const pit of this.pits) {
      if (pit.bridged) continue;
      if (worldX > pit.x + grace && worldX < pit.x + pit.w - grace) return true;
    }
    return false;
  }

  /** Törmäysalue on hieman piirrettyä estettä pienempi. */
  obstacleRect(o: Obstacle, margin = 0): Rect {
    return {
      x: o.x + OBSTACLE_INSET.x - margin,
      y: GROUND_Y - o.h + OBSTACLE_INSET.top,
      w: o.w - OBSTACLE_INSET.x * 2 + margin * 2,
      h: o.h - OBSTACLE_INSET.top,
    };
  }

  get tokenCount(): number {
    return this.tokens.length;
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
