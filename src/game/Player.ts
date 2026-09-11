import { Animator } from '../core/Animator';
import type { Rect } from '../core/math';
import { clamp } from '../core/math';
import { GROUND_Y, PHYSICS, PLAYER_SIZE, POWER } from './constants';

export type PlayerMode = 'run' | 'hurt' | 'idle';

export class Player {
  worldX = 0;
  y = GROUND_Y;
  vy = 0;
  onGround = true;
  mode: PlayerMode = 'run';
  speed = PHYSICS.baseSpeed;
  charges = 0;
  powerTimer = 0;
  private coyote = 0;
  private buffer = 0;

  constructor(readonly anim: Animator) {}

  get shielded(): boolean {
    return this.powerTimer > 0;
  }

  /** Törmäyslaatikko on spriteä kapeampi, jotta peli tuntuu reilulta. */
  get hitbox(): Rect {
    return {
      x: this.worldX - PLAYER_SIZE.w / 2,
      y: this.y - PLAYER_SIZE.h,
      w: PLAYER_SIZE.w,
      h: PLAYER_SIZE.h,
    };
  }

  reset(): void {
    this.worldX = 0;
    this.y = GROUND_Y;
    this.vy = 0;
    this.onGround = true;
    this.mode = 'run';
    this.speed = PHYSICS.baseSpeed;
    this.charges = 0;
    this.powerTimer = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.anim.play('run', true);
  }

  requestJump(): void {
    this.buffer = PHYSICS.jumpBuffer;
  }

  /** Painalluksen vapautus nousun aikana katkaisee hypyn matalaksi. */
  releaseJump(): void {
    if (this.vy < 0) this.vy *= PHYSICS.jumpCutoff;
  }

  /** Käyttää suojavoiman, jos varauksia on. Palauttaa true jos voima aktivoitui. */
  usePower(): boolean {
    if (this.charges <= 0 || this.powerTimer > 0) return false;
    this.charges -= 1;
    this.powerTimer = POWER.duration;
    return true;
  }

  addCharge(): void {
    this.charges = Math.min(POWER.maxCharges, this.charges + 1);
  }

  update(dt: number, groundY: number, frozen: boolean): void {
    this.powerTimer = Math.max(0, this.powerTimer - dt);

    if (this.mode === 'hurt') {
      // Törmäyksen jälkeen hahmo putoaa paikalleen, rata ei etene.
      this.vy += PHYSICS.gravity * dt;
      this.y = Math.min(groundY, this.y + this.vy * dt);
      this.anim.update(dt);
      return;
    }

    if (!frozen) {
      const target = PHYSICS.maxSpeed + (this.shielded ? POWER.speedBoost : 0);
      this.speed = clamp(this.speed + PHYSICS.speedRamp * dt, PHYSICS.baseSpeed, target);
      this.worldX += this.speed * dt;
    }

    this.coyote = this.onGround ? PHYSICS.coyoteTime : Math.max(0, this.coyote - dt);
    this.buffer = Math.max(0, this.buffer - dt);

    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = PHYSICS.jumpVelocity;
      this.onGround = false;
      this.coyote = 0;
      this.buffer = 0;
      this.anim.play('jump', true);
    }

    this.vy += PHYSICS.gravity * dt;
    this.y += this.vy * dt;

    if (this.y >= groundY) {
      this.y = groundY;
      if (!this.onGround) this.anim.play('run', true);
      this.onGround = true;
      this.vy = 0;
    } else {
      this.onGround = false;
      // Hyppyarkin toinen ruutu on laskeutuminen.
      if (this.anim.name === 'jump' && this.vy > 120) this.anim.play('jump');
    }

    if (this.onGround && this.anim.name !== 'run') this.anim.play('run');
    this.anim.update(dt);
  }

  crash(): void {
    this.mode = 'hurt';
    this.vy = -420;
    this.powerTimer = 0;
    this.anim.play('hurt', true);
  }

  draw(ctx: CanvasRenderingContext2D, screenX: number, accent: string): void {
    if (this.shielded) {
      const pulse = 0.6 + 0.4 * Math.sin(this.powerTimer * 18);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * pulse;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(screenX, this.y - PLAYER_SIZE.h * 0.55, 118, 138, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }

    // Varjo kertoo korkeuden maasta.
    const height = GROUND_Y - this.y;
    const shrink = clamp(1 - height / 700, 0.35, 1);
    ctx.save();
    ctx.globalAlpha = 0.25 * shrink;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(screenX, GROUND_Y + 8, 70 * shrink, 16 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const tilt = this.mode === 'hurt' ? -0.25 : 0;
    ctx.save();
    if (tilt !== 0) {
      ctx.translate(screenX, this.y);
      ctx.rotate(tilt);
      ctx.translate(-screenX, -this.y);
    }
    this.anim.drawAnchored(ctx, screenX, this.y, PLAYER_SIZE.drawHeight);
    ctx.restore();
  }
}
