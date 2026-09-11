import { Rng } from '../core/math';
import { GROUND_Y } from './constants';
import type { Destination, Terrain, Theme } from '../data/destinations';
import type { Pit } from './Level';
import { VIRTUAL_H, VIRTUAL_W } from '../core/Game';

interface Shape {
  x: number;
  w: number;
  h: number;
  variant: number;
}

interface Layer {
  factor: number;
  color: string;
  /** Ilmaperspektiivi: kaukaiset kerrokset sulautuvat taivaaseen. */
  alpha: number;
  baseY: number;
  shapes: Shape[];
}

const TILE = VIRTUAL_W;

/**
 * Taustan kolme rinnakkain vierivää kerrosta. Muodot ovat maastotyypin
 * mukaisia siluetteja, jotka luodaan kerran kohteen siemenestä.
 *
 * Jos kohteelle annetaan campusImage, se piirretään horisonttiin kauimmaksi
 * kerrokseksi. Ilman kuvaa käytetään siluetteja.
 */
export class Backdrop {
  private layers: Layer[];
  private campus: HTMLImageElement | null = null;

  constructor(
    private readonly theme: Theme,
    terrain: Terrain,
    seed: string,
    campus: HTMLImageElement | null = null,
  ) {
    this.campus = campus;
    const rng = new Rng(hash(`${seed}:${terrain}`));
    this.layers = [
      { factor: 0.18, color: theme.far, alpha: 0.68, baseY: GROUND_Y - 40, shapes: build(terrain, 0, rng) },
      { factor: 0.42, color: theme.mid, alpha: 0.88, baseY: GROUND_Y - 10, shapes: build(terrain, 1, rng) },
      { factor: 0.72, color: theme.near, alpha: 1, baseY: GROUND_Y + 10, shapes: build(terrain, 2, rng) },
    ];
  }

  drawSky(ctx: CanvasRenderingContext2D, cameraX: number, time: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gradient.addColorStop(0, this.theme.skyTop);
    gradient.addColorStop(1, this.theme.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIRTUAL_W, GROUND_Y);

    // Aurinko ja kevyet pilvet tuovat syvyyttä ilman lisäaineistoa.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this.theme.accent;
    ctx.beginPath();
    ctx.arc(1480, 210, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const cx = wrap(300 + i * 430 - cameraX * 0.05 + Math.sin(time * 0.1 + i) * 20, TILE + 400);
      const cy = 140 + ((i * 67) % 180);
      ctx.beginPath();
      ctx.ellipse(cx - 200, cy, 150, 36, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 120, cy - 18, 110, 32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (this.campus) {
      const h = 300;
      const w = (this.campus.width / this.campus.height) * h;
      ctx.save();
      ctx.globalAlpha = 0.85;
      const offset = -((cameraX * 0.12) % w);
      for (let x = offset - w; x < VIRTUAL_W + w; x += w) {
        ctx.drawImage(this.campus, x, GROUND_Y - h, w, h);
      }
      ctx.restore();
    }
  }

  drawLayers(ctx: CanvasRenderingContext2D, cameraX: number): void {
    for (const layer of this.layers) {
      const offset = -((cameraX * layer.factor) % TILE);
      ctx.save();
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.color;
      for (let tile = -1; tile <= 1; tile++) {
        const ox = offset + tile * TILE;
        if (ox > VIRTUAL_W || ox + TILE < 0) continue;
        ctx.save();
        ctx.translate(ox, 0);
        for (const shape of layer.shapes) drawShape(ctx, shape, layer.baseY);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  drawGround(ctx: CanvasRenderingContext2D, cameraX: number, pits: readonly Pit[]): void {
    ctx.fillStyle = this.theme.ground;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_W, VIRTUAL_H - GROUND_Y);
    ctx.fillStyle = this.theme.groundDark;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_W, 12);

    // Vierivä pintakuvio kertoo vauhdin.
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = this.theme.groundDark;
    const step = 150;
    const offset = -(cameraX % step);
    for (let x = offset - step; x < VIRTUAL_W + step; x += step) {
      ctx.fillRect(x, GROUND_Y + 46, 74, 10);
      ctx.fillRect(x + 40, GROUND_Y + 108, 52, 8);
    }
    ctx.restore();

    // Kuopat leikataan maasta pois.
    for (const pit of pits) {
      const sx = pit.x - cameraX;
      if (sx > VIRTUAL_W || sx + pit.w < 0) continue;
      const gradient = ctx.createLinearGradient(0, GROUND_Y, 0, VIRTUAL_H);
      gradient.addColorStop(0, 'rgba(3, 18, 16, 0.95)');
      gradient.addColorStop(1, 'rgba(3, 18, 16, 1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(sx, GROUND_Y, pit.w, VIRTUAL_H - GROUND_Y);
      ctx.fillStyle = this.theme.groundDark;
      ctx.fillRect(sx - 10, GROUND_Y, 10, 44);
      ctx.fillRect(sx + pit.w, GROUND_Y, 10, 44);
    }
  }
}

function build(terrain: Terrain, layerIndex: number, rng: Rng): Shape[] {
  const shapes: Shape[] = [];
  const counts = [7, 11, 9];
  const count = counts[layerIndex] ?? 9;
  const scale = [1.35, 0.9, 0.55][layerIndex] ?? 1;
  for (let i = 0; i < count; i++) {
    const x = (TILE / count) * i + rng.range(-40, 40);
    const w = rng.range(110, 260) * scale;
    let h = rng.range(120, 320) * scale;
    if (terrain === 'city') h = rng.range(180, 420) * scale;
    if (terrain === 'fields') h = rng.range(60, 140) * scale;
    if (terrain === 'coast') h = rng.range(70, 180) * scale;
    shapes.push({ x, w, h, variant: rng.int(0, 3) });
  }
  return shapes.map((s) => ({ ...s, variant: terrainVariant(terrain, s.variant) }));
}

/** Muunnetaan maastotyyppi piirtotavan numeroksi. */
function terrainVariant(terrain: Terrain, roll: number): number {
  switch (terrain) {
    case 'forest':
      return 0;
    case 'city':
      return 1;
    case 'coast':
      return roll < 2 ? 2 : 3;
    case 'fields':
      return 3;
    case 'hills':
      return 4;
    default:
      return 3;
  }
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, baseY: number): void {
  switch (s.variant) {
    case 0: {
      // Havupuu
      const trunk = s.w * 0.12;
      ctx.fillRect(s.x + s.w / 2 - trunk / 2, baseY - s.h * 0.25, trunk, s.h * 0.3);
      ctx.beginPath();
      ctx.moveTo(s.x + s.w / 2, baseY - s.h);
      ctx.lineTo(s.x + s.w, baseY - s.h * 0.2);
      ctx.lineTo(s.x, baseY - s.h * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 1: {
      // Rakennus ikkunoineen
      ctx.fillRect(s.x, baseY - s.h, s.w, s.h);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ffffff';
      const cols = Math.max(2, Math.floor(s.w / 46));
      const rows = Math.max(2, Math.floor(s.h / 64));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if ((c * 7 + r * 3) % 4 === 0) continue;
          ctx.fillRect(s.x + 14 + c * 46, baseY - s.h + 22 + r * 64, 20, 30);
        }
      }
      ctx.restore();
      break;
    }
    case 2: {
      // Majakka
      ctx.beginPath();
      ctx.moveTo(s.x + s.w * 0.3, baseY);
      ctx.lineTo(s.x + s.w * 0.42, baseY - s.h);
      ctx.lineTo(s.x + s.w * 0.58, baseY - s.h);
      ctx.lineTo(s.x + s.w * 0.7, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(s.x + s.w * 0.36, baseY - s.h - 26, s.w * 0.28, 26);
      break;
    }
    case 3: {
      // Loiva kumpare
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, baseY, s.w / 2, s.h, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // Kukkula
      ctx.beginPath();
      ctx.moveTo(s.x, baseY);
      ctx.lineTo(s.x + s.w * 0.45, baseY - s.h);
      ctx.lineTo(s.x + s.w * 0.62, baseY - s.h * 0.7);
      ctx.lineTo(s.x + s.w, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function backdropFor(destination: Destination, campus: HTMLImageElement | null): Backdrop {
  return new Backdrop(destination.theme, destination.terrain, destination.id, campus);
}
