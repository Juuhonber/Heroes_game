import type { GameState } from '../core/GameState';
import type { Game } from '../core/Game';
import { VIRTUAL_H, VIRTUAL_W } from '../core/Game';
import type { InputEvent } from '../core/Input';
import { Animator } from '../core/Animator';
import { clamp, overlaps } from '../core/math';
import { Level } from '../game/Level';
import { Player } from '../game/Player';
import { Backdrop, backdropFor } from '../game/Backdrop';
import { GROUND_Y, PIXELS_PER_METRE, PLAYER_SCREEN_X, POWER } from '../game/constants';
import type { Destination } from '../data/destinations';
import { STRENGTH_COLORS } from '../data/destinations';
import { PALETTE, clearShadow, font, roundRect, shadow } from '../ui/theme';
import { localized, t } from '../ui/strings';

export interface PlayPayload {
  id: string;
}

export interface RunResult {
  id: string;
  success: boolean;
  distance: number;
  tokens: number;
  tokenTotal: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

type Phase = 'intro' | 'run' | 'crashing' | 'finishing';

const INTRO_SECONDS = 1.4;
const CRASH_SECONDS = 1.1;
const FINISH_SECONDS = 1.0;
const HINT_SECONDS = 7;

export class PlayState implements GameState {
  readonly name = 'play';

  private destination!: Destination;
  private level!: Level;
  private backdrop!: Backdrop;
  private player!: Player;
  private phase: Phase = 'intro';
  private phaseTimer = 0;
  private elapsed = 0;
  private tokensTaken = 0;
  private particles: Particle[] = [];
  private shake = 0;
  private game!: Game;

  enter(game: Game, payload?: unknown): void {
    this.game = game;
    const id = (payload as PlayPayload | undefined)?.id ?? game.assets.destinations[0]!.id;
    this.destination = game.destination(id);
    this.level = new Level(this.destination);
    this.backdrop = backdropFor(this.destination, null);
    this.player = new Player(new Animator(game.assets.clips, 'run'));
    this.player.reset();
    this.phase = 'intro';
    this.phaseTimer = 0;
    this.elapsed = 0;
    this.tokensTaken = 0;
    this.particles = [];
    this.shake = 0;
  }

  blocksIdleReset(): boolean {
    // Kesken juoksun ei palata kartalle: pelaaja on selvästi läsnä.
    return this.phase === 'run' && this.game.input.idleSeconds < 25;
  }

  update(dt: number, events: readonly InputEvent[]): void {
    this.elapsed += dt;
    this.phaseTimer += dt;
    this.shake = Math.max(0, this.shake - dt * 3);

    if (this.phase === 'run' || this.phase === 'finishing') this.handleInput(events);

    if (this.phase === 'intro' && this.phaseTimer >= INTRO_SECONDS) {
      this.phase = 'run';
      this.phaseTimer = 0;
    }

    const frozen = this.phase === 'intro' || this.phase === 'crashing';
    const groundY = this.level.groundAt(this.player.worldX);
    this.player.update(dt, groundY, frozen);

    if (this.phase === 'run') {
      this.checkTokens();
      this.checkCollisions();
      if (this.player.worldX >= this.level.goalX) {
        this.phase = 'finishing';
        this.phaseTimer = 0;
        this.burst(PLAYER_SCREEN_X, GROUND_Y - 180, this.destination.theme.accent, 40);
      }
    }

    if (this.phase === 'crashing' && this.phaseTimer >= CRASH_SECONDS) this.finish(false);
    if (this.phase === 'finishing' && this.phaseTimer >= FINISH_SECONDS) this.finish(true);

    this.updateParticles(dt);
  }

  private handleInput(events: readonly InputEvent[]): void {
    for (const event of events) {
      if (event.action === 'primary') {
        if (event.type === 'press') this.player.requestJump();
        else this.player.releaseJump();
      } else if (event.action === 'secondary' && event.type === 'press') {
        if (this.player.usePower()) {
          this.burst(PLAYER_SCREEN_X, GROUND_Y - 110, this.destination.theme.accent, 22);
        }
      }
    }
  }

  private checkTokens(): void {
    for (const token of this.level.tokens) {
      if (token.taken) continue;
      const dx = token.x - this.player.worldX;
      const dy = token.y - (this.player.y - 70);
      if (Math.abs(dx) < 80 && Math.abs(dy) < 90) {
        token.taken = true;
        this.tokensTaken += 1;
        this.player.addCharge();
        this.burst(token.x - this.cameraX, token.y, '#c9e35a', 14);
      }
    }
  }

  private checkCollisions(): void {
    const box = this.player.hitbox;

    if (this.player.y > GROUND_Y + 140) {
      this.crash();
      return;
    }

    for (const obstacle of this.level.obstacles) {
      if (obstacle.hit) continue;
      if (obstacle.x + obstacle.w < this.player.worldX - 200) continue;
      if (obstacle.x > this.player.worldX + 400) break;
      if (!overlaps(box, this.level.obstacleRect(obstacle))) continue;
      if (this.player.shielded) {
        obstacle.hit = true;
        this.burst(obstacle.x - this.cameraX + obstacle.w / 2, GROUND_Y - obstacle.h / 2, this.destination.theme.accent, 26);
        this.shake = 0.5;
      } else {
        this.crash();
      }
      return;
    }
  }

  private crash(): void {
    this.phase = 'crashing';
    this.phaseTimer = 0;
    this.shake = 1;
    this.player.crash();
    this.burst(PLAYER_SCREEN_X, GROUND_Y - 120, '#ff7a59', 30);
  }

  private finish(success: boolean): void {
    const result: RunResult = {
      id: this.destination.id,
      success,
      distance: Math.round(Math.min(this.player.worldX, this.level.goalX) / PIXELS_PER_METRE),
      tokens: this.tokensTaken,
      tokenTotal: this.level.tokenCount,
    };
    this.game.transitionTo('result', result);
  }

  private get cameraX(): number {
    return this.player.worldX - PLAYER_SCREEN_X;
  }

  private burst(x: number, y: number, color: string, count: number): void {
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
      });
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 1400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const camera = this.cameraX;
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 14;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.backdrop.drawSky(ctx, camera, this.elapsed);
    this.backdrop.drawLayers(ctx, camera);
    this.backdrop.drawGround(ctx, camera, this.level.pits);

    this.drawGoal(ctx, camera);
    this.drawObstacles(ctx, camera);
    this.drawTokens(ctx, camera);
    this.player.draw(ctx, PLAYER_SCREEN_X, this.destination.theme.accent);
    this.drawParticles(ctx);
    ctx.restore();

    this.drawHud(ctx);
    if (this.phase === 'intro') this.drawIntro(ctx);
    this.drawIdleCountdown(ctx);
  }

  private drawObstacles(ctx: CanvasRenderingContext2D, camera: number): void {
    const theme = this.destination.theme;
    for (const o of this.level.obstacles) {
      const x = o.x - camera;
      if (x > VIRTUAL_W + 100 || x + o.w < -100) continue;
      const y = GROUND_Y - o.h;
      const depth = 16;
      ctx.save();
      if (o.hit) {
        ctx.globalAlpha = 0.25;
        ctx.translate(0, 26);
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
      ctx.fillRect(x + 10, y + o.h * 0.34, o.w - 20, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 4;
      roundRect(ctx, x, y, o.w, o.h, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawTokens(ctx: CanvasRenderingContext2D, camera: number): void {
    const image = this.game.assets.token;
    for (const token of this.level.tokens) {
      if (token.taken) continue;
      const x = token.x - camera;
      if (x > VIRTUAL_W + 80 || x < -80) continue;
      const bob = Math.sin(this.elapsed * 3 + token.x * 0.01) * 12;
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

  private drawGoal(ctx: CanvasRenderingContext2D, camera: number): void {
    const x = this.level.goalX - camera;
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
    ctx.font = font('display', 52);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
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
    const progress = clamp(this.player.worldX / this.level.goalX, 0, 1);

    ctx.save();
    // Ylärivin tausta
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
    ctx.fillText(
      `${this.destination.city} · ${strings.strengths[this.destination.strength]}`,
      92,
      92,
    );
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

    // Kuutiot ja voimavaraukset
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('bold', 30);
    ctx.fillText(`${this.tokensTaken} / ${this.level.tokenCount}`, VIRTUAL_W - 70, 52);
    for (let i = 0; i < POWER.maxCharges; i++) {
      const cx = VIRTUAL_W - 70 - i * 46;
      ctx.beginPath();
      ctx.arc(cx, 100, 17, 0, Math.PI * 2);
      ctx.fillStyle = i < this.player.charges ? theme.accent : 'rgba(246, 243, 230, 0.22)';
      ctx.fill();
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
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawIntro(ctx: CanvasRenderingContext2D): void {
    const alpha = clamp(1 - (this.phaseTimer - INTRO_SECONDS * 0.6) / (INTRO_SECONDS * 0.4), 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(4, 32, 29, 0.55)';
    ctx.fillRect(0, 360, VIRTUAL_W, 300);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    shadow(ctx, 18, 0.5);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('display', 92);
    ctx.fillText(localized(this.destination.longName), VIRTUAL_W / 2, 470);
    clearShadow(ctx);
    ctx.fillStyle = this.destination.theme.accent;
    ctx.font = font('bold', 44);
    ctx.fillText(
      `${this.destination.city}, ${localized(this.destination.country)}`,
      VIRTUAL_W / 2,
      560,
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
