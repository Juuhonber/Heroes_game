import type { GameState } from '../core/GameState';
import type { Game } from '../core/Game';
import { VIRTUAL_H, VIRTUAL_W } from '../core/Game';
import type { InputEvent } from '../core/Input';
import { Animator } from '../core/Animator';
import { approach, clamp } from '../core/math';
import { RunSim } from '../game/RunSim';
import type { SimEvent } from '../game/RunSim';
import { Backdrop } from '../game/Backdrop';
import {
  BLOCK,
  GROUND_Y,
  MODULE_CREDITS,
  ORB_RADIUS,
  PLAYER_SCREEN_X,
  PLAYER_SIZE,
  POWER,
  POWER_TUNING,
} from '../game/constants';
import type { Destination } from '../data/destinations';
import { STRENGTH_COLORS } from '../data/destinations';
import { PALETTE, clearShadow, fitFont, font, roundRect, shadow } from '../ui/theme';
import { localized, t } from '../ui/strings';
import { drawPowerIcon } from '../ui/icons';
import { creditSprite, moduleSprite } from '../ui/pickups';
import type { PowerKind } from '../game/powers';

export interface PlayPayload {
  id: string;
}

export interface RunResult {
  id: string;
  success: boolean;
  distance: number;
  credits: number;
  creditTotal: number;
  modules: number;
  moduleTotal: number;
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
const CRASH_SECONDS = 1.0;
const FINISH_SECONDS = 1.0;
const HINT_SECONDS = 7;

/**
 * Voimanappi: iso kosketusalue oikeassa alakulmassa, kokonaan maanpinnan
 * alapuolella, jottei se peitä oikealta saapuvia esteitä.
 */
const POWER_BUTTON = { x: 1800, y: 978, r: 84 };

/** Kamera nousee, kun pelaaja on tätä korkeammalla maasta (ylemmät reitit). */
const CAMERA_LIFT_FROM = 380;

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
  private camY = 0;
  /** Venytys ponnistaessa (+) ja puristus laskeutuessa (-), vaimenee nopeasti. */
  private squash = 0;
  private moduleFlash = 0;

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
    this.camY = 0;
    this.squash = 0;
    this.moduleFlash = 0;
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
    this.moduleFlash = Math.max(0, this.moduleFlash - dt);
    this.squash = approach(this.squash, 0, 14, dt);
    this.applyPhoto();

    if (this.phase === 'intro') {
      // Intron aikana painallus ohittaa esittelyn.
      if (events.some((e) => e.type === 'press')) this.phaseTimer = INTRO_SECONDS;
      if (this.phaseTimer >= INTRO_SECONDS) {
        this.phase = 'run';
        this.phaseTimer = 0;
      }
      this.anim.update(dt * 0.5);
      return;
    }

    if (this.phase === 'run') this.routeInput(events);

    for (const event of this.sim.step(dt)) this.onSimEvent(event);

    if (this.phase === 'end') {
      const wait = this.sim.phase === 'finished' ? FINISH_SECONDS : CRASH_SECONDS;
      if (this.phaseTimer >= wait) this.finish();
    }

    const scaled = dt * this.sim.timeScale;
    this.updateAnimation(scaled);
    if (this.sim.activePower === 'rocket') this.emitRocketExhaust();
    this.updateParticles(scaled);
    this.updateCamera(dt);
  }

  /** Voimanapin kohdalla painallus käyttää voiman, muualla se on hyppy. */
  private routeInput(events: readonly InputEvent[]): void {
    for (const event of events) {
      if (event.action === 'primary' && event.type === 'release') {
        this.sim.setHolding(false);
        continue;
      }
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
      this.sim.setHolding(true);
    }
  }

  private onSimEvent(event: SimEvent): void {
    const accent = this.destination.theme.accent;
    switch (event.type) {
      case 'jump':
        this.squash = 1;
        break;
      case 'land':
        this.squash = -0.8;
        this.burst(PLAYER_SCREEN_X, this.sim.player.y, 'rgba(255,255,255,0.55)', 5, 600, 0.35);
        break;
      case 'pad':
        this.squash = 1.3;
        this.burst(this.toScreen(event.x), event.y, '#ffd84a', 18, 900);
        break;
      case 'orb':
        this.squash = 1;
        this.burst(this.toScreen(event.x), event.y, '#ffd84a', 22, 600);
        break;
      case 'credit':
        this.burst(this.toScreen(event.x), event.y, '#f5d24a', 12, 1200);
        break;
      case 'module':
        this.moduleFlash = 2.2;
        this.burst(this.toScreen(event.x), event.y, STRENGTH_COLORS[this.destination.strength], 40, 900);
        this.burst(this.toScreen(event.x), event.y, '#ffffff', 20, 900);
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
        this.burst(PLAYER_SCREEN_X, this.sim.player.y - 80, PALETTE.coral, 34, 1400);
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

  /**
   * Juoksuanimaation tahti sovitetaan vauhtiin: yhden syklin aikana hahmo
   * etenee askelpituuden verran, jolloin jalat eivät liu'u maata pitkin.
   */
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
      this.anim.setFrame(p.vy < 120 ? 0 : 1);
    } else {
      this.anim.play('run');
      const clip = this.anim.clip;
      const scale = PLAYER_SIZE.drawHeight / clip.sheet.frameHeight;
      const fps = clip.cyclePx ? (clip.sheet.frameCount * p.speed) / (clip.cyclePx * scale) : clip.fps;
      this.anim.update(dt, fps);
    }
  }

  /** Kamera seuraa pehmeästi ylös, kun pelaaja kiipeää ylemmille reiteille. */
  private updateCamera(dt: number): void {
    const height = GROUND_Y - this.sim.player.y;
    const target = Math.max(0, height - CAMERA_LIFT_FROM) * 0.6;
    this.camY = approach(this.camY, target, 5, dt);
  }

  private finish(): void {
    const success = this.sim.phase === 'finished';
    if (success) this.game.stamps.add(this.destination.id);
    if (this.sim.modules > 0) this.game.modules.add(this.destination.id);
    this.game.sessionCredits += this.sim.totalCredits;
    const level = this.sim.level;
    const result: RunResult = {
      id: this.destination.id,
      success,
      distance: this.sim.distanceMetres,
      credits: this.sim.credits,
      creditTotal: level.creditTotal,
      modules: this.sim.modules,
      moduleTotal: level.moduleTotal,
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

  private burst(x: number, y: number, color: string, count: number, gravity: number, speedScale = 1): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (120 + Math.random() * 420) * speedScale;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 160 * speedScale,
        life: 0.5 + Math.random() * 0.5,
        size: 6 + Math.random() * 12,
        color,
        gravity,
      });
    }
    if (this.particles.length > 360) this.particles.splice(0, this.particles.length - 360);
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
    let alive = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.particles[alive++] = p;
    }
    this.particles.length = alive;
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
    ctx.save();
    // Taivas pysyy paikallaan; maailma laskeutuu, kun kamera nousee.
    ctx.translate(0, Math.round(this.camY));
    this.backdrop.drawLayers(ctx, camera);
    this.backdrop.drawGround(ctx, camera, this.sim.level.pits);
    this.drawBridges(ctx, camera);
    this.drawGoal(ctx, camera);
    this.drawBlocks(ctx, camera);
    this.drawSpikes(ctx, camera);
    this.drawPads(ctx, camera);
    this.drawOrbs(ctx, camera);
    this.drawSigns(ctx, camera);
    this.drawPickups(ctx, camera);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);
    this.drawJumpPrompt(ctx, camera);
    ctx.restore();
    ctx.restore();

    if (this.sim.activePower === 'slowmo') this.drawSlowmoOverlay(ctx);
    this.drawHud(ctx);
    this.drawPowerButton(ctx);
    this.drawModuleBanner(ctx);
    if (this.phase === 'intro') this.drawIntro(ctx);
    this.drawIdleCountdown(ctx);
  }

  private visible(x: number, w: number): boolean {
    return x < VIRTUAL_W + 80 && x + w > -80;
  }

  private drawBridges(ctx: CanvasRenderingContext2D, camera: number): void {
    for (const pit of this.sim.level.pits) {
      if (!pit.bridged) continue;
      const x = pit.x - camera;
      if (!this.visible(x, pit.w)) continue;
      // Kasvuvoiman silta: lehvästö täyttää kuopan.
      ctx.fillStyle = '#2f7a3a';
      ctx.fillRect(x - 6, GROUND_Y, pit.w + 12, 30);
      ctx.fillStyle = '#7ee08a';
      for (let i = 0; i <= pit.w; i += 26) {
        ctx.beginPath();
        ctx.ellipse(x + i, GROUND_Y + 4, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Palikat Geometry Dashin tapaan: tumma täyttö, kirkas reunaviiva ja
   * ruudukko, joka toistaa maskotin kuutiokuviota.
   */
  private drawBlocks(ctx: CanvasRenderingContext2D, camera: number): void {
    const accent = this.destination.theme.accent;
    for (const b of this.sim.level.blocks) {
      const x = Math.round(b.x - camera);
      if (!this.visible(x, b.w)) continue;
      ctx.save();
      if (b.hit) {
        ctx.globalAlpha = 0.18;
        ctx.translate(0, 30);
      }
      ctx.fillStyle = '#121c1b';
      ctx.fillRect(x, b.top, b.w, b.h);
      ctx.strokeStyle = hexAlpha(accent, 0.22);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let gx = x + BLOCK; gx < x + b.w - 1; gx += BLOCK) {
        ctx.moveTo(gx, b.top + 3);
        ctx.lineTo(gx, b.top + b.h - 3);
      }
      for (let gy = b.top + BLOCK; gy < b.top + b.h - 1; gy += BLOCK) {
        ctx.moveTo(x + 3, gy);
        ctx.lineTo(x + b.w - 3, gy);
      }
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, b.top + 2, b.w - 4, b.h - 4);
      // Kirkas yläpinta kertoo, että päälle voi laskeutua.
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha *= 0.55;
      ctx.fillRect(x + 4, b.top + 2, b.w - 8, 4);
      ctx.restore();
    }
  }

  private drawSpikes(ctx: CanvasRenderingContext2D, camera: number): void {
    const accent = this.destination.theme.accent;
    for (const s of this.sim.level.spikes) {
      const x = Math.round(s.x - camera);
      if (!this.visible(x, BLOCK)) continue;
      if (s.grown) {
        this.drawBush(ctx, x, s.base);
        continue;
      }
      ctx.save();
      if (s.hit) {
        ctx.globalAlpha = 0.18;
        ctx.translate(0, 26);
      }
      ctx.beginPath();
      ctx.moveTo(x + 4, s.base);
      ctx.lineTo(x + BLOCK / 2, s.base - BLOCK + 4);
      ctx.lineTo(x + BLOCK - 4, s.base);
      ctx.closePath();
      ctx.fillStyle = '#121c1b';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 20, s.base - 6);
      ctx.lineTo(x + BLOCK / 2, s.base - BLOCK + 26);
      ctx.lineTo(x + BLOCK - 20, s.base - 6);
      ctx.closePath();
      ctx.fillStyle = hexAlpha(accent, 0.25);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBush(ctx: CanvasRenderingContext2D, x: number, base: number): void {
    ctx.fillStyle = '#2f7a3a';
    ctx.beginPath();
    ctx.ellipse(x + BLOCK / 2, base, BLOCK / 2 + 8, 38, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ee08a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 12 + i * 18, base - 28 + (i % 2) * 8, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPads(ctx: CanvasRenderingContext2D, camera: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 8);
    for (const pad of this.sim.level.pads) {
      const x = Math.round(pad.x - camera);
      if (!this.visible(x, BLOCK)) continue;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.2 * pulse;
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath();
      ctx.ellipse(x + BLOCK / 2, pad.surface - 4, 44, 26, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd84a';
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x + BLOCK / 2, pad.surface, BLOCK / 2, 14, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Nuolet ylös: levy lennättää korkealle.
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const y = pad.surface - 34 - i * 22 - pulse * 8;
        ctx.globalAlpha = 0.9 - i * 0.35;
        ctx.beginPath();
        ctx.moveTo(x + BLOCK / 2 - 14, y + 10);
        ctx.lineTo(x + BLOCK / 2, y);
        ctx.lineTo(x + BLOCK / 2 + 14, y + 10);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawOrbs(ctx: CanvasRenderingContext2D, camera: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 7);
    for (const orb of this.sim.level.orbs) {
      const x = orb.x - camera;
      if (!this.visible(x - ORB_RADIUS, ORB_RADIUS * 2)) continue;
      ctx.save();
      ctx.globalAlpha = orb.used ? 0.35 : 1;
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 3;
      ctx.globalAlpha *= 0.6 - pulse * 0.4;
      ctx.beginPath();
      ctx.arc(x, orb.y, ORB_RADIUS + 6 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = orb.used ? 0.35 : 1;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(x, orb.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(x, orb.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Ohjekyltti ensimmäisen pomppulevyn, renkaan ja reittivalinnan kohdalla. */
  private drawSigns(ctx: CanvasRenderingContext2D, camera: number): void {
    const strings = t();
    for (const sign of this.sim.level.signs) {
      const x = sign.x - camera;
      if (!this.visible(x - 200, 400)) continue;
      const text = sign.kind === 'fork' ? `▲ ${strings.signs.fork}` : strings.signs[sign.kind];
      ctx.save();
      ctx.font = font('bold', 28);
      const w = ctx.measureText(text).width + 40;
      const bob = Math.sin(this.elapsed * 3) * 5;
      ctx.fillStyle = sign.kind === 'fork' ? STRENGTH_COLORS[this.destination.strength] : '#ffd84a';
      roundRect(ctx, x - w / 2, sign.y - 26 + bob, w, 52, 14);
      ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, sign.y + 1 + bob);
      ctx.restore();
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, camera: number): void {
    const strings = t();
    const credit = creditSprite(strings.creditUnit);
    const module = moduleSprite(
      STRENGTH_COLORS[this.destination.strength],
      `${MODULE_CREDITS} ${strings.creditUnit}`,
    );
    for (const p of this.sim.level.pickups) {
      if (p.taken) continue;
      const x = p.x - camera;
      if (!this.visible(x - 70, 140)) continue;
      const bob = Math.sin(this.elapsed * 3 + p.x * 0.01) * 6;
      if (p.kind === 'credit') {
        // Kolikko pyörii: leveys vaihtelee kuin kääntyvällä kolikolla.
        const spin = Math.abs(Math.cos(this.elapsed * 2.4 + p.x * 0.02));
        const w = 74 * (0.6 + 0.4 * spin);
        ctx.drawImage(credit, x - w / 2, p.y + bob - 37, w, 74);
      } else {
        ctx.save();
        ctx.translate(x, p.y + bob);
        // Hehkuva sädekehä: harvinainen palkinto erottuu kauas.
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = STRENGTH_COLORS[this.destination.strength];
        ctx.beginPath();
        ctx.arc(0, 0, 66 + Math.sin(this.elapsed * 4) * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 12]);
        ctx.rotate(this.elapsed * 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.rotate(-this.elapsed * 1.5);
        ctx.drawImage(module, -60, -55, 120, 110);
        ctx.restore();
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.sim.player;
    const x = PLAYER_SCREEN_X;
    const accent = this.destination.theme.accent;

    // Varjo pinnalle, jonka yläpuolella pelaaja on.
    const shadowY = this.surfaceBelow();
    const height = shadowY - p.y;
    const shrink = clamp(1 - height / 700, 0.3, 1);
    ctx.save();
    ctx.globalAlpha = 0.25 * shrink;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, shadowY + 6, 58 * shrink, 13 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.sim.activePower === 'rocket') this.drawRocketFlame(ctx, x, p.y);

    // Venytys ja puristus jalkojen ympäri sekä kallistus ilmassa.
    const s = this.squash;
    const sx = 1 - s * 0.1;
    const sy = 1 + s * 0.12;
    const tilt = p.mode === 'hurt' ? -0.25 : p.onGround ? 0 : clamp(p.vy / 1600, -1, 1) * 0.12;
    ctx.save();
    ctx.translate(x, p.y);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);
    this.anim.drawAnchored(ctx, 0, 0, PLAYER_SIZE.drawHeight);
    ctx.restore();

    if (this.sim.activePower === 'shield') this.drawShield(ctx, x, p.y, accent);
  }

  /** Lähin pinta pelaajan alla varjoa varten. */
  private surfaceBelow(): number {
    const p = this.sim.player;
    let surface = this.sim.level.isOverPit(p.worldX) ? Infinity : GROUND_Y;
    for (const b of this.sim.level.blocks) {
      if (b.hit || p.worldX < b.x || p.worldX > b.x + b.w) continue;
      if (b.top >= p.y - 1) surface = Math.min(surface, b.top);
    }
    return Number.isFinite(surface) ? surface : GROUND_Y + 400;
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life * 1.6, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
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

    // Edistyminen prosentteina kuten Geometry Dashissa.
    const barX = 640;
    const barW = 640;
    ctx.fillStyle = 'rgba(246, 243, 230, 0.22)';
    roundRect(ctx, barX, 54, barW, 24, 12);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    roundRect(ctx, barX, 54, Math.max(24, barW * progress), 24, 12);
    ctx.fill();
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('bold', 26);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(progress * 100)} %`, barX + barW / 2, 104);

    // Opintopisteet ja oppimiskokonaisuuden paikka.
    const credit = creditSprite(strings.creditUnit);
    ctx.drawImage(credit, VIRTUAL_W - 420, 30, 56, 56);
    ctx.textAlign = 'left';
    ctx.font = font('display', 38);
    ctx.fillText(`${this.sim.totalCredits} ${strings.creditUnit}`, VIRTUAL_W - 352, 60);

    const slotX = VIRTUAL_W - 150;
    if (this.sim.modules > 0) {
      const pop = 1 + Math.max(0, this.moduleFlash - 1.4) * 0.6;
      const w = 92 * pop;
      ctx.drawImage(
        moduleSprite(STRENGTH_COLORS[this.destination.strength], `${MODULE_CREDITS} ${strings.creditUnit}`),
        slotX - w / 2 + 30,
        58 - w * 0.46,
        w,
        w * 0.92,
      );
    } else {
      ctx.strokeStyle = 'rgba(246, 243, 230, 0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 7]);
      roundRect(ctx, slotX - 2, 30, 64, 56, 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(246, 243, 230, 0.45)';
      ctx.font = font('display', 30);
      ctx.textAlign = 'center';
      ctx.fillText('?', slotX + 30, 60);
    }

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

  /** Oppimiskokonaisuuden keräämisestä näkyvä ilmoitus. */
  private drawModuleBanner(ctx: CanvasRenderingContext2D): void {
    if (this.moduleFlash <= 0) return;
    const strings = t();
    const alpha = clamp(this.moduleFlash / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = `${strings.module} +${MODULE_CREDITS} ${strings.creditUnit}`;
    ctx.font = font('display', 46);
    const w = ctx.measureText(text).width + 70;
    ctx.fillStyle = STRENGTH_COLORS[this.destination.strength];
    shadow(ctx, 20, 0.5);
    roundRect(ctx, VIRTUAL_W / 2 - w / 2, 168, w, 84, 22);
    ctx.fill();
    clearShadow(ctx);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(text, VIRTUAL_W / 2, 212);
    ctx.restore();
  }

  /** Ensimmäisen vaaran kohdalla näytetään kehotus, jos pelaaja ei ole vielä hypännyt. */
  private drawJumpPrompt(ctx: CanvasRenderingContext2D, camera: number): void {
    if (this.phase !== 'run' || this.sim.jumps > 0 || this.sim.invulnerable) return;
    const level = this.sim.level;
    const px = this.sim.player.worldX;
    const ahead = [
      ...level.spikes.filter((s) => !s.grown && !s.hit).map((s) => ({ x: s.x, top: s.base - BLOCK })),
      ...level.blocks.filter((b) => !b.hit).map((b) => ({ x: b.x, top: b.top })),
      ...level.pits.filter((p) => !p.bridged).map((p) => ({ x: p.x, top: GROUND_Y })),
    ]
      .filter((h) => h.x > px)
      .sort((a, b) => a.x - b.x)[0];
    if (!ahead || ahead.x - px > 720) return;
    const x = ahead.x + BLOCK / 2 - camera;
    const bounce = Math.abs(Math.sin(this.elapsed * 6)) * 18;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    shadow(ctx, 16, 0.6);
    ctx.fillStyle = PALETTE.yellow;
    ctx.font = font('display', 64);
    ctx.fillText(t().jumpPrompt, x, ahead.top - 150 - bounce);
    clearShadow(ctx);
    ctx.beginPath();
    ctx.moveTo(x - 24, ahead.top - 96 - bounce);
    ctx.lineTo(x + 24, ahead.top - 96 - bounce);
    ctx.lineTo(x, ahead.top - 60 - bounce);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

function hexAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
