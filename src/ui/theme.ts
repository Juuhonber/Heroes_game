export const PALETTE = {
  ink: '#04201d',
  inkSoft: 'rgba(4, 32, 29, 0.72)',
  paper: '#f6f3e6',
  paperDim: 'rgba(246, 243, 230, 0.72)',
  teal: '#19a08c',
  tealDark: '#0f7c6c',
  tealDeep: '#073b36',
  yellow: '#f0e558',
  coral: '#ff7a59',
  white: '#ffffff',
};

export const FONT = {
  display: '700 {size}px "Segoe UI", system-ui, Arial, sans-serif',
  body: '400 {size}px "Segoe UI", system-ui, Arial, sans-serif',
  bold: '600 {size}px "Segoe UI", system-ui, Arial, sans-serif',
};

export const font = (kind: keyof typeof FONT, size: number): string =>
  FONT[kind].replace('{size}', String(Math.round(size)));

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Katkaisee tekstin riveiksi annettuun leveyteen. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Pienentää fonttia kunnes teksti mahtuu leveyteen. */
export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  kind: keyof typeof FONT,
  startSize: number,
  minSize = 12,
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = font(kind, size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = font(kind, size);
  return size;
}

export function shadow(ctx: CanvasRenderingContext2D, blur: number, alpha = 0.35): void {
  ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = blur * 0.28;
}

export function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
