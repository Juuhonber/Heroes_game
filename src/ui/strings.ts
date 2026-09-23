import type { Strength } from '../data/destinations';
import type { PowerKind } from '../game/powers';

export type Lang = 'fi' | 'en';

type Dict = {
  tagline: string;
  chooseDestination: string;
  chooseHint: string;
  start: string;
  play: string;
  retry: string;
  nextDestination: string;
  backToMap: string;
  success: string;
  fail: string;
  successLead: string;
  failLead: string;
  distance: string;
  goal: string;
  tokens: string;
  power: string;
  powerReady: string;
  jumpHint: string;
  powerHint: string;
  startHint: string;
  idleWarning: string;
  source: string;
  language: string;
  fullscreen: string;
  metres: string;
  strengths: Record<Strength, string>;
  powers: Record<PowerKind, { name: string; desc: string }>;
  noCharge: string;
  tryPower: string;
  jumpPrompt: string;
  scenery: string;
  photo: string;
  stamps: string;
  allStamps: string;
  alliance: string;
};

const fi: Dict = {
  tagline: 'Juokse HEROES-korkeakoulujen läpi',
  chooseDestination: 'Valitse kohde',
  chooseHint: 'Napsauta karttaa tai korkeakoulua listalta',
  start: 'Aloita',
  play: 'Pelaa',
  retry: 'Uusi yritys',
  nextDestination: 'Seuraava kohde',
  backToMap: 'Takaisin kartalle',
  success: 'Perillä!',
  fail: 'Törmäys',
  successLead: 'Pääsit perille kohteeseen',
  failLead: 'Matka katkesi kohteeseen',
  distance: 'Matka',
  goal: 'Maali',
  tokens: 'Kuutiot',
  power: 'Voima',
  powerReady: 'Voima valmiina',
  jumpHint: 'Napsauta tai paina VÄLILYÖNTI = hyppy',
  powerHint: 'Voimanappi, VAIHTO tai hiiren oikea = supervoima',
  startHint: 'Napsauta aloittaaksesi',
  idleWarning: 'Palataan kartalle',
  source: 'Lähde',
  language: 'EN',
  fullscreen: 'Koko näyttö',
  metres: 'm',
  strengths: {
    community: 'Yhteisöllisyys',
    innovation: 'Innovaatiot',
    sustainability: 'Kestävyys',
    digital: 'Digitaalisuus',
  },
  powers: {
    shield: { name: 'Tiimisuoja', desc: 'Murskaa esteet' },
    rocket: { name: 'Rakettireppu', desc: 'Lennä yli' },
    grow: { name: 'Kasvuvoima', desc: 'Esteet kasveiksi' },
    slowmo: { name: 'Hidastus', desc: 'Aika hidastuu' },
  },
  noCharge: 'Kerää kuutioita!',
  tryPower: 'Kokeile supervoimaa!',
  jumpPrompt: 'HYPPÄÄ!',
  scenery: 'Maisemassa',
  photo: 'Kuva',
  stamps: 'Leimat',
  allStamps: 'Kaikki kohteet käyty!',
  alliance: 'HEROES-allianssi',
};

const en: Dict = {
  tagline: 'Run through the HEROES universities',
  chooseDestination: 'Choose a destination',
  chooseHint: 'Click the map or pick an institution from the list',
  start: 'Start',
  play: 'Play',
  retry: 'Try again',
  nextDestination: 'Next destination',
  backToMap: 'Back to map',
  success: 'You made it!',
  fail: 'Crash',
  successLead: 'You reached',
  failLead: 'The run ended on the way to',
  distance: 'Distance',
  goal: 'Goal',
  tokens: 'Cubes',
  power: 'Power',
  powerReady: 'Power ready',
  jumpHint: 'Click or press SPACE = jump',
  powerHint: 'Power button, SHIFT or right click = superpower',
  startHint: 'Click to start',
  idleWarning: 'Returning to the map',
  source: 'Source',
  language: 'FI',
  fullscreen: 'Fullscreen',
  metres: 'm',
  strengths: {
    community: 'Community',
    innovation: 'Innovation',
    sustainability: 'Sustainability',
    digital: 'Digital',
  },
  powers: {
    shield: { name: 'Team shield', desc: 'Smash obstacles' },
    rocket: { name: 'Rocket pack', desc: 'Fly over' },
    grow: { name: 'Growth power', desc: 'Obstacles into plants' },
    slowmo: { name: 'Slow motion', desc: 'Time slows down' },
  },
  noCharge: 'Collect cubes!',
  tryPower: 'Try your superpower!',
  jumpPrompt: 'JUMP!',
  scenery: 'In the scenery',
  photo: 'Photo',
  stamps: 'Stamps',
  allStamps: 'All destinations visited!',
  alliance: 'HEROES alliance',
};

const dicts: Record<Lang, Dict> = { fi, en };

let current: Lang = 'fi';

export const lang = (): Lang => current;

export function setLang(next: Lang): void {
  current = next;
}

export function toggleLang(): void {
  current = current === 'fi' ? 'en' : 'fi';
}

export function t(): Dict {
  return dicts[current];
}

/** Poimii kaksikielisestä kentästä nykyisen kielen. */
export function localized(value: { fi: string; en: string }): string {
  return value[current];
}
