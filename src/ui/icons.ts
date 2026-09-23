import type { PowerKind } from '../game/powers';

/** Supervoimien kuvakkeet vektoreina: skaalautuvat messunäytölle tarkkoina. */
export function drawPowerIcon(
  ctx: CanvasRenderingContext2D,
  kind: PowerKind,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(38, -30);
      ctx.quadraticCurveTo(36, 22, 0, 46);
      ctx.quadraticCurveTo(-36, 22, -38, -30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-4, -26, 8, 50);
      ctx.fillRect(-22, -4, 44, 8);
      break;
    case 'rocket':
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.quadraticCurveTo(24, -24, 18, 20);
      ctx.lineTo(-18, 20);
      ctx.quadraticCurveTo(-24, -24, 0, -48);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18, 4);
      ctx.lineTo(-34, 30);
      ctx.lineTo(-16, 22);
      ctx.moveTo(18, 4);
      ctx.lineTo(34, 30);
      ctx.lineTo(16, 22);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, 26);
      ctx.lineTo(0, 50);
      ctx.lineTo(10, 26);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(0, -14, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'grow':
      ctx.beginPath();
      ctx.moveTo(-30, 40);
      ctx.quadraticCurveTo(-40, -30, 36, -44);
      ctx.quadraticCurveTo(38, 30, -30, 40);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-34, 46);
      ctx.quadraticCurveTo(-4, 6, 24, -26);
      ctx.stroke();
      break;
    case 'slowmo':
      ctx.beginPath();
      ctx.moveTo(-30, -44);
      ctx.lineTo(30, -44);
      ctx.lineTo(0, 0);
      ctx.lineTo(30, 44);
      ctx.lineTo(-30, 44);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-16, 44);
      ctx.lineTo(0, 20);
      ctx.lineTo(16, 44);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}
