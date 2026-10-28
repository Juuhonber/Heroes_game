import type { Rect } from '../core/math';
import { GROUND_Y, PHYSICS, PLAYER_SIZE } from './constants';

export type PlayerMode = 'run' | 'rocket' | 'hurt';

/**
 * Pelaajan tila. Liike ja törmäykset lasketaan RunSimissä, koska ne
 * tarvitsevat radan tiedot. Ei piirrä mitään eikä tunne selainta.
 */
export class Player {
  worldX = 0;
  /** Jalkojen y ruudulla. */
  y = GROUND_Y;
  vy = 0;
  onGround = true;
  mode: PlayerMode = 'run';
  speed = PHYSICS.speed;
  coyote = 0;
  buffer = 0;
  /** Hyppynappi pohjassa: laskeutuessa hypätään heti uudelleen. */
  holding = false;
  /** Rakettilennon jälkeen esteet eivät satuta ennen laskeutumista. */
  safeUntilLanding = false;
  rocketAltitude = 0;

  get hitbox(): Rect {
    return hitboxAt(this.worldX, this.y);
  }
}

export function hitboxAt(worldX: number, feetY: number): Rect {
  return {
    x: worldX - PLAYER_SIZE.w / 2,
    y: feetY - PLAYER_SIZE.h,
    w: PLAYER_SIZE.w,
    h: PLAYER_SIZE.h,
  };
}
