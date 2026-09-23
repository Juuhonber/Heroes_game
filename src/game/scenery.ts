import type { LandmarkKind, SceneryKind } from '../data/destinations';
import type { Rng } from '../core/math';

export interface Shape {
  x: number;
  w: number;
  h: number;
  seed: number;
}

/** Muotojen kokoalueet ennen kerroskohtaista skaalausta. */
const SIZES: Record<SceneryKind, { w: [number, number]; h: [number, number]; count: number }> = {
  spruce: { w: [80, 130], h: [190, 330], count: 12 },
  birch: { w: [70, 120], h: [170, 280], count: 10 },
  deciduous: { w: [120, 200], h: [150, 260], count: 9 },
  olive: { w: [110, 170], h: [80, 130], count: 10 },
  city: { w: [110, 220], h: [140, 290], count: 11 },
  modern: { w: [130, 240], h: [180, 360], count: 9 },
  gables: { w: [80, 120], h: [170, 260], count: 16 },
  whitehouses: { w: [120, 200], h: [70, 120], count: 11 },
  barns: { w: [150, 220], h: [95, 135], count: 6 },
  hills: { w: [360, 560], h: [110, 220], count: 6 },
  mountains: { w: [460, 700], h: [200, 330], count: 5 },
  fields: { w: [300, 460], h: [36, 80], count: 6 },
  dunes: { w: [240, 380], h: [60, 120], count: 7 },
  sea: { w: [1920, 1920], h: [70, 70], count: 1 },
  vineyard: { w: [220, 320], h: [50, 80], count: 7 },
};

export function buildShapes(kind: SceneryKind, scale: number, rng: Rng, tile: number): Shape[] {
  const spec = SIZES[kind];
  const shapes: Shape[] = [];
  for (let i = 0; i < spec.count; i++) {
    const w = rng.range(spec.w[0], spec.w[1]) * (kind === 'sea' ? 1 : scale);
    shapes.push({
      x: kind === 'sea' ? 0 : (tile / spec.count) * i + rng.range(-30, 30),
      w,
      h: rng.range(spec.h[0], spec.h[1]) * (kind === 'sea' ? 1 : scale),
      seed: rng.int(0, 1000),
    });
  }
  return shapes;
}

/**
 * Piirtää yhden maisemamuodon. Useimmat ovat yksivärisiä siluetteja
 * kerroksen värissä; muutamalla on paikallinen tunnusväri (Pohjanmaan
 * punamultaladot, Alentejon valkoiset talot, koivun valkoinen runko).
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: SceneryKind,
  s: Shape,
  baseY: number,
  detail: boolean,
): void {
  const { x, w, h } = s;
  switch (kind) {
    case 'spruce': {
      const cx = x + w / 2;
      ctx.fillRect(cx - w * 0.05, baseY - h * 0.18, w * 0.1, h * 0.2);
      for (let tier = 0; tier < 3; tier++) {
        const top = baseY - h + tier * h * 0.24;
        const bottom = baseY - h * 0.16 - (2 - tier) * h * 0.14;
        const half = (w / 2) * (0.55 + tier * 0.22);
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx + half, bottom);
        ctx.lineTo(cx - half, bottom);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'birch': {
      const cx = x + w / 2;
      ctx.beginPath();
      ctx.ellipse(cx, baseY - h * 0.62, w * 0.4, h * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      if (detail) ctx.fillStyle = '#eef0ea';
      ctx.fillRect(cx - 5, baseY - h * 0.55, 10, h * 0.55);
      if (detail) {
        ctx.fillStyle = '#1d1f1d';
        for (let i = 0; i < 4; i++) ctx.fillRect(cx - 5, baseY - h * (0.12 + i * 0.11), 6, 4);
      }
      ctx.restore();
      break;
    }
    case 'deciduous': {
      const cx = x + w / 2;
      ctx.fillRect(cx - w * 0.06, baseY - h * 0.45, w * 0.12, h * 0.45);
      ctx.beginPath();
      ctx.arc(cx, baseY - h * 0.7, w * 0.3, 0, Math.PI * 2);
      ctx.arc(cx - w * 0.24, baseY - h * 0.55, w * 0.24, 0, Math.PI * 2);
      ctx.arc(cx + w * 0.24, baseY - h * 0.56, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'olive': {
      const cx = x + w / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 8, baseY);
      ctx.quadraticCurveTo(cx - 16, baseY - h * 0.3, cx + 4, baseY - h * 0.5);
      ctx.lineTo(cx + 14, baseY - h * 0.46);
      ctx.quadraticCurveTo(cx, baseY - h * 0.28, cx + 8, baseY);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, baseY - h * 0.66, w * 0.48, h * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - w * 0.2, baseY - h * 0.8, w * 0.26, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'city': {
      ctx.fillRect(x, baseY - h, w, h);
      windows(ctx, x, baseY - h, w, h, s.seed);
      break;
    }
    case 'modern': {
      const slant = (s.seed % 3) * 24;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - h + slant);
      ctx.lineTo(x + w, baseY - h);
      ctx.lineTo(x + w, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalAlpha *= 0.2;
      ctx.fillStyle = '#ffffff';
      for (let i = 12; i < w - 8; i += 22) ctx.fillRect(x + i, baseY - h + slant + 16, 6, h - slant - 24);
      ctx.restore();
      break;
    }
    case 'gables': {
      // Flaamilainen porraspääty: kapea talo, jonka pääty nousee portain.
      const body = h * 0.62;
      ctx.fillRect(x, baseY - body, w, body);
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const inset = (w / 2) * (i / steps);
        const stepH = (h - body) / steps;
        ctx.fillRect(x + inset, baseY - body - stepH * (i + 1), w - inset * 2, stepH + 1);
      }
      windows(ctx, x, baseY - body, w, body, s.seed);
      break;
    }
    case 'whitehouses': {
      // Alentejon kalkitut talot: valkoinen seinä, sininen sokkeli, tiilikatto.
      ctx.save();
      ctx.fillStyle = '#f3efe6';
      ctx.fillRect(x, baseY - h, w, h);
      ctx.fillStyle = '#2f64a8';
      ctx.fillRect(x, baseY - h * 0.16, w, h * 0.16);
      ctx.fillStyle = '#b8583a';
      ctx.fillRect(x - 4, baseY - h - 10, w + 8, 12);
      ctx.fillStyle = '#26303a';
      ctx.fillRect(x + w * 0.2, baseY - h * 0.62, w * 0.12, h * 0.3);
      ctx.fillRect(x + w * 0.62, baseY - h * 0.62, w * 0.12, h * 0.3);
      ctx.restore();
      break;
    }
    case 'barns': {
      // Pohjanmaan lakeuden heinälato: harmaa tai punamullattu hirsilato.
      ctx.save();
      ctx.fillStyle = s.seed % 2 === 0 ? '#8e3b2d' : '#6f675c';
      const body = h * 0.62;
      ctx.fillRect(x, baseY - body, w, body);
      ctx.fillStyle = '#3b3530';
      ctx.beginPath();
      ctx.moveTo(x - 8, baseY - body);
      ctx.lineTo(x + w / 2, baseY - h);
      ctx.lineTo(x + w + 8, baseY - body);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'hills':
    case 'fields': {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, baseY, w / 2, h, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mountains': {
      // Baijerin metsän loivat, metsäiset vaarat.
      ctx.beginPath();
      ctx.moveTo(x - w * 0.1, baseY);
      ctx.quadraticCurveTo(x + w * 0.25, baseY - h * 1.15, x + w * 0.5, baseY - h);
      ctx.quadraticCurveTo(x + w * 0.8, baseY - h * 0.85, x + w * 1.1, baseY);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'dunes': {
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + w * 0.35, baseY - h * 1.3, x + w * 0.6, baseY - h * 0.9);
      ctx.quadraticCurveTo(x + w * 0.85, baseY - h * 0.5, x + w, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = ctx.fillStyle;
      for (let i = 0; i < 5; i++) {
        const gx = x + w * (0.3 + i * 0.08);
        ctx.beginPath();
        ctx.moveTo(gx, baseY - h * 0.9);
        ctx.lineTo(gx + 6, baseY - h * 0.9 - 26);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'sea': {
      ctx.fillRect(x, baseY - h, w, h);
      ctx.save();
      ctx.globalAlpha *= 0.3;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 14; i++) ctx.fillRect(x + ((i * 173 + s.seed) % w), baseY - h + 12 + (i % 3) * 18, 60, 4);
      ctx.restore();
      break;
    }
    case 'vineyard': {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, baseY, w / 2, h * 0.5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const vx = x + w * (0.12 + i * 0.15);
        ctx.fillRect(vx, baseY - h, 6, h);
        ctx.beginPath();
        ctx.arc(vx + 3, baseY - h * 0.8, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

function windows(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  ctx.save();
  ctx.globalAlpha *= 0.22;
  ctx.fillStyle = '#ffffff';
  const cols = Math.max(1, Math.floor((w - 16) / 34));
  const rows = Math.max(1, Math.floor((h - 20) / 52));
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if ((c * 7 + r * 3 + seed) % 4 === 0) continue;
      ctx.fillRect(x + 12 + c * 34, y + 18 + r * 52, 16, 26);
    }
  }
  ctx.restore();
}

/**
 * Maamerkit: kunkin kampuskaupungin tunnistettava siluetti. Origo on
 * maamerkin alakeskikohta, korkeus pikseleinä.
 */
const LANDMARK_SCALE: Partial<Record<LandmarkKind, number>> = {
  evoluon: 1.55,
  bejaKeep: 1.2,
  halmstadCastle: 1.15,
  rumbold: 1.1,
};

export function drawLandmark(
  ctx: CanvasRenderingContext2D,
  kind: LandmarkKind,
  cx: number,
  baseY: number,
  color: string,
  glow: string,
): void {
  ctx.save();
  const scale = LANDMARK_SCALE[kind] ?? 1;
  if (scale !== 1) {
    ctx.translate(cx, baseY);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -baseY);
  }
  // Taivaan värinen hohto irrottaa siluetin takana olevasta kerroksesta.
  ctx.shadowColor = glow;
  ctx.shadowBlur = 36;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (kind) {
    case 'lakeudenRisti': {
      // Alvar Aallon Lakeuden Ristin kellotorni: kapea valkoinen torni,
      // jonka yläosassa on ristin muotoinen aukko.
      ctx.fillStyle = '#eef1ec';
      const h = 470;
      ctx.beginPath();
      ctx.moveTo(cx - 36, baseY);
      ctx.lineTo(cx - 26, baseY - h);
      ctx.lineTo(cx + 26, baseY - h);
      ctx.lineTo(cx + 36, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(cx - 5, baseY - h + 26, 10, 80);
      ctx.fillRect(cx - 20, baseY - h + 50, 40, 10);
      // Kirkkosali tornin juurella
      ctx.fillStyle = '#dfe4de';
      ctx.fillRect(cx + 36, baseY - 90, 190, 90);
      ctx.beginPath();
      ctx.moveTo(cx + 36, baseY - 90);
      ctx.lineTo(cx + 226, baseY - 130);
      ctx.lineTo(cx + 226, baseY - 90);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'rumbold': {
      // Mechelenin Pyhän Rumoldin torni: massiivinen goottilainen
      // neliötorni, tasainen huippu ja nurkkapinaakkelit.
      const h = 500;
      const w = 120;
      ctx.fillRect(cx - w / 2, baseY - h * 0.6, w, h * 0.6);
      ctx.fillRect(cx - w / 2 + 10, baseY - h, w - 20, h * 0.42);
      for (const dx of [-w / 2 + 10, w / 2 - 22]) ctx.fillRect(cx + dx, baseY - h - 40, 12, 44);
      for (const dx of [-w / 2 + 34, w / 2 - 44]) ctx.fillRect(cx + dx, baseY - h - 24, 10, 28);
      ctx.fillRect(cx - 200, baseY - 150, 150, 150);
      ctx.beginPath();
      ctx.moveTo(cx - 205, baseY - 150);
      ctx.lineTo(cx - 125, baseY - 220);
      ctx.lineTo(cx - 45, baseY - 150);
      ctx.fill();
      arches(ctx, cx - w / 2 + 22, baseY - h * 0.92, w - 44, 4);
      break;
    }
    case 'evoluon': {
      // Eindhovenin Evoluon: lautasmainen kupoli betonijalkojen päällä.
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      for (const dx of [-110, -40, 40, 110]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * 0.4, baseY - 150);
        ctx.lineTo(cx + dx, baseY);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 70, baseY - 150);
      ctx.lineTo(cx - 190, baseY - 210);
      ctx.lineTo(cx + 190, baseY - 210);
      ctx.lineTo(cx + 70, baseY - 150);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, baseY - 210, 200, 70, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha *= 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 170, baseY - 200, 340, 8);
      ctx.restore();
      break;
    }
    case 'aalborgTower': {
      // Aalborgtårnet mäen päällä: hoikka ristikkotorni ja näköalakoppi.
      ctx.beginPath();
      ctx.ellipse(cx, baseY, 260, 110, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 34, baseY - 100);
      ctx.lineTo(cx - 8, baseY - 400);
      ctx.moveTo(cx + 34, baseY - 100);
      ctx.lineTo(cx + 8, baseY - 400);
      for (let y = baseY - 110; y > baseY - 400; y -= 40) {
        const k = (baseY - 100 - y) / 300;
        const half = 34 - k * 26;
        ctx.moveTo(cx - half, y);
        ctx.lineTo(cx + half, y - 40);
      }
      ctx.stroke();
      roundRectPath(ctx, cx - 44, baseY - 450, 88, 54, 10);
      ctx.fill();
      ctx.fillRect(cx - 3, baseY - 510, 6, 62);
      break;
    }
    case 'bejaKeep': {
      // Bejan linnan Torre de Menagem: korkea neliötorni harjakaitein.
      const h = 380;
      const w = 130;
      ctx.fillRect(cx - w / 2, baseY - h, w, h);
      ctx.fillRect(cx - w / 2 - 10, baseY - h - 6, w + 20, 22);
      for (let i = 0; i < 6; i++) ctx.fillRect(cx - w / 2 - 10 + i * 28, baseY - h - 36, 16, 32);
      ctx.fillRect(cx - 300, baseY - 130, 600, 130);
      for (let i = 0; i < 22; i++) ctx.fillRect(cx - 300 + i * 28, baseY - 152, 16, 24);
      ctx.save();
      ctx.globalAlpha *= 0.3;
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 8, baseY - h + 60, 16, 40);
      ctx.fillRect(cx - 8, baseY - h + 150, 16, 40);
      ctx.restore();
      break;
    }
    case 'onionTower': {
      // Baijerilainen barokkikirkon torni sipulikupolilla.
      const h = 320;
      ctx.fillRect(cx - 40, baseY - h, 80, h);
      ctx.beginPath();
      ctx.moveTo(cx - 48, baseY - h);
      ctx.bezierCurveTo(cx - 70, baseY - h - 50, cx - 10, baseY - h - 70, cx, baseY - h - 120);
      ctx.bezierCurveTo(cx + 10, baseY - h - 70, cx + 70, baseY - h - 50, cx + 48, baseY - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - 3, baseY - h - 170, 6, 56);
      ctx.fillRect(cx - 16, baseY - h - 150, 32, 5);
      ctx.fillRect(cx + 40, baseY - 170, 220, 170);
      ctx.beginPath();
      ctx.moveTo(cx + 40, baseY - 170);
      ctx.lineTo(cx + 150, baseY - 240);
      ctx.lineTo(cx + 260, baseY - 170);
      ctx.fill();
      arches(ctx, cx - 24, baseY - h + 40, 48, 1);
      break;
    }
    case 'halmstadCastle': {
      // Halmstadin linna Nissan-joen rannalla: renessanssilinna ja torni.
      ctx.fillRect(cx - 220, baseY - 170, 440, 170);
      ctx.beginPath();
      ctx.moveTo(cx - 236, baseY - 170);
      ctx.lineTo(cx - 170, baseY - 250);
      ctx.lineTo(cx + 170, baseY - 250);
      ctx.lineTo(cx + 236, baseY - 170);
      ctx.fill();
      ctx.fillRect(cx - 40, baseY - 330, 80, 170);
      ctx.beginPath();
      ctx.moveTo(cx - 50, baseY - 330);
      ctx.lineTo(cx, baseY - 430);
      ctx.lineTo(cx + 50, baseY - 330);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha *= 0.22;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) ctx.fillRect(cx - 196 + i * 52, baseY - 130, 20, 34);
      ctx.restore();
      break;
    }
    case 'gediminas': {
      // Vilnan Gediminaksen torni linnamäellä, lippu huipulla.
      ctx.beginPath();
      ctx.ellipse(cx, baseY, 300, 200, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 50, baseY - 330, 100, 150);
      for (let i = 0; i < 4; i++) ctx.fillRect(cx - 50 + i * 30, baseY - 350, 18, 24);
      ctx.fillRect(cx - 2, baseY - 440, 5, 94);
      ctx.save();
      ctx.fillStyle = '#fdb913';
      ctx.fillRect(cx + 3, baseY - 438, 60, 12);
      ctx.fillStyle = '#006a44';
      ctx.fillRect(cx + 3, baseY - 426, 60, 12);
      ctx.fillStyle = '#c1272d';
      ctx.fillRect(cx + 3, baseY - 414, 60, 12);
      ctx.restore();
      break;
    }
    case 'petrov': {
      // Brnon Pyhien Pietarin ja Paavalin katedraali: kaksi terävää tornia.
      ctx.beginPath();
      ctx.ellipse(cx, baseY, 320, 130, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      for (const dx of [-54, 54]) {
        const tx = cx + dx;
        ctx.fillRect(tx - 26, baseY - 330, 52, 230);
        ctx.beginPath();
        ctx.moveTo(tx - 30, baseY - 330);
        ctx.lineTo(tx, baseY - 520);
        ctx.lineTo(tx + 30, baseY - 330);
        ctx.fill();
      }
      ctx.fillRect(cx - 28, baseY - 250, 56, 150);
      ctx.fillRect(cx + 80, baseY - 200, 200, 100);
      ctx.beginPath();
      ctx.moveTo(cx + 80, baseY - 200);
      ctx.lineTo(cx + 180, baseY - 260);
      ctx.lineTo(cx + 280, baseY - 200);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function arches(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, count: number): void {
  ctx.save();
  ctx.globalAlpha *= 0.3;
  ctx.fillStyle = '#000000';
  const gap = w / count;
  for (let i = 0; i < count; i++) {
    const ax = x + i * gap + gap * 0.2;
    const aw = gap * 0.6;
    ctx.beginPath();
    ctx.moveTo(ax, y + 60);
    ctx.lineTo(ax, y + 16);
    ctx.quadraticCurveTo(ax + aw / 2, y - 14, ax + aw, y + 16);
    ctx.lineTo(ax + aw, y + 60);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
