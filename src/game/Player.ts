import type { Rect } from '../core/math';
import { clamp } from '../core/math';
import { GROUND_Y, PHYSICS, PLAYER_SIZE } from './constants';

export type PlayerMode = 'run' | 'rocket' | 'hurt';

/**
 * Pelaajan fysiikka. Ei piirrä mitään eikä tunne selainta, joten sitä voi
 * ajaa testeissä sellaisenaan.
 */
export class Player {
  worldX = 0;
  y = GROUND_Y;
  vy = 0;
  onGround = true;
  mode: PlayerMode = 'run';
  speed = PHYSICS.baseSpeed;
  coyote = 0;
  buffer = 0;
  /** Rakettilennon jälkeen esteet eivät satuta ennen laskeutumista. */
  safeUntilLanding = false;
  /** Rakettilennon korkeus maasta. */
  rocketAltitude = 0;

  get hitbox(): Rect {
    return {
      x: this.worldX - PLAYER_SIZE.w / 2,
      y: this.y - PLAYER_SIZE.h,
      w: PLAYER_SIZE.w,
      h: PLAYER_SIZE.h,
    };
  }

  requestJump(): void {
    this.buffer = PHYSICS.jumpBuffer;
  }

  startRocket(altitude: number): void {
    this.mode = 'rocket';
    this.rocketAltitude = altitude;
    this.onGround = false;
    this.buffer = 0;
  }

  endRocket(): void {
    this.mode = 'run';
    this.vy = 0;
    this.safeUntilLanding = true;
  }

  crash(): void {
    this.mode = 'hurt';
    this.vy = Math.min(this.vy, -420);
    this.safeUntilLanding = false;
  }

  /**
   * Etenee yhden aika-askeleen. Palauttaa 'jump', jos hyppy lähti tällä
   * askeleella, ja 'land', jos pelaaja laskeutui.
   */
  step(dt: number, overPit: boolean, advance: boolean): 'jump' | 'land' | null {
    if (this.mode === 'hurt') {
      this.vy += PHYSICS.gravity * dt;
      this.y += this.vy * dt;
      if (!overPit && this.y > GROUND_Y && this.y - this.vy * dt <= GROUND_Y + 1) {
        this.y = GROUND_Y;
        this.vy = 0;
      }
      return null;
    }

    if (advance) {
      this.speed = clamp(this.speed + PHYSICS.speedRamp * dt, PHYSICS.baseSpeed, PHYSICS.maxSpeed);
      this.worldX += this.speed * dt;
    }

    if (this.mode === 'rocket') {
      const target = GROUND_Y - this.rocketAltitude;
      this.y += (target - this.y) * (1 - Math.exp(-7 * dt));
      this.vy = 0;
      this.onGround = false;
      return null;
    }

    let result: 'jump' | 'land' | null = null;
    this.coyote = this.onGround ? PHYSICS.coyoteTime : Math.max(0, this.coyote - dt);
    this.buffer = Math.max(0, this.buffer - dt);

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = PHYSICS.jumpVelocity;
      this.onGround = false;
      this.coyote = 0;
      this.buffer = 0;
      result = 'jump';
    }

    const prevY = this.y;
    this.vy += PHYSICS.gravity * dt;
    this.y += this.vy * dt;

    // Laskeutuminen vain ylhäältä päin: kuoppaan pudonnut ei ponnahda
    // takaisin pinnalle, kun kuopan reuna tulee vastaan.
    if (!overPit && this.y >= GROUND_Y && prevY <= GROUND_Y + 1) {
      if (!this.onGround) result = result ?? 'land';
      this.y = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
      this.safeUntilLanding = false;
    } else {
      this.onGround = false;
    }
    return result;
  }
}
