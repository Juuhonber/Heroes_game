import type { GameState } from '../core/GameState';
import type { Game } from '../core/Game';
import { VIRTUAL_H, VIRTUAL_W } from '../core/Game';
import type { InputEvent } from '../core/Input';
import { Button, ButtonGroup } from '../ui/Button';
import { PALETTE, clearShadow, fitFont, font, roundRect, shadow, wrapText } from '../ui/theme';
import { localized, t } from '../ui/strings';
import { STRENGTH_COLORS } from '../data/destinations';
import type { Destination } from '../data/destinations';
import type { RunResult } from './PlayState';
import { clamp, easeOutCubic } from '../core/math';
import { Animator } from '../core/Animator';

const CARD = { x: 300, y: 140, w: 1320, h: 640 };
/** Tekstipalstan leveys: oikea reuna on varattu maskotille. */
const TEXT_W = 860;

/**
 * Palauteruutu: välitön tulos ja lyhyt tietokortti kohteesta sekä
 * kolme selkeää jatkotoimintoa.
 */
export class ResultState implements GameState {
  readonly name = 'result';

  private game!: Game;
  private result!: RunResult;
  private destination!: Destination;
  private buttons = new ButtonGroup();
  private appear = 0;
  private keyboardMode = false;
  private mascot!: Animator;

  enter(game: Game, payload?: unknown): void {
    this.game = game;
    this.result = payload as RunResult;
    this.destination = game.destination(this.result.id);
    this.appear = 0;
    this.keyboardMode = false;
    this.mascot = new Animator(game.assets.clips, this.result.success ? 'idle' : 'hurt');

    const strings = t();
    const w = 360;
    const gap = 30;
    const total = w * 3 + gap * 2;
    const x0 = (VIRTUAL_W - total) / 2;
    const y = CARD.y + CARD.h + 46;
    this.buttons.set([
      new Button({ id: 'retry', label: strings.retry, variant: 'accent', x: x0, y, w, h: 104 }),
      new Button({
        id: 'next',
        label: strings.nextDestination,
        variant: 'primary',
        x: x0 + w + gap,
        y,
        w,
        h: 104,
      }),
      new Button({
        id: 'map',
        label: strings.backToMap,
        variant: 'ghost',
        x: x0 + (w + gap) * 2,
        y,
        w,
        h: 104,
      }),
    ]);
    this.buttons.focus = 0;
  }

  update(dt: number, events: readonly InputEvent[]): void {
    this.appear = Math.min(1, this.appear + dt * 3.2);
    this.mascot.update(dt);
    const pointer = this.game.input.pointer;
    this.buttons.update(dt, pointer.x, pointer.y);
    for (const event of events) this.keyboardMode = !event.pointer;

    const selected = this.buttons.handle(events);
    if (!selected) return;
    if (selected === 'retry') this.game.transitionTo('play', { id: this.destination.id });
    else if (selected === 'next') this.game.transitionTo('play', { id: this.nextId() });
    else this.game.transitionTo('map');
  }

  /** Seuraava kohde listajärjestyksessä, leimaamattomat ensin. */
  private nextId(): string {
    const list = this.game.assets.destinations;
    const index = list.findIndex((d) => d.id === this.destination.id);
    for (let step = 1; step <= list.length; step++) {
      const candidate = list[(index + step) % list.length]!;
      if (!this.game.stamps.has(candidate.id)) return candidate.id;
    }
    return list[(index + 1) % list.length]!.id;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const strings = t();
    const theme = this.destination.theme;
    const success = this.result.success;
    const ease = easeOutCubic(this.appear);

    const bg = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H);
    bg.addColorStop(0, theme.skyTop);
    bg.addColorStop(1, PALETTE.ink);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    ctx.save();
    ctx.translate(0, (1 - ease) * 60);
    ctx.globalAlpha = ease;

    shadow(ctx, 40, 0.45);
    ctx.fillStyle = PALETTE.paper;
    roundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 32);
    ctx.fill();
    clearShadow(ctx);

    // Otsikkopalkki kertoo tuloksen yhdellä silmäyksellä.
    ctx.save();
    roundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 32);
    ctx.clip();
    ctx.fillStyle = success ? theme.accent : PALETTE.coral;
    ctx.fillRect(CARD.x, CARD.y, CARD.w, 132);
    ctx.restore();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = font('display', 58);
    ctx.fillText(success ? strings.success : strings.fail, CARD.x + 52, CARD.y + 66);
    const titleW = ctx.measureText(success ? strings.success : strings.fail).width;
    this.drawStamps(ctx, CARD.x + 52 + titleW + 36, CARD.y + 66);

    ctx.textAlign = 'right';
    ctx.font = font('bold', 34);
    ctx.fillText(
      `${this.result.distance} / ${this.destination.goalDistance} ${strings.metres}  ·  ${strings.tokens} ${this.result.tokens}/${this.result.tokenTotal}`,
      CARD.x + CARD.w - 52,
      CARD.y + 66,
    );

    // Kohteen nimi ja vahvuusalue
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.ink;
    fitFont(ctx, localized(this.destination.longName), TEXT_W, 'display', 54);
    ctx.fillText(localized(this.destination.longName), CARD.x + 52, CARD.y + 216);

    ctx.font = font('body', 30);
    ctx.globalAlpha = ease * 0.75;
    ctx.fillText(
      `${success ? strings.successLead : strings.failLead}: ${this.destination.city}, ${localized(this.destination.country)}`,
      CARD.x + 52,
      CARD.y + 268,
    );
    ctx.globalAlpha = ease;

    const badge = strings.strengths[this.destination.strength];
    ctx.font = font('bold', 28);
    const badgeW = ctx.measureText(badge).width + 48;
    ctx.fillStyle = STRENGTH_COLORS[this.destination.strength];
    roundRect(ctx, CARD.x + CARD.w - badgeW - 52, CARD.y + 190, badgeW, 56, 28);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.fillText(badge, CARD.x + CARD.w - badgeW / 2 - 52, CARD.y + 219);

    // Fakta
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = font('body', 38);
    const lines = wrapText(ctx, localized(this.destination.fact), TEXT_W);
    lines.slice(0, 5).forEach((line, i) => {
      ctx.fillText(line, CARD.x + 52, CARD.y + 360 + i * 54);
    });

    // Maskotti täyttää kortin oikean reunan ja pitää palautteen elävänä.
    ctx.save();
    ctx.beginPath();
    ctx.rect(CARD.x + TEXT_W + 70, CARD.y + 140, CARD.w - TEXT_W - 90, CARD.h - 150);
    ctx.clip();
    ctx.globalAlpha = ease;
    this.mascot.drawAnchored(ctx, CARD.x + CARD.w - 250, CARD.y + CARD.h - 40, 360);
    ctx.restore();

    ctx.globalAlpha = ease * 0.6;
    ctx.font = font('body', 24);
    const photo = this.game.assets.campus.get(this.destination.id);
    const credit = photo ? `  ·  ${strings.photo}: ${photo.entry.credit}` : '';
    ctx.fillText(`${strings.source}: ${this.destination.source}${credit}`, CARD.x + 52, CARD.y + CARD.h - 48);
    ctx.globalAlpha = ease;
    ctx.restore();

    this.buttons.draw(ctx, this.keyboardMode);
    this.drawIdle(ctx);
  }

  /** Leimarivi: yksi piste per kohde, suoritetut täytettyinä. */
  private drawStamps(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const strings = t();
    const list = this.game.assets.destinations;
    const done = list.filter((d) => this.game.stamps.has(d.id)).length;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = font('bold', 24);
    const label = done === list.length ? strings.allStamps : `${strings.stamps} ${done}/${list.length}`;
    ctx.fillText(label, x, y - 18);
    list.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(x + 11 + i * 28, y + 16, 10, 0, Math.PI * 2);
      if (this.game.stamps.has(d.id)) {
        ctx.fillStyle = PALETTE.ink;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(4, 32, 29, 0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  private drawIdle(ctx: CanvasRenderingContext2D): void {
    const left = this.game.idleCountdown();
    if (left === null) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.paper;
    ctx.globalAlpha = clamp(0.5 + Math.sin(left * 6) * 0.3, 0, 1);
    ctx.font = font('bold', 28);
    ctx.fillText(`${t().idleWarning} ${Math.ceil(left)} s`, VIRTUAL_W / 2, VIRTUAL_H - 28);
    ctx.restore();
  }
}
