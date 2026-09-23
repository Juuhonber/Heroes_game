import { assetUrl, loadImage, loadJson } from '../core/loader';

/**
 * Kampuskuvat ovat vapaaehtoisia. Kuva otetaan käyttöön lisäämällä tiedosto
 * kansioon public/campus/ ja rivi tiedostoon public/campus/campus.json:
 *
 *   { "seamk": { "file": "seamk.jpg", "credit": "SeAMK", "source": "seamk.fi" } }
 *
 * Ilman kuvaa kohde käyttää maisemasiluetteja. Kuvan tekijä näytetään pelissä,
 * joten lisenssin vaatima nimeäminen hoituu samalla.
 */
export interface CampusEntry {
  file: string;
  credit: string;
  source?: string;
}

export interface CampusPhoto {
  image: CanvasImageSource;
  width: number;
  height: number;
  entry: CampusEntry;
}

/** Isot valokuvat pienennetään latauksessa: selain ei kanna turhia pikseleitä. */
const MAX_WIDTH = 2600;

type Slot =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; photo: CampusPhoto };

export class CampusPhotos {
  private entries: Record<string, CampusEntry> = {};
  private slots = new Map<string, Slot>();

  async init(): Promise<void> {
    try {
      this.entries = await loadJson<Record<string, CampusEntry>>(assetUrl('campus/campus.json'));
    } catch {
      this.entries = {};
    }
  }

  has(id: string): boolean {
    return Boolean(this.entries[id]);
  }

  /** Aloittaa latauksen taustalla. Turvallinen kutsua monta kertaa. */
  request(id: string): void {
    const entry = this.entries[id];
    if (!entry || this.slots.has(id)) return;
    this.slots.set(id, { state: 'loading' });
    loadImage(assetUrl(`campus/${entry.file}`))
      .then((img) => {
        this.slots.set(id, { state: 'ready', photo: downscale(img, entry) });
      })
      .catch(() => {
        console.warn(`Kampuskuvaa ei löytynyt: campus/${entry.file}`);
        this.slots.set(id, { state: 'failed' });
      });
  }

  get(id: string): CampusPhoto | null {
    const slot = this.slots.get(id);
    return slot?.state === 'ready' ? slot.photo : null;
  }

  preloadAll(): void {
    for (const id of Object.keys(this.entries)) this.request(id);
  }
}

function downscale(img: HTMLImageElement, entry: CampusEntry): CampusPhoto {
  if (img.naturalWidth <= MAX_WIDTH) {
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, entry };
  }
  const scale = MAX_WIDTH / img.naturalWidth;
  const canvas = document.createElement('canvas');
  canvas.width = MAX_WIDTH;
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { image: img, width: img.naturalWidth, height: img.naturalHeight, entry };
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { image: canvas, width: canvas.width, height: canvas.height, entry };
}
