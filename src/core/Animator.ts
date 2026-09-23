import { SpriteSheet } from './SpriteSheet';
import type { ClipDef } from './loader';

export interface Clip {
  sheet: SpriteSheet;
  fps: number;
  loop: boolean;
}

export function makeClip(image: CanvasImageSource, def: ClipDef): Clip {
  return { sheet: SpriteSheet.fromDef(image, def), fps: def.fps, loop: def.loop };
}

/** Toistaa nimettyjä animaatioita ja pitää kirjaa nykyisestä ruudusta. */
export class Animator {
  private current: string;
  private time = 0;
  private frame = 0;

  constructor(
    private readonly clips: Record<string, Clip>,
    initial: string,
  ) {
    this.current = initial;
  }

  get name(): string {
    return this.current;
  }

  get frameIndex(): number {
    return this.frame;
  }

  get clip(): Clip {
    const clip = this.clips[this.current];
    if (!clip) throw new Error(`Tuntematon animaatio: ${this.current}`);
    return clip;
  }

  /** Kertaalleen toistettava animaatio on valmis, kun viimeinen ruutu on näytetty. */
  get finished(): boolean {
    const clip = this.clip;
    return !clip.loop && this.frame >= clip.sheet.frameCount - 1;
  }

  play(name: string, restart = false): void {
    if (name === this.current && !restart) return;
    if (!this.clips[name]) throw new Error(`Tuntematon animaatio: ${name}`);
    this.current = name;
    this.time = 0;
    this.frame = 0;
  }

  /** Asettaa ruudun suoraan, esimerkiksi hypyn nousu- ja laskuvaiheelle. */
  setFrame(index: number): void {
    this.frame = Math.max(0, Math.min(this.clip.sheet.frameCount - 1, index));
    this.time = 0;
  }

  update(dt: number): void {
    const clip = this.clip;
    this.time += dt;
    const step = 1 / clip.fps;
    while (this.time >= step) {
      this.time -= step;
      if (clip.loop) {
        this.frame = (this.frame + 1) % clip.sheet.frameCount;
      } else if (this.frame < clip.sheet.frameCount - 1) {
        this.frame += 1;
      } else {
        this.time = 0;
        break;
      }
    }
  }

  /** Piirtää nykyisen ruudun keskitettynä pisteeseen (x, y) alareunasta. */
  drawAnchored(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    height: number,
    flipX = false,
  ): void {
    const clip = this.clip;
    const scale = height / clip.sheet.frameHeight;
    const width = clip.sheet.frameWidth * scale;
    clip.sheet.draw(ctx, this.frame, x - width / 2, y - height, width, height, flipX);
  }
}
