import { Rng } from '../core/math';
import { GROUND_Y } from './constants';
import type { Destination, SceneryKind, Theme } from '../data/destinations';
import type { CampusPhoto } from '../data/campus';
import type { Pit } from './Level';
import { hash } from './Level';
import { VIRTUAL_H, VIRTUAL_W } from '../core/Game';
import { buildShapes, drawLandmark, drawShape } from './scenery';
import type { Shape } from './scenery';

interface Layer {
  kind: SceneryKind;
  factor: number;
  color: string;
  /** Ilmaperspektiivi: kaukaiset kerrokset sulautuvat taivaaseen. */
  alpha: number;
  baseY: number;
  detail: boolean;
  shapes: Shape[];
}

const TILE = VIRTUAL_W;
/** Maamerkki liukuu hitaasti: se pysyy näkyvissä koko juoksun ajan. */
const LANDMARK_FACTOR = 0.07;
const LANDMARK_START_X = 1320;

/**
 * Juoksun tausta. Kerrokset ja maamerkki kuvaavat kampuskaupungin maisemaa.
 * Jos kohteelle on kampuskuva, se korvaa kaukaisimman kerroksen ja
 * maamerkin, ja lähin kerros jää kuvan eteen syvyyden tuojaksi.
 */
export class Backdrop {
  private readonly theme: Theme;
  private readonly layers: Layer[];
  private photo: CampusPhoto | null = null;
  private photoFade = 0;
  private lastTime = 0;

  constructor(private readonly destination: Destination) {
    this.theme = destination.theme;
    const rng = new Rng(hash(`${destination.id}:scenery`));
    const { far, mid, near } = destination.scenery;
    this.layers = [
      layer(far, 0.16, this.theme.far, 0.7, GROUND_Y - 40, false, buildShapes(far, farScale(far), rng, TILE)),
      layer(mid, 0.4, this.theme.mid, 0.9, GROUND_Y - 8, false, buildShapes(mid, 0.9, rng, TILE)),
      layer(near, 0.72, this.theme.near, 1, GROUND_Y + 10, true, buildShapes(near, 0.6, rng, TILE)),
    ];
  }

  setPhoto(photo: CampusPhoto): void {
    this.photo = photo;
    this.photoFade = 0;
  }

  get photoCredit(): string | null {
    return this.photo?.entry.credit ?? null;
  }

  drawSky(ctx: CanvasRenderingContext2D, cameraX: number, time: number): void {
    const dt = Math.max(0, time - this.lastTime);
    this.lastTime = time;
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gradient.addColorStop(0, this.theme.skyTop);
    gradient.addColorStop(1, this.theme.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIRTUAL_W, GROUND_Y);

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

    if (this.photo) {
      this.photoFade = Math.min(1, this.photoFade + dt * 1.6);
      this.drawPhoto(ctx, cameraX);
    }
  }

  /** Kuva peittää taivaan ja panoroi hitaasti juoksun edetessä. */
  private drawPhoto(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const photo = this.photo!;
    const area = { w: VIRTUAL_W, h: GROUND_Y + 20 };
    const scale = Math.max(area.w / photo.width, area.h / photo.height) * 1.12;
    const w = photo.width * scale;
    const h = photo.height * scale;
    const travel = Math.max(0, w - area.w);
    const run = this.destination.goalDistance * 20;
    const x = -travel * Math.min(1, cameraX / run);
    const y = area.h - h;
    ctx.save();
    ctx.globalAlpha = this.photoFade;
    ctx.drawImage(photo.image, x, y, w, h);
    // Teeman sävy ja alareunan usva sitovat kuvan pelin värimaailmaan.
    const tint = ctx.createLinearGradient(0, 0, 0, area.h);
    tint.addColorStop(0, hexAlpha(this.theme.skyTop, 0.45));
    tint.addColorStop(0.6, hexAlpha(this.theme.skyTop, 0.1));
    tint.addColorStop(1, hexAlpha(this.theme.skyBottom, 0.55));
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, area.w, area.h);
    ctx.restore();
  }

  drawLayers(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const photoAlpha = this.photo ? this.photoFade : 0;
    this.layers.forEach((l, index) => {
      // Kuvan kanssa kaukainen kerros ja keskikerros väistyvät.
      const fade = index === 2 ? 1 : 1 - photoAlpha * (index === 0 ? 1 : 0.75);
      if (fade > 0.01) this.drawLayer(ctx, l, cameraX, fade);
      if (index === 0 && 1 - photoAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.92 * (1 - photoAlpha);
        drawLandmark(
          ctx,
          this.destination.landmark.kind,
          LANDMARK_START_X - cameraX * LANDMARK_FACTOR,
          GROUND_Y - 30,
          mix(this.theme.mid, this.theme.near),
          this.theme.skyBottom,
        );
        ctx.restore();
      }
    });
  }

  private drawLayer(ctx: CanvasRenderingContext2D, l: Layer, cameraX: number, fade: number): void {
    const offset = -((cameraX * l.factor) % TILE);
    ctx.save();
    ctx.globalAlpha = l.alpha * fade;
    ctx.fillStyle = l.color;
    for (let tile = -1; tile <= 1; tile++) {
      const ox = offset + tile * TILE;
      if (ox > VIRTUAL_W || ox + TILE < 0) continue;
      ctx.save();
      ctx.translate(ox, 0);
      for (const shape of l.shapes) drawShape(ctx, l.kind, shape, l.baseY, l.detail);
      ctx.restore();
    }
    ctx.restore();
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

    for (const pit of pits) {
      if (pit.bridged) continue;
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

function layer(
  kind: SceneryKind,
  factor: number,
  color: string,
  alpha: number,
  baseY: number,
  detail: boolean,
  shapes: Shape[],
): Layer {
  return { kind, factor, color, alpha, baseY, detail, shapes };
}

/** Rakennetut kaukokerrokset pidetään matalina, jotta maamerkki erottuu. */
function farScale(kind: SceneryKind): number {
  return kind === 'city' || kind === 'modern' ? 0.95 : 1.3;
}

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

function parseHex(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

function hexAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mix(a: string, b: string): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round((v + pb[i]!) / 2));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
