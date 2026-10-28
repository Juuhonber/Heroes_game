import contentJson from '../assets/data/destinations.json';

/**
 * Vahvuusalueet ovat allianssin teemoja. Kohdekohtainen vahvuus on pelin
 * visuaalinen teema, ei allianssin virallinen työnjako; faktakentät sen sijaan
 * perustuvat lähdesivuihin (source).
 */
export type Strength = 'community' | 'innovation' | 'sustainability' | 'digital';

/** Taustakerrosten maisematyypit. */
export type SceneryKind =
  | 'spruce'
  | 'birch'
  | 'deciduous'
  | 'olive'
  | 'city'
  | 'modern'
  | 'gables'
  | 'whitehouses'
  | 'barns'
  | 'hills'
  | 'mountains'
  | 'fields'
  | 'dunes'
  | 'sea'
  | 'vineyard';

/** Kaupungin tunnistettava maamerkki siluettina horisontissa. */
export type LandmarkKind =
  | 'lakeudenRisti'
  | 'rumbold'
  | 'evoluon'
  | 'aalborgTower'
  | 'bejaKeep'
  | 'onionTower'
  | 'halmstadCastle'
  | 'gediminas'
  | 'petrov';

export interface Scenery {
  far: SceneryKind;
  mid: SceneryKind;
  near: SceneryKind;
}

export interface Landmark {
  kind: LandmarkKind;
  name: Localized;
}

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
  scenery: Scenery;
  landmark: Landmark;
  theme: Theme;
  /** Radan pituus metreinä. */
  goalDistance: number;
  /** Esteiden tiheyskerroin: 1 = perustaso. */
  obstacleDensity: number;
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

/**
 * Sisältö pakataan pelin koodiin käännösvaiheessa. Näin peli toimii myös
 * yhtenä HTML-tiedostona suoraan levyltä, jossa selain ei salli hakuja.
 */
export const CONTENT = contentJson as unknown as ContentFile;

export const STRENGTH_COLORS: Record<Strength, string> = {
  community: '#ffb454',
  innovation: '#f2e85c',
  sustainability: '#7ee08a',
  digital: '#6fe3ff',
};
