import { assetUrl, loadJson } from '../core/loader';

export interface EuropeMap {
  source: string;
  bbox: [number, number, number, number];
  countries: { name: string; rings: [number, number][][] }[];
}

export function loadEurope(): Promise<EuropeMap> {
  return loadJson<EuropeMap>(assetUrl('data/europe.json'));
}

/**
 * Mercator-projektio. Riittävä Euroopan mittakaavassa ja pitää maat
 * tunnistettavan muotoisina.
 */
export function mercatorX(lonDeg: number): number {
  return (lonDeg * Math.PI) / 180;
}

export function mercatorY(latDeg: number): number {
  const lat = (Math.max(-85, Math.min(85, latDeg)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}

export interface Projection {
  project(lon: number, lat: number): { x: number; y: number };
}

/**
 * Sovittaa annetun lon/lat-alueen suorakulmioon mittasuhteet säilyttäen.
 */
export function fitProjection(
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  view: { x: number; y: number; w: number; h: number },
): Projection {
  // Mercatorissa y kasvaa pohjoiseen, ruudulla alaspäin, joten y-akseli
  // käännetään. Molemmat akselit ovat radiaaneja, jotta mittasuhde säilyy.
  const left = mercatorX(bounds.minLon);
  const spanX = mercatorX(bounds.maxLon) - left;
  const top = mercatorY(bounds.maxLat);
  const spanY = top - mercatorY(bounds.minLat);
  const scale = Math.min(view.w / spanX, view.h / spanY);
  const offsetX = view.x + (view.w - spanX * scale) / 2;
  const offsetY = view.y + (view.h - spanY * scale) / 2;
  return {
    project(lon: number, lat: number) {
      return {
        x: offsetX + (mercatorX(lon) - left) * scale,
        y: offsetY + (top - mercatorY(lat)) * scale,
      };
    },
  };
}
