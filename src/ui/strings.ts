import type { Strength } from '../data/destinations';
import type { PowerKind } from '../game/powers';

export type Lang = 'fi' | 'en';

type Dict = {
  tagline: string;
  chooseDestination: string;
  chooseHint: string;
  retry: string;
  nextDestination: string;
  backToMap: string;
  success: string;
  fail: string;
  successLead: string;
  failLead: string;
  power: string;
  jumpHint: string;
  powerHint: string;
  idleWarning: string;
  source: string;
  language: string;
  fullscreen: string;
  metres: string;
  strengths: Record<Strength, string>;
  powers: Record<PowerKind, { name: string; desc: string }>;
  creditUnit: string;
  credits: string;
  module: string;
  moduleDone: string;
  moduleTeaser: string;
  signs: { fork: string; pad: string; orb: string; speed: string; grav: string; ceiling: string };
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
  retry: 'Uusi yritys',
  nextDestination: 'Seuraava kohde',
  backToMap: 'Takaisin kartalle',
  success: 'Perillä!',
  fail: 'Törmäys',
  successLead: 'Pääsit perille kohteeseen',
  failLead: 'Matka katkesi kohteeseen',
  power: 'Voima',
  jumpHint: 'Napsauta tai paina VÄLILYÖNTI = hyppy',
  powerHint: 'Voimanappi, VAIHTO tai hiiren oikea = supervoima',
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
  creditUnit: 'op',
  credits: 'Opintopisteet',
  module: 'Oppimiskokonaisuus',
  moduleDone: 'Oppimiskokonaisuus suoritettu',
  moduleTeaser: 'Ylemmältä reitiltä löytyy oppimiskokonaisuus (+5 op) ja bonusfakta.',
  signs: {
    fork: 'Oppimiskokonaisuus 5 op',
    pad: 'Pomppulevy',
    orb: 'Paina renkaassa!',
    speed: 'Vauhti kiihtyy!',
    grav: 'Nostetuuli: hyppy kantaa!',
    ceiling: 'Varo kattoa!',
  },
  noCharge: 'Kerää opintopisteitä!',
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
  retry: 'Try again',
  nextDestination: 'Next destination',
  backToMap: 'Back to map',
  success: 'You made it!',
  fail: 'Crash',
  successLead: 'You reached',
  failLead: 'The run ended on the way to',
  power: 'Power',
  jumpHint: 'Click or press SPACE = jump',
  powerHint: 'Power button, SHIFT or right click = superpower',
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
  creditUnit: 'ECTS',
  credits: 'Study credits',
  module: 'Learning module',
  moduleDone: 'Learning module completed',
  moduleTeaser: 'The upper route hides a learning module (+5 ECTS) and a bonus fact.',
  signs: {
    fork: 'Learning module 5 ECTS',
    pad: 'Jump pad',
    orb: 'Tap in the ring!',
    speed: 'Speed up!',
    grav: 'Thermal: jumps carry!',
    ceiling: 'Mind the ceiling!',
  },
  noCharge: 'Collect study credits!',
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
