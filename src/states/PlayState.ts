import type { GameState } from '../core/GameState';
import type { Game } from '../core/Game';
import { VIRTUAL_H, VIRTUAL_W } from '../core/Game';
import type { InputEvent } from '../core/Input';
import { Animator } from '../core/Animator';
import { clamp } from '../core/math';
import { RunSim } from '../game/RunSim';
import type { SimEvent } from '../game/RunSim';
import { Backdrop } from '../game/Backdrop';
import {
  GROUND_Y,
  PLAYER_SCREEN_X,
  PLAYER_SIZE,
  POWER,
  POWER_TUNING,
  SPRITE_FOOT_PAD,
} from '../game/constants';
import type { Destination } from '../data/destinations';
import { STRENGTH_COLORS } from '../data/destinations';
import { PALETTE, clearShadow, fitFont, font, roundRect, shadow } from '../ui/theme';
import { localized, t } from '../ui/strings';
import { drawPowerIcon } from '../ui/icons';
import type { PowerKind } from '../game/powers';

export interface PlayPayload {
  id: string;
}

export interface RunResult {
  id: string;
  success: boolean;
  distance: number;
  tokens: number;
  tokenTotal: number;
  powersUsed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
  gravity: number;
}

type Phase = 'intro' | 'run' | 'end';

const INTRO_SECONDS = 1.5;
const CRASH_SECONDS = 1.1;
const FINISH_SECONDS = 1.0;
const HINT_SECONDS = 7;

/**
 * Voimanappi: iso kosketusalue oikeassa alakulmassa, kokonaan maanpinnan
 * alapuolella, jottei se peitä oikealta saapuvia esteitä.
 */
const POWER_BUTTON = { x: 1800, y: 978, r: 84 };

export class PlayState implements GameState {
  readonly name = 'play';

  private game!: Game;
  private destination!: Destination;
  private sim!: RunSim;
  private backdrop!: Backdrop;
  private anim!: Animator;
  private phase: Phase = 'intro';
  private phaseTimer = 0;
  private elapsed = 0;
  private particles: Particle[] = [];
  private shake = 0;
  private noChargeTimer = 0;
  private powerFlash = 0;
  private photoApplied = false;

  enter(game: Game, payload?: unknown): void {
    this.game = game;
    const id = (payload as PlayPayload | undefined)?.id ?? game.assets.destinations[0]!.id;
    this.destination = game.destination(id);
    this.sim = new RunSim(this.destination);
    this.backdrop = new Backdrop(this.destination);
    this.anim = new Animator(game.assets.clips, 'run');
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.elapsed = 0;
    this.particles = [];
    this.shake = 0;
    this.noChargeTimer = 0;
    this.powerFlash = 0;
    this.photoApplied = false;
    game.assets.campus.request(id);
    this.applyPhoto();
  }

  /** Kampuskuva voi valmistua kesken juoksun: se häivytetään sisään silloin. */
  private applyPhoto(): void {
    if (this.photoApplied) return;
    const photo = this.game.assets.campus.get(this.destination.id);
    if (!photo) return;
    this.backdrop.setPhoto(photo);
    this.photoApplied = true;
  }

  blocksIdleReset(): boolean {
    // Kesken juoksun ei palata kartalle: pelaaja on selvästi läsnä.
    return this.phase === 'run' && this.game.input.idleSeconds < 25;
  }

  update(dt: number, events: readonly InputEvent[]): void {
    this.elapsed += dt;
    this.phaseTimer += dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.noChargeTimer = Math.max(0, this.noChargeTimer - dt);
    this.powerFlash = Math.max(0, this.powerFlash - dt * 2.5);
    this.applyPhoto();

    if (this.phase === 'intro') {
      // Intron aikana painallus ohittaa esittelyn.
      if (events.some((e) => e.type === 'press')) this.phaseTimer = INTRO_SECONDS;
      if (this.phaseTimer >= INTRO_SECONDS) {
        this.phase = 'run';
        this.phaseTimer = 0;
      }
      this.anim.update(dt * 0.6);
      this.updateParticles(dt);
      return;
    }

    if (this.phase === 'run') this.routeInput(events);

    const simEvents = this.sim.step(dt);
    for (const event of simEvents) this.onSimEvent(event);

    if (this.phase === 'end') {
      const wait = this.sim.phase === 'finished' ? FINISH_SECONDS : CRASH_SECONDS;
      if (this.phaseTimer >= wait) this.finish();
    }

    this.updateAnimation(dt * this.sim.timeScale);
    if (this.sim.activePower === 'rocket') this.emitRocketExhaust();
    this.updateParticles(dt * this.sim.timeScale);
  }

  /** Voimanapin kohdalla painallus käyttää voiman, muualla se on hyppy. */
  private routeInput(events: readonly InputEvent[]): void {
    for (const event of events) {
      if (event.type !== 'press') continue;
      if (event.action === 'secondary') {
        this.sim.press('power');
        continue;
      }
      if (event.pointer && event.x !== undefined && event.y !== undefined) {
        const d = Math.hypot(event.x - POWER_BUTTON.x, event.y - POWER_BUTTON.y);
        if (d <= POWER_BUTTON.r + 24) {
          this.sim.press('power');
          continue;
        }
      }
      this.sim.press('jump');
    }
  }

  private onSimEvent(event: SimEvent): void {
    const accent = this.destination.theme.accent;
    switch (event.type) {
      case 'token':
        this.burst(this.toScreen(event.x), event.y, '#c9e35a', 16, 1400);
        break;
      case 'smash':
        this.burst(this.toScreen(event.x), event.y, accent, 26, 1400);
        this.shake = 0.5;
        break;
      case 'power':
        this.powerFlash = 1;
        this.burst(PLAYER_SCREEN_X, this.sim.player.y - 70, accent, 28, 900);
        break;
      case 'grow':
        for (let x = event.from; x < event.to; x += 90) {
          this.burst(this.toScreen(x), GROUND_Y - 20, '#7ee08a', 3, 700);
        }
        break;
      case 'noCharge':
        this.noChargeTimer = 1.4;
        break;
      case 'crash':
        this.phase = 'end';
        this.phaseTimer = 0;
        this.shake = 1;
        this.burst(PLAYER_SCREEN_X, this.sim.player.y - 80, PALETTE.coral, 30, 1400);
        break;
      case 'goal':
        this.phase = 'end';
        this.phaseTimer = 0;
        this.burst(PLAYER_SCREEN_X, GROUND_Y - 180, accent, 44, 1400);
        break;
      default:
        break;
    }
  }

  private updateAnimation(dt: number): void {
    const p = this.sim.player;
    if (p.mode === 'hurt') {
      this.anim.play('hurt');
      this.anim.update(dt);
    } else if (p.mode === 'rocket') {
      this.anim.play('jump');
      this.anim.setFrame(0);
    } else if (!p.onGround) {
      this.anim.play('jump');
      this.anim.setFrame(p.vy < 0 ? 0 : 1);
    } else {
      this.anim.play('run');
      this.anim.update(dt);
    }
  }

  private finish(): void {
    const success = this.sim.phase === 'finished';
    if (success) this.game.stamps.add(this.destination.id);
    const result: RunResult = {
      id: this.destination.id,
      success,
      distance: this.sim.distanceMetres,
      tokens: this.sim.tokensTaken,
      tokenTotal: this.sim.level.tokenCount,
      powersUsed: this.sim.powersUsed,
    };
    this.game.transitionTo('result', result);
  }

  private get cameraX(): number {
    return this.sim.player.worldX - PLAYER_SCREEN_X;
  }

  private toScreen(worldX: number): number {
    return worldX - this.cameraX;
  }

  private burst(x: number, y: number, color: string, count: number, gravity: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 420;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 160,
        life: 0.5 + Math.random() * 0.5,
        size: 6 + Math.random() * 12,
        color,
        gravity,
      });
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  }

  private emitRocketExhaust(): void {
    const p = this.sim.player;
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: PLAYER_SCREEN_X - 30 + Math.random() * 20,
        y: p.y + 6,
        vx: -260 - Math.random() * 200,
        vy: 60 + Math.random() * 120,
        life: 0.35 + Math.random() * 0.25,
        size: 10 + Math.random() * 14,
        color: Math.random() < 0.5 ? '#ffb454' : '#ffe08a',
        gravity: -200,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // --- Piirto -------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    const camera = this.cameraX;
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 14;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.backdrop.drawSky(ctx, camera, this.elapsed);
    this.backdrop.drawLayers(ctx, camera);
    this.backdrop.drawGround(ctx, camera, this.sim.level.pits);
    this.drawBridges(ctx, camera);

    this.drawGoal(ctx, camera);
    this.drawObstacles(ctx, camera);
    this.drawTokens(ctx, camera);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);
    ctx.restore();

    if (this.sim.activePower === 'slowmo') this.drawSlowmoOverlay(ctx);
    this.drawHud(ctx);
    this.drawPowerButton(ctx);
    this.drawJumpPrompt(ctx, camera);
    if (this.phase === 'intro') this.drawIntro(ctx);
    this.drawIdleCountdown(ctx);
  }

  private drawBridges(ctx: CanvasRenderingContext2D, camera: number): void {
    for (const pit of this.sim.level.pits) {
      if (!pit.bridged) continue;
      const x = pit.x - camera;
      if (x > VIRTUAL_W || x + pit.w < 0) continue;
      // Kasvuvoiman silta: lehvästö täyttää kuopan.
      ctx.save();
      ctx.fillStyle = '#2f7a3a';
      ctx.fillRect(x - 6, GROUND_Y, pit.w + 12, 30);
      ctx.fillStyle = '#7ee08a';
      for (let i = 0; i <= pit.w; i += 26) {
        ctx.beginPath();
        ctx.ellipse(x + i, GROUND_Y + 4, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawObstacles(ctx: CanvasRenderingContext2D, camera: number): void {
    const theme = this.destination.theme;
    for (const o of this.sim.level.obstacles) {
      const x = o.x - camera;
      if (x > VIRTUAL_W + 100 || x + o.w < -100) continue;
      if (o.grown) {
        this.drawBush(ctx, x, o.w, o.h);
        continue;
      }
      const y = GROUND_Y - o.h;
      const depth = 16;
      ctx.save();
      if (o.hit) {
        ctx.globalAlpha = 0.22;
        ctx.translate(0, 28);
      }
      // Sama kuutiomainen muotokieli kuin maskotissa.
      ctx.fillStyle = theme.groundDark;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + depth, y - depth);
      ctx.lineTo(x + o.w + depth, y - depth);
      ctx.lineTo(x + o.w, y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1a2624';
      roundRect(ctx, x, y, o.w, o.h, 12);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x + 10, y + Math.min(34, o.h * 0.34), o.w - 20, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 4;
      roundRect(ctx, x, y, o.w, o.h, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBush(ctx: CanvasRenderingContext2D, x: number, w: number, h: number): void {
    const bushH = Math.min(h, 70);
    ctx.save();
    ctx.fillStyle = '#2f7a3a';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, GROUND_Y, w / 2 + 12, bushH, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ee08a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + (w * (i + 0.5)) / 4, GROUND_Y - bushH * 0.7 + (i % 2) * 12, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTokens(ctx: CanvasRenderingContext2D, camera: number): void {
    const image = this.game.assets.token;
    for (const token of this.sim.level.tokens) {
      if (token.taken) continue;
      const x = token.x - camera;
      if (x > VIRTUAL_W + 80 || x < -80) continue;
      const bob = Math.sin(this.elapsed * 3 + token.x * 0.01) * 10;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#c9e35a';
      ctx.beginPath();
      ctx.arc(x, token.y + bob, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.drawImage(image, x - 44, token.y + bob - 44, 88, 88);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.sim.player;
    const x = PLAYER_SCREEN_X;
    const accent = this.destination.theme.accent;

    // Varjo kertoo korkeuden maasta.
    const height = GROUND_Y - p.y;
    const shrink = clamp(1 - height / 700, 0.3, 1);
    ctx.save();
    ctx.globalAlpha = 0.25 * shrink;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 8, 62 * shrink, 14 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.sim.activePower === 'rocket') this.drawRocketFlame(ctx, x, p.y);

    const foot = PLAYER_SIZE.drawHeight * SPRITE_FOOT_PAD;
    ctx.save();
    if (p.mode === 'hurt') {
      ctx.translate(x, p.y);
      ctx.rotate(-0.25);
      ctx.translate(-x, -p.y);
    }
    this.anim.drawAnchored(ctx, x, p.y + foot, PLAYER_SIZE.drawHeight);
    ctx.restore();

    if (this.sim.activePower === 'shield') this.drawShield(ctx, x, p.y, accent);
  }

  private drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, accent: string): void {
    const cy = y - PLAYER_SIZE.h * 0.62;
    const ending = this.sim.powerTimer < 0.6 && Math.sin(this.elapsed * 30) > 0;
    ctx.save();
    ctx.globalAlpha = ending ? 0.12 : 0.24;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(x, cy, 124, 138, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = ending ? 0.4 : 0.9;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.stroke();
    // Tiimikaverit kiertävät suojan kehällä.
    ctx.globalAlpha = 1;
    const image = this.game.assets.token;
    for (let i = 0; i < 4; i++) {
      const a = this.elapsed * 3 + (i * Math.PI) / 2;
      ctx.drawImage(image, x + Math.cos(a) * 128 - 22, cy + Math.sin(a) * 140 - 22, 44, 44);
    }
    ctx.restore();
  }

  private drawRocketFlame(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const flicker = 0.8 + Math.random() * 0.4;
    ctx.save();
    ctx.fillStyle = '#ff7a3d';
    ctx.beginPath();
    ctx.moveTo(x - 34, y - 10);
    ctx.lineTo(x - 4, y - 10);
    ctx.lineTo(x - 19, y + 70 * flicker);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.moveTo(x - 28, y - 10);
    ctx.lineTo(x - 10, y - 10);
    ctx.lineTo(x - 19, y + 40 * flicker);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawSlowmoOverlay(ctx: CanvasRenderingContext2D): void {
    const fade = clamp(this.sim.powerTimer / 0.5, 0, 1) * clamp((POWER_TUNING.slowmo.duration - this.sim.powerTimer) / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.16 * fade;
    ctx.fillStyle = '#6fe3ff';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    // Pyyhkäisyviivat: digitaalinen hidastus näkyy heti.
    ctx.globalAlpha = 0.1 * fade;
    ctx.fillStyle = '#ffffff';
    const offset = (this.elapsed * 120) % 12;
    for (let y = offset; y < VIRTUAL_H; y += 12) ctx.fillRect(0, y, VIRTUAL_W, 3);
    ctx.restore();
  }

  private drawGoal(ctx: CanvasRenderingContext2D, camera: number): void {
    const x = this.sim.level.goalX - camera;
    if (x > VIRTUAL_W + 400 || x < -400) return;
    const theme = this.destination.theme;
    ctx.save();
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x - 12, GROUND_Y - 470, 22, 470);
    ctx.fillRect(x + 300, GROUND_Y - 470, 22, 470);
    ctx.fillStyle = PALETTE.tealDeep;
    roundRect(ctx, x - 30, GROUND_Y - 520, 372, 120, 16);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFont(ctx, this.destination.name, 330, 'display', 52);
    ctx.fillText(this.destination.name, x + 156, GROUND_Y - 458);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life * 1.6, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const strings = t();
    const theme = this.destination.theme;
    const progress = this.sim.progress;

    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, 'rgba(4, 32, 29, 0.78)');
    gradient.addColorStop(1, 'rgba(4, 32, 29, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIRTUAL_W, 150);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = STRENGTH_COLORS[this.destination.strength];
    roundRect(ctx, 60, 44, 14, 46, 7);
    ctx.fill();
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('display', 40);
    ctx.fillText(this.destination.name, 92, 56);
    ctx.font = font('body', 24);
    ctx.globalAlpha = 0.8;
    ctx.fillText(`${this.destination.city} · ${strings.strengths[this.destination.strength]}`, 92, 92);
    ctx.globalAlpha = 1;

    // Edistymispalkki
    const barX = 700;
    const barW = 720;
    ctx.fillStyle = 'rgba(246, 243, 230, 0.22)';
    roundRect(ctx, barX, 54, barW, 26, 13);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    roundRect(ctx, barX, 54, Math.max(26, barW * progress), 26, 13);
    ctx.fill();
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('bold', 24);
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.round(progress * this.destination.goalDistance)} / ${this.destination.goalDistance} ${strings.metres}`,
      barX + barW / 2,
      104,
    );

    // Kerätyt kuutiot
    const image = this.game.assets.token;
    ctx.drawImage(image, VIRTUAL_W - 220, 32, 64, 64);
    ctx.textAlign = 'left';
    ctx.font = font('bold', 36);
    ctx.fillText(`${this.sim.tokensTaken} / ${this.sim.level.tokenCount}`, VIRTUAL_W - 146, 66);

    // Ohjausvihjeet häivytetään, kun pelaaja on päässyt alkuun.
    const hintAlpha = clamp(1 - (this.elapsed - HINT_SECONDS) / 2, 0, 1);
    if (hintAlpha > 0) {
      ctx.globalAlpha = hintAlpha;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.paper;
      ctx.font = font('bold', 28);
      ctx.fillText(strings.jumpHint, 60, VIRTUAL_H - 96);
      ctx.globalAlpha = hintAlpha * 0.75;
      ctx.font = font('body', 25);
      ctx.fillText(strings.powerHint, 60, VIRTUAL_H - 54);
    }
    ctx.restore();

    const photo = this.backdrop.photoCredit;
    if (photo) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = PALETTE.paper;
      ctx.font = font('body', 18);
      ctx.textAlign = 'right';
      ctx.fillText(`${strings.photo}: ${photo}`, VIRTUAL_W - 270, VIRTUAL_H - 20);
      ctx.restore();
    }
  }

  private drawPowerButton(ctx: CanvasRenderingContext2D): void {
    const strings = t();
    const kind: PowerKind = this.sim.power;
    const { x, r } = POWER_BUTTON;
    const charges = this.sim.charges;
    const active = this.sim.activePower !== null;
    const ready = charges > 0 && !active && this.phase !== 'end';
    const accent = this.destination.theme.accent;
    const shakeX = this.noChargeTimer > 0 ? Math.sin(this.noChargeTimer * 40) * 10 * this.noChargeTimer : 0;
    // Valmis voima sykkii, jotta se huomataan.
    const pulse = ready ? 1 + Math.sin(this.elapsed * 5) * 0.04 : 1;
    const bx = x + shakeX;
    const by = POWER_BUTTON.y;

    ctx.save();
    shadow(ctx, 24, 0.45);
    ctx.fillStyle = ready || active ? accent : 'rgba(40, 52, 50, 0.9)';
    ctx.beginPath();
    ctx.arc(bx, by, r * pulse, 0, Math.PI * 2);
    ctx.fill();
    clearShadow(ctx);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.stroke();

    if (active) {
      // Jäljellä oleva kesto kaarena napin ympärillä.
      const total = POWER_TUNING[this.sim.activePower as 'shield' | 'rocket' | 'slowmo'].duration;
      const left = clamp(this.sim.powerTimer / total, 0, 1);
      ctx.strokeStyle = PALETTE.paper;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(bx, by, r + 14, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      ctx.stroke();
    }

    drawPowerIcon(ctx, kind, bx, by - 12, 78, ready || active ? PALETTE.ink : 'rgba(246,243,230,0.55)');

    // Varaukset pisteinä napin alareunassa.
    for (let i = 0; i < POWER.maxCharges; i++) {
      const px = bx + (i - (POWER.maxCharges - 1) / 2) * 26;
      ctx.beginPath();
      ctx.arc(px, by + 50, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < charges ? (ready || active ? PALETTE.ink : accent) : 'rgba(0,0,0,0.25)';
      ctx.fill();
    }

    // Voiman nimi ja kuvaus napin vasemmalla puolella.
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('bold', 30);
    ctx.fillText(strings.powers[kind].name, bx - r - 24, by - 16);
    ctx.globalAlpha = 0.75;
    ctx.font = font('body', 24);
    ctx.fillText(strings.powers[kind].desc, bx - r - 24, by + 20);
    ctx.globalAlpha = 1;

    if (this.noChargeTimer > 0) {
      ctx.globalAlpha = clamp(this.noChargeTimer, 0, 1);
      this.drawBubble(ctx, strings.noCharge, bx - 60, by - r - 84, PALETTE.coral);
    } else if (
      ready &&
      this.sim.powersUsed === 0 &&
      this.phase === 'run' &&
      this.elapsed > 5 &&
      this.elapsed < 11
    ) {
      this.drawBubble(ctx, strings.tryPower, bx - 90, by - r - 84, accent);
    }
    ctx.restore();
  }

  private drawBubble(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, color: string): void {
    ctx.save();
    ctx.font = font('bold', 30);
    const w = ctx.measureText(text).width + 44;
    const x = Math.min(cx - w / 2, VIRTUAL_W - w - 20);
    ctx.fillStyle = color;
    roundRect(ctx, x, cy - 30, w, 60, 18);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, cy + 1);
    ctx.restore();
  }

  /** Ensimmäisen esteen kohdalla näytetään kehotus, jos pelaaja ei ole vielä hypännyt. */
  private drawJumpPrompt(ctx: CanvasRenderingContext2D, camera: number): void {
    if (this.phase !== 'run' || this.sim.jumps > 0 || this.sim.invulnerable) return;
    const px = this.sim.player.worldX;
    const next = this.sim.level.obstacles.find((o) => o.x > px && !o.grown && !o.hit);
    if (!next || next.x - px > 700) return;
    const x = next.x + next.w / 2 - camera;
    const bounce = Math.abs(Math.sin(this.elapsed * 6)) * 18;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    shadow(ctx, 16, 0.6);
    ctx.fillStyle = PALETTE.yellow;
    ctx.font = font('display', 64);
    ctx.fillText(t().jumpPrompt, x, GROUND_Y - next.h - 150 - bounce);
    clearShadow(ctx);
    ctx.beginPath();
    ctx.moveTo(x - 24, GROUND_Y - next.h - 96 - bounce);
    ctx.lineTo(x + 24, GROUND_Y - next.h - 96 - bounce);
    ctx.lineTo(x, GROUND_Y - next.h - 60 - bounce);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawIntro(ctx: CanvasRenderingContext2D): void {
    const alpha = clamp(1 - (this.phaseTimer - INTRO_SECONDS * 0.6) / (INTRO_SECONDS * 0.4), 0, 1);
    const strings = t();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(4, 32, 29, 0.6)';
    ctx.fillRect(0, 340, VIRTUAL_W, 330);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    shadow(ctx, 18, 0.5);
    ctx.fillStyle = PALETTE.paper;
    fitFont(ctx, localized(this.destination.longName), VIRTUAL_W - 160, 'display', 88);
    ctx.fillText(localized(this.destination.longName), VIRTUAL_W / 2, 440);
    clearShadow(ctx);
    ctx.fillStyle = this.destination.theme.accent;
    ctx.font = font('bold', 44);
    ctx.fillText(`${this.destination.city}, ${localized(this.destination.country)}`, VIRTUAL_W / 2, 530);
    ctx.fillStyle = PALETTE.paper;
    ctx.globalAlpha = alpha * 0.8;
    ctx.font = font('body', 30);
    ctx.fillText(
      `${strings.scenery}: ${localized(this.destination.landmark.name)}`,
      VIRTUAL_W / 2,
      606,
    );
    ctx.restore();
  }

  private drawIdleCountdown(ctx: CanvasRenderingContext2D): void {
    const left = this.game.idleCountdown();
    if (left === null) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.paper;
    ctx.globalAlpha = 0.85;
    ctx.font = font('bold', 30);
    ctx.fillText(`${t().idleWarning} ${Math.ceil(left)} s`, VIRTUAL_W / 2, VIRTUAL_H - 46);
    ctx.restore();
  }
}
