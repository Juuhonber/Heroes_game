/** Sprite sheet -arkin kuvaus. Yksi ruutu = frameWidth x frameHeight lähdepikseliä. */
export interface ClipDef {
  src: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export interface SpriteManifest {
  clips: Record<string, ClipDef>;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kuvaa ei voitu ladata: ${url}`));
    img.src = url;
  });
}

export async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Aineistoa ei voitu ladata: ${url} (${res.status})`);
  return (await res.json()) as T;
}

/**
 * Lataa joukon tehtäviä ja raportoi edistymisen. Tehtävät ajetaan rinnakkain,
 * jotta messukoneen lataus pysyy lyhyenä.
 */
export async function loadAll<T extends Record<string, Promise<unknown>>>(
  tasks: T,
  onProgress?: (done: number, total: number) => void,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const entries = Object.entries(tasks);
  let done = 0;
  onProgress?.(0, entries.length);
  const settled = await Promise.all(
    entries.map(async ([key, promise]) => {
      const value = await promise;
      done += 1;
      onProgress?.(done, entries.length);
      return [key, value] as const;
    }),
  );
  return Object.fromEntries(settled) as { [K in keyof T]: Awaited<T[K]> };
}

/** Polku, joka toimii myös alihakemistoon julkaistuna (vite base: './'). */
export function assetUrl(path: string): string {
  return new URL(path.replace(/^\//, ''), document.baseURI).href;
}
