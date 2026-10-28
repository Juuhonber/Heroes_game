import type { GameState } from '../core/GameState';
import type { Game } from '../core/Game';
import { VIRTUAL_H, VIRTUAL_W } from '../core/Game';
import type { InputEvent } from '../core/Input';
import { Button, ButtonGroup } from '../ui/Button';
import { PALETTE, clearShadow, fitFont, font, roundRect, shadow } from '../ui/theme';
import { localized, t, toggleLang } from '../ui/strings';
import { fitProjection } from '../data/europe';
import type { Projection } from '../data/europe';
import type { Destination } from '../data/destinations';
import { STRENGTH_COLORS } from '../data/destinations';
import { clamp } from '../core/math';

const MAP_AREA = { x: 56, y: 176, w: 1160, h: 832 };
const PANEL = { x: 1268, y: 176, w: 596, h: 832 };
/** Näkymän rajaus asteina: Eurooppa HEROES-kumppaneiden ympäriltä. */
const VIEW_BOUNDS = { minLon: -14, maxLon: 32, minLat: 35, maxLat: 68 };

const PARTNER_COUNTRIES = new Set([
  'Finland',
  'Sweden',
  'Denmark',
  'Germany',
  'Netherlands',
  'Belgium',
  'Portugal',
  'Lithuania',
  'Czechia',
]);

export class MapState implements GameState {
  readonly name = 'map';

  private game!: Game;
  private projection!: Projection;
  private group = new ButtonGroup();
  private chrome = new ButtonGroup();
  private time = 0;
  private hoveredId: string | null = null;
  private keyboardMode = false;

  enter(game: Game): void {
    this.game = game;
    this.time = 0;
    this.projection = fitProjection(VIEW_BOUNDS, MAP_AREA);
    this.buildButtons();
  }

  private buildButtons(): void {
    const strings = t();
    const destinations = this.game.assets.destinations;
    const gap = 12;
    const h = Math.floor((PANEL.h - gap * (destinations.length - 1)) / destinations.length);
    this.group.set(
      destinations.map(
        (d, i) =>
          new Button({
            id: d.id,
            label: `${d.name}${this.game.stamps.has(d.id) ? '  ✓' : ''}${this.game.modules.has(d.id) ? '  ★' : ''}`,
            sublabel: `${d.city}, ${localized(d.country)} · ${strings.strengths[d.strength]}`,
            x: PANEL.x,
            y: PANEL.y + i * (h + gap),
            w: PANEL.w,
            h,
            tag: STRENGTH_COLORS[d.strength],
          }),
      ),
    );
    this.chrome.set([
      new Button({
        id: 'lang',
        label: strings.language,
        variant: 'icon',
        x: VIRTUAL_W - 250,
        y: 44,
        w: 92,
        h: 72,
      }),
      new Button({
        id: 'fullscreen',
        label: '⛶',
        variant: 'icon',
        x: VIRTUAL_W - 140,
        y: 44,
        w: 92,
        h: 72,
      }),
    ]);
  }

  update(dt: number, events: readonly InputEvent[]): void {
    this.time += dt;
    const pointer = this.game.input.pointer;
    this.group.update(dt, pointer.x, pointer.y);
    this.chrome.update(dt, pointer.x, pointer.y);

    for (const event of events) {
      if (!event.pointer) this.keyboardMode = true;
      else this.keyboardMode = false;
    }

    this.hoveredId = this.markerAt(pointer.x, pointer.y)?.id ?? null;

    const chromeHit = this.chrome.handle(this.keyboardMode ? [] : events);
    if (chromeHit === 'lang') {
      toggleLang();
      this.buildButtons();
      return;
    }
    if (chromeHit === 'fullscreen') {
      void this.game.toggleFullscreen();
      return;
    }

    // Kartan merkit toimivat painikkeiden rinnalla.
    for (const event of events) {
      if (event.type !== 'press' || event.action !== 'primary' || !event.pointer) continue;
      if (event.x === undefined || event.y === undefined) continue;
      const marker = this.markerAt(event.x, event.y);
      if (marker) {
        this.start(marker.id);
        return;
      }
    }

    const selected = this.group.handle(events);
    if (selected) this.start(selected);
  }

  private start(id: string): void {
    this.game.transitionTo('play', { id });
  }

  private markerAt(x: number, y: number): Destination | null {
    let best: Destination | null = null;
    let bestDistance = 64;
    for (const destination of this.game.assets.destinations) {
      const p = this.projection.project(destination.lon, destination.lat);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        best = destination;
      }
    }
    return best;
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBackground(ctx);
    this.drawHeader(ctx);
    this.drawMap(ctx);
    this.group.draw(ctx, this.keyboardMode);
    this.chrome.draw(ctx, false);
    this.drawFooter(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H);
    gradient.addColorStop(0, '#05282a');
    gradient.addColorStop(1, '#02191c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    const strings = t();
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.yellow;
    ctx.font = font('display', 76);
    ctx.fillText('HEROES', 60, 80);
    const logoWidth = ctx.measureText('HEROES').width;
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('body', 30);
    ctx.globalAlpha = 0.85;
    ctx.fillText(strings.tagline, 60 + logoWidth + 32, 86);
    ctx.globalAlpha = 1;

    const done = this.game.stamps.size;
    if (done > 0 || this.game.sessionCredits > 0) {
      const total = this.game.assets.destinations.length;
      ctx.fillStyle = PALETTE.yellow;
      ctx.font = font('bold', 26);
      const stamps = done === total ? strings.allStamps : `${strings.stamps} ${done}/${total}`;
      ctx.fillText(`${stamps}  ·  ${this.game.sessionCredits} ${strings.creditUnit}`, 60, 146);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.paper;
    ctx.font = font('bold', 34);
    ctx.fillText(strings.chooseDestination, PANEL.x, 108);
    ctx.font = font('body', 23);
    ctx.globalAlpha = 0.7;
    ctx.fillText(strings.chooseHint, PANEL.x, 146);
    ctx.restore();
  }

  private drawMap(ctx: CanvasRenderingContext2D): void {
    const europe = this.game.assets.europe;
    ctx.save();
    roundRect(ctx, MAP_AREA.x, MAP_AREA.y, MAP_AREA.w, MAP_AREA.h, 28);
    ctx.clip();

    const sea = ctx.createLinearGradient(0, MAP_AREA.y, 0, MAP_AREA.y + MAP_AREA.h);
    sea.addColorStop(0, '#0c3d4a');
    sea.addColorStop(1, '#07272f');
    ctx.fillStyle = sea;
    ctx.fillRect(MAP_AREA.x, MAP_AREA.y, MAP_AREA.w, MAP_AREA.h);

    for (const country of europe.countries) {
      const partner = PARTNER_COUNTRIES.has(country.name);
      ctx.beginPath();
      for (const ring of country.rings) {
        ring.forEach(([lon, lat], i) => {
          const p = this.projection.project(lon, lat);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = partner ? '#1a8f7d' : '#14584f';
      ctx.fill();
      ctx.strokeStyle = partner ? 'rgba(240, 229, 88, 0.55)' : 'rgba(8, 40, 36, 0.9)';
      ctx.lineWidth = partner ? 2.5 : 1.5;
      ctx.stroke();
    }

    const markers = this.game.assets.destinations
      .map((destination) => ({ destination, p: this.projection.project(destination.lon, destination.lat) }))
      .sort((a, b) => a.p.y - b.p.y);
    for (const marker of markers) this.drawMarkerDot(ctx, marker.destination, marker.p);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const marker of markers) this.drawMarkerLabel(ctx, marker.destination, marker.p, placed);
    ctx.restore();

    ctx.strokeStyle = 'rgba(246, 243, 230, 0.18)';
    ctx.lineWidth = 3;
    roundRect(ctx, MAP_AREA.x, MAP_AREA.y, MAP_AREA.w, MAP_AREA.h, 28);
    ctx.stroke();
  }

  private isActive(destination: Destination): boolean {
    const focusedButton = this.keyboardMode ? this.group.items[this.group.focus] : undefined;
    return (
      this.hoveredId === destination.id ||
      this.group.byId(destination.id)?.hovered === true ||
      focusedButton?.id === destination.id
    );
  }

  private drawMarkerDot(
    ctx: CanvasRenderingContext2D,
    destination: Destination,
    p: { x: number; y: number },
  ): void {
    const active = this.isActive(destination);
    const color = STRENGTH_COLORS[destination.strength];
    const raw = this.time * 0.9 + destination.lon * 0.05;
    const pulse = ((raw % 1) + 1) % 1;

    ctx.save();
    // Sykkivä rengas ohjaa katseen kohteisiin.
    ctx.globalAlpha = clamp(0.5 - pulse * 0.5, 0, 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16 + pulse * 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    shadow(ctx, 14, 0.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, active ? 24 : 14, 0, Math.PI * 2);
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (this.game.stamps.has(destination.id)) {
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const r = active ? 12 : 8;
      ctx.beginPath();
      ctx.moveTo(p.x - r, p.y);
      ctx.lineTo(p.x - r * 0.25, p.y + r * 0.7);
      ctx.lineTo(p.x + r, p.y - r * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Nimilappu siirretään alaspäin, jos se osuu aiemmin sijoitettuun lappuun.
   * Tiheä Benelux-ryhmä pysyy näin luettavana ilman erillistä asettelua.
   */
  private drawMarkerLabel(
    ctx: CanvasRenderingContext2D,
    destination: Destination,
    p: { x: number; y: number },
    placed: { x: number; y: number; w: number; h: number }[],
  ): void {
    const active = this.isActive(destination);
    const color = STRENGTH_COLORS[destination.strength];
    const label = destination.name;

    ctx.save();
    ctx.font = font('bold', active ? 30 : 26);
    const w = ctx.measureText(label).width + 30;
    const h = 42;
    const x = clamp(p.x - w / 2, MAP_AREA.x + 8, MAP_AREA.x + MAP_AREA.w - w - 8);
    let y = p.y + 24;
    let guard = 0;
    while (guard++ < 12) {
      const hit = placed.find(
        (b) => x < b.x + b.w + 6 && x + w + 6 > b.x && y < b.y + b.h + 4 && y + h + 4 > b.y,
      );
      if (!hit) break;
      y = hit.y + hit.h + 8;
    }
    placed.push({ x, y, w, h });

    // Yhdysviiva, jos lappu jouduttiin siirtämään kauas merkistä.
    if (y > p.y + 40) {
      ctx.strokeStyle = 'rgba(246, 243, 230, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 12);
      ctx.lineTo(x + w / 2, y);
      ctx.stroke();
    }

    ctx.fillStyle = active ? color : 'rgba(4, 32, 29, 0.88)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = active ? PALETTE.ink : PALETTE.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
  }

  private drawFooter(ctx: CanvasRenderingContext2D): void {
    const alliance = this.game.assets.alliance;
    const text = `${localized(alliance.facts)}  ·  ${t().source}: ${alliance.source}`;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = PALETTE.paper;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitFont(ctx, text, VIRTUAL_W - 120, 'body', 24);
    ctx.fillText(text, MAP_AREA.x + 8, VIRTUAL_H - 40);
    ctx.restore();
  }
}
