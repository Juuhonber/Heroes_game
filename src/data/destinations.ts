import { assetUrl, loadJson } from '../core/loader';

/**
 * Vahvuusalueet ovat allianssin teemoja. Kohdekohtainen vahvuus on pelin
 * visuaalinen teema, ei allianssin virallinen työnjako; faktakentät sen sijaan
 * perustuvat lähdesivuihin (source).
 */
export type Strength = 'community' | 'innovation' | 'sustainability' | 'digital';

export type Terrain = 'forest' | 'city' | 'coast' | 'fields' | 'hills';

export interface Localized {
  fi: string;
  en: string;
}

export interface Theme {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  ground: string;
  groundDark: string;
  accent: string;
}

export interface Destination {
  id: string;
  name: string;
  longName: Localized;
  city: string;
  country: Localized;
  lat: number;
  lon: number;
  strength: Strength;
  fact: Localized;
  source: string;
  terrain: Terrain;
  theme: Theme;
  /** Radan pituus metreinä. */
  goalDistance: number;
  /** Esteiden tiheyskerroin: 1 = perustaso. */
  obstacleDensity: number;
  /** Valinnainen kampuskuva kaukataustaksi, polku public-kansiosta. */
  campusImage?: string;
}

export interface Alliance {
  name: string;
  longName: Localized;
  facts: Localized;
  source: string;
}

export interface ContentFile {
  alliance: Alliance;
  destinations: Destination[];
}

export function loadContent(): Promise<ContentFile> {
  return loadJson<ContentFile>(assetUrl('data/destinations.json'));
}

export const STRENGTH_COLORS: Record<Strength, string> = {
  community: '#ffb454',
  innovation: '#f2e85c',
  sustainability: '#7ee08a',
  digital: '#6fe3ff',
};
