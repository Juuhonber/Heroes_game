import type { ClipDef } from './loader';

/**
 * Leikkaa sprite sheet -arkin ruudukoksi. Ruudut numeroidaan riveittäin
 * vasemmalta oikealle, eli indeksi 0 on vasen ylänurkka.
 */
export class SpriteSheet {
  readonly rows: number;

  constructor(
    readonly image: CanvasImageSource,
    readonly frameWidth: number,
    readonly frameHeight: number,
    readonly frameCount: number,
    readonly columns: number,
  ) {
    this.rows = Math.ceil(frameCount / columns);
  }

  static fromDef(image: CanvasImageSource, def: ClipDef): SpriteSheet {
    return new SpriteSheet(image, def.frameWidth, def.frameHeight, def.frames, def.columns);
  }

  /** Ruudun lähdesuorakulmio arkilla. */
  frameRect(index: number): { sx: number; sy: number; sw: number; sh: number } {
    const i = ((index % this.frameCount) + this.frameCount) % this.frameCount;
    return {
      sx: (i % this.columns) * this.frameWidth,
      sy: Math.floor(i / this.columns) * this.frameHeight,
      sw: this.frameWidth,
      sh: this.frameHeight,
    };
  }

  /** Piirtää yhden ruudun. Origo on kohdealueen vasen yläkulma. */
  draw(
    ctx: CanvasRenderingContext2D,
    index: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    flipX = false,
  ): void {
    const { sx, sy, sw, sh } = this.frameRect(index);
    if (!flipX) {
      ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(this.image, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
  }
}
