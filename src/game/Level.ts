import { Rng } from '../core/math';
import type { Rect } from '../core/math';
import { GROUND_Y, PIXELS_PER_METRE } from './constants';
import type { Destination } from '../data/destinations';

export type ObstacleKind = 'block' | 'tall' | 'wide';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  w: number;
  h: number;
  hit: boolean;
}

export interface Pit {
  x: number;
  w: number;
}

export interface Token {
  x: number;
  y: number;
  taken: boolean;
}

const SHAPES: Record<ObstacleKind, { w: number; h: number }> = {
  block: { w: 96, h: 112 },
  tall: { w: 76, h: 178 },
  wide: { w: 208, h: 96 },
};

/**
 * Rata luodaan kerralla valmiiksi kohteen id:stä johdetulla siemenellä.
 * Sama kohde tuottaa aina saman radan, joten uusi yritys on reilu ja
 * pelaaja voi oppia radan.
 */
export class Level {
  readonly obstacles: Obstacle[] = [];
  readonly pits: Pit[] = [];
  readonly tokens: Token[] = [];
  readonly goalX: number;

  constructor(destination: Destination) {
    this.goalX = destination.goalDistance * PIXELS_PER_METRE;
    const rng = new Rng(hash(destination.id));
    const density = destination.obstacleDensity;

    let x = 1500;
    // Viimeiset 600 px jätetään vapaaksi maaliportin eteen.
    const end = this.goalX - 600;
    while (x < end) {
      const progress = x / end;
      // Väli kapenee radan edetessä, mutta ei koskaan alle hypyn pituuden.
      const baseGap = (900 - progress * 220) / density;
      const roll = rng.next();

      if (roll < 0.18 && x > 3000) {
        const w = rng.range(170, 250);
        this.pits.push({ x, w });
        x += w + baseGap * rng.range(0.85, 1.15);
      } else {
        const kind: ObstacleKind =
          roll < 0.5 ? 'block' : roll < 0.78 ? 'tall' : 'wide';
        const shape = SHAPES[kind];
        this.obstacles.push({ kind, x, w: shape.w, h: shape.h, hit: false });
        // Toinen este heti perään vasta radan loppupuolella.
        if (progress > 0.45 && rng.next() < 0.22) {
          const second = x + shape.w + rng.range(230, 320);
          const sk: ObstacleKind = rng.next() < 0.6 ? 'block' : 'tall';
          this.obstacles.push({ kind: sk, x: second, w: SHAPES[sk].w, h: SHAPES[sk].h, hit: false });
          x = second + SHAPES[sk].w;
        } else {
          x += shape.w;
        }
        x += baseGap * rng.range(0.9, 1.2);
      }

      if (rng.next() < 0.45) {
        this.tokens.push({
          x: x - baseGap * 0.5,
          y: GROUND_Y - rng.range(210, 330),
          taken: false,
        });
      }
    }
  }

  /** Maanpinta annetussa kohdassa: kuoppien päällä ei ole maata. */
  groundAt(worldX: number): number {
    for (const pit of this.pits) {
      if (worldX > pit.x + 8 && worldX < pit.x + pit.w - 8) return GROUND_Y + 900;
    }
    return GROUND_Y;
  }

  obstacleRect(o: Obstacle): Rect {
    return { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h };
  }

  get tokenCount(): number {
    return this.tokens.length;
  }
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
