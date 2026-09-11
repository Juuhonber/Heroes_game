import { PALETTE, clearShadow, fitFont, roundRect, shadow } from './theme';
import type { InputEvent } from '../core/Input';

export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'icon';

export interface ButtonOptions {
  id: string;
  label: string;
  sublabel?: string;
  variant?: ButtonVariant;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Väriläikkä napin vasemmassa reunassa, esimerkiksi vahvuusalueen väri. */
  tag?: string;
}

/**
 * Messukäyttöön mitoitettu painike: iso kosketusalue, vahva kontrasti ja
 * näkyvä kohdistus, jotta pelin voi läpäistä pelkillä näppäimillä.
 */
export class Button {
  readonly id: string;
  label: string;
  sublabel: string | undefined;
  variant: ButtonVariant;
  x: number;
  y: number;
  w: number;
  h: number;
  tag: string | undefined;
  hovered = false;
  pressed = 0;

  constructor(options: ButtonOptions) {
    this.id = options.id;
    this.label = options.label;
    this.sublabel = options.sublabel;
    this.variant = options.variant ?? 'primary';
    this.x = options.x;
    this.y = options.y;
    this.w = options.w;
    this.h = options.h;
    this.tag = options.tag;
  }

  contains(px: number, py: number): boolean {
    // Kosketusaluetta laajennetaan reilusti: messuilla ei tähdätä tarkasti.
    const pad = 12;
    return (
      px >= this.x - pad &&
      px <= this.x + this.w + pad &&
      py >= this.y - pad &&
      py <= this.y + this.h + pad
    );
  }

  update(dt: number, pointerX: number, pointerY: number): void {
    this.hovered = this.contains(pointerX, pointerY);
    this.pressed = Math.max(0, this.pressed - dt * 4);
  }

  draw(ctx: CanvasRenderingContext2D, focused: boolean): void {
    const lift = this.hovered || focused ? 4 : 0;
    const y = this.y - lift + this.pressed * 6;
    const active = this.hovered || focused;

    ctx.save();
    shadow(ctx, active ? 26 : 16, active ? 0.4 : 0.28);
    roundRect(ctx, this.x, y, this.w, this.h, this.variant === 'icon' ? this.h / 2 : 18);
    switch (this.variant) {
      case 'accent':
        ctx.fillStyle = active ? '#ffef7a' : PALETTE.yellow;
        break;
      case 'ghost':
        ctx.fillStyle = active ? 'rgba(246, 243, 230, 0.22)' : 'rgba(246, 243, 230, 0.12)';
        break;
      case 'icon':
        ctx.fillStyle = active ? 'rgba(246, 243, 230, 0.28)' : 'rgba(246, 243, 230, 0.14)';
        break;
      default:
        ctx.fillStyle = active ? '#1fbfa5' : PALETTE.teal;
    }
    ctx.fill();
    clearShadow(ctx);

    if (focused) {
      ctx.strokeStyle = PALETTE.yellow;
      ctx.lineWidth = 5;
      roundRect(ctx, this.x - 5, y - 5, this.w + 10, this.h + 10, 22);
      ctx.stroke();
    }

    if (this.tag) {
      ctx.fillStyle = this.tag;
      roundRect(ctx, this.x + 14, y + this.h / 2 - 22, 12, 44, 6);
      ctx.fill();
    }

    const textColor =
      this.variant === 'accent' ? PALETTE.ink : this.variant === 'primary' ? '#04231f' : PALETTE.paper;
    const left = this.x + (this.tag ? 46 : 0);
    const innerW = this.w - (this.tag ? 64 : 44);
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = this.tag ? 'left' : 'center';
    const cx = this.tag ? left + 14 : this.x + this.w / 2;

    if (this.sublabel) {
      fitFont(ctx, this.label, innerW, 'bold', Math.min(36, this.h * 0.36));
      ctx.fillText(this.label, cx, y + this.h / 2 - 15);
      ctx.globalAlpha = 0.78;
      fitFont(ctx, this.sublabel, innerW, 'body', Math.min(26, this.h * 0.26));
      ctx.fillText(this.sublabel, cx, y + this.h / 2 + 20);
      ctx.globalAlpha = 1;
    } else {
      fitFont(ctx, this.label, innerW, 'bold', Math.min(40, this.h * 0.42));
      ctx.fillText(this.label, cx, y + this.h / 2 + 1);
    }
    ctx.restore();
  }
}

/**
 * Painikeryhmä, jota voi käyttää sekä hiirellä että kahdella näppäimellä:
 * secondary siirtää kohdistusta, primary valitsee.
 */
export class ButtonGroup {
  focus = 0;
  private buttons: Button[] = [];

  set(buttons: Button[]): void {
    this.buttons = buttons;
    this.focus = Math.min(this.focus, Math.max(0, buttons.length - 1));
  }

  get items(): readonly Button[] {
    return this.buttons;
  }

  update(dt: number, pointerX: number, pointerY: number): void {
    for (const b of this.buttons) b.update(dt, pointerX, pointerY);
  }

  /** Palauttaa valitun painikkeen id:n tai null. */
  handle(events: readonly InputEvent[]): string | null {
    let result: string | null = null;
    for (const event of events) {
      if (event.type !== 'press') continue;
      if (event.action === 'secondary' && !event.pointer) {
        if (this.buttons.length > 0) this.focus = (this.focus + 1) % this.buttons.length;
        continue;
      }
      if (event.action !== 'primary') continue;
      if (event.pointer && event.x !== undefined && event.y !== undefined) {
        const hit = this.buttons.find((b) => b.contains(event.x!, event.y!));
        if (hit) {
          hit.pressed = 1;
          result = hit.id;
        }
      } else {
        const focused = this.buttons[this.focus];
        if (focused) {
          focused.pressed = 1;
          result = focused.id;
        }
      }
    }
    return result;
  }

  draw(ctx: CanvasRenderingContext2D, showFocus: boolean): void {
    this.buttons.forEach((b, i) => b.draw(ctx, showFocus && i === this.focus));
  }

  byId(id: string): Button | undefined {
    return this.buttons.find((b) => b.id === id);
  }
}
