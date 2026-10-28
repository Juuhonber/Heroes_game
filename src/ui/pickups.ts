import { font } from './theme';

/**
 * Opintopisteen ja oppimiskokonaisuuden kuvat piirretään kerran
 * välimuistiin: ne näkyvät ruudulla monta kertaa ja pyörivät jatkuvasti.
 */
const cache = new Map<string, HTMLCanvasElement>();

function offscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')!];
}

/** Opintopiste: kultainen kolikko, jossa yksikkö (op tai ECTS). */
export function creditSprite(unit: string): HTMLCanvasElement {
  const key = `credit:${unit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = offscreen(72, 72);
  const g = ctx.createRadialGradient(28, 26, 4, 36, 36, 32);
  g.addColorStop(0, '#fff6c2');
  g.addColorStop(0.6, '#f5d24a');
  g.addColorStop(1, '#d9a514');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(36, 36, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#7a5a00';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(122, 90, 0, 0.45)';
  ctx.beginPath();
  ctx.arc(36, 36, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#4a3400';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font('display', unit.length > 2 ? 15 : 24);
  ctx.fillText(unit, 36, 38);
  cache.set(key, canvas);
  return canvas;
}

/** Oppimiskokonaisuus: kirja vahvuusalueen värissä ja nauha "5 op". */
export function moduleSprite(color: string, label: string): HTMLCanvasElement {
  const key = `module:${color}:${label}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = offscreen(120, 110);
  // Sivut
  ctx.fillStyle = '#f6f3e6';
  roundRect(ctx, 26, 24, 74, 60, 8);
  ctx.fill();
  ctx.strokeStyle = '#04201d';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Kansi
  ctx.fillStyle = color;
  roundRect(ctx, 18, 16, 74, 62, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(18, 16, 14, 62);
  // Nauha
  ctx.fillStyle = '#04201d';
  roundRect(ctx, 34, 36, 54, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font('display', label.length > 5 ? 13 : 17);
  ctx.fillText(label, 61, 50);
  // Kirjanmerkki
  ctx.fillStyle = '#ff7a59';
  ctx.beginPath();
  ctx.moveTo(74, 78);
  ctx.lineTo(74, 100);
  ctx.lineTo(81, 93);
  ctx.lineTo(88, 100);
  ctx.lineTo(88, 78);
  ctx.closePath();
  ctx.fill();
  cache.set(key, canvas);
  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
