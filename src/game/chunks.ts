/**
 * Kenttäpalat. Kenttä kootaan käsin suunnitelluista paloista samaan tapaan
 * kuin Geometry Dashissa: jokaisella palalla on oma rytminsä, ja palat
 * valitaan vaikeuden mukaan radan edetessä.
 *
 * Yksiköt ovat ruutuja (BLOCK = 60 px). x mitataan palan alusta, y maasta
 * ylöspäin. Normaali hyppy nousee noin 4,85 ruutua ja kantaa 7,5 ruutua,
 * pomppulevy nousee noin 9 ruutua. Pelaaja on noin 1,3 × 1,9 ruutua.
 *
 * Säännöt kuten Geometry Dashissa: palikan päälle voi laskeutua ja sen
 * alta voi kulkea, mutta palikan kylkeen törmääminen kaataa. Piikit
 * kaatavat aina. Palikan alapintaan hypätessä pää kopsahtaa vaarattomasti.
 */
export type ChunkItem =
  | { t: 'spike'; x: number; y: number }
  | { t: 'block'; x: number; y: number; w: number; h: number }
  | { t: 'pit'; x: number; w: number }
  | { t: 'pad'; x: number; y: number }
  | { t: 'orb'; x: number; y: number }
  | { t: 'credit'; x: number; y: number }
  | { t: 'module'; x: number; y: number }
  | { t: 'sign'; x: number; y: number; kind: SignKind }
  /** Kattopiikki: roikkuu korkeudelta y (palikan alapinnasta), kärki alaspäin. */
  | { t: 'cspike'; x: number; y: number }
  /** Nopeusportti: tästä eteenpäin juoksunopeus kerrotaan luvulla factor. */
  | { t: 'speed'; x: number; factor: number }
  /** Nostetuuli: vyöhykkeellä painovoima on pienempi, hypyt kantavat pidemmälle. */
  | { t: 'grav'; x: number; w: number };

export type SignKind = 'fork' | 'pad' | 'orb' | 'speed' | 'grav' | 'ceiling';

export interface Chunk {
  name: string;
  /** 1 = helppo, 2 = keskitaso, 3 = vaikea. */
  difficulty: 1 | 2 | 3;
  /** Pakollinen korkea hyppy (pomppulevy tai rengas). */
  higher?: boolean;
  /** Reittivalinta: ylempi reitti on vaikeampi ja siellä on oppimiskokonaisuus. */
  fork?: boolean;
  length: number;
  items: ChunkItem[];
  /**
   * Kohteen tunniste, jos pala kuuluu vain tämän kohteen radalle. Omat palat
   * antavat jokaiselle radalle oman luonteen; yhteiset palat ovat täytettä.
   */
  owner?: string;
}

const S = (x: number, y = 0): ChunkItem => ({ t: 'spike', x, y });
const K = (x: number, y: number, w: number, h: number): ChunkItem => ({ t: 'block', x, y, w, h });
const P = (x: number, w: number): ChunkItem => ({ t: 'pit', x, w });
const J = (x: number, y = 0): ChunkItem => ({ t: 'pad', x, y });
const O = (x: number, y: number): ChunkItem => ({ t: 'orb', x, y });
const C = (x: number, y: number): ChunkItem => ({ t: 'credit', x, y });
const M = (x: number, y: number): ChunkItem => ({ t: 'module', x, y });
const sign = (x: number, y: number, kind: SignKind): ChunkItem => ({ t: 'sign', x, y, kind });
const X = (x: number, y: number): ChunkItem => ({ t: 'cspike', x, y });
const V = (x: number, factor: number): ChunkItem => ({ t: 'speed', x, factor });
const G = (x: number, w: number): ChunkItem => ({ t: 'grav', x, w });

export const CHUNKS: Chunk[] = [
  // --- Helpot ---------------------------------------------------------
  { name: 'spike1', difficulty: 1, length: 12, items: [S(6), C(6.5, 4.4)] },
  { name: 'spike2', difficulty: 1, length: 13, items: [S(6), S(7), C(7, 4.6)] },
  { name: 'step', difficulty: 1, length: 16, items: [K(5, 0, 6, 1), C(8, 2), C(9.5, 2)] },
  { name: 'pit3', difficulty: 1, length: 13, items: [P(5, 3), C(6.5, 4.2)] },
  { name: 'hops', difficulty: 1, length: 14, items: [C(4, 3.2), C(7.5, 3.2), C(11, 3.2)] },

  // --- Keskitaso ------------------------------------------------------
  { name: 'spike3', difficulty: 2, length: 15, items: [S(6), S(7), S(8), C(7.5, 4.8)] },
  { name: 'stones', difficulty: 2, length: 19, items: [P(4, 12), K(8, 1, 3, 1), C(9.5, 3.1)] },
  { name: 'blockspike', difficulty: 2, length: 18, items: [K(4, 0, 10, 1), S(9, 1), C(9.5, 5.6)] },
  { name: 'pitspike', difficulty: 2, length: 22, items: [P(4, 3), S(14), C(5.5, 4.2), C(14.5, 4.6)] },

  // --- Vaikeat --------------------------------------------------------
  { name: 'spike4', difficulty: 3, length: 16, items: [S(6), S(7), S(8), S(9), C(8, 5)] },
  { name: 'doublepit', difficulty: 3, length: 20, items: [P(4, 3), P(12, 4), C(13.8, 4.4)] },
  {
    name: 'tower',
    difficulty: 3,
    length: 24,
    items: [K(4, 0, 5, 3), K(9, 0, 3, 2), K(12, 0, 3, 1), S(20), C(6.5, 4.2), C(20.5, 4.6)],
  },

  // --- Korkea hyppy: ilman levyä tai rengasta seinän yli ei pääse ----
  {
    name: 'padwall',
    difficulty: 2,
    higher: true,
    length: 18,
    items: [J(5), K(9, 0, 5, 6), C(11.5, 7.2), sign(5.5, 3.2, 'pad')],
  },
  {
    name: 'orbwall',
    difficulty: 2,
    higher: true,
    length: 21,
    items: [O(6, 3.5), K(11, 0, 5, 6), C(13.5, 7.2), sign(6, 5.6, 'orb')],
  },

  // --- Reittivalinnat --------------------------------------------------
  {
    // Rengas vie ylemmälle reitille, jossa on katkoja ja piikkejä.
    // Alempi reitti kulkee tasaisena tasanteiden alta.
    name: 'fork-orb',
    difficulty: 2,
    fork: true,
    length: 42,
    items: [
      O(6, 3.2),
      sign(6, 5.4, 'fork'),
      K(9, 5, 7, 1),
      K(19, 5, 6, 1),
      S(22, 6),
      K(28, 5, 8, 1),
      M(32, 7.4),
      C(12, 7),
      C(22.5, 9.6),
      C(30, 7),
      C(14, 1),
      C(24, 1),
    ],
  },
  {
    // Matalalle tasanteelle pääsee tavallisella, tarkasti ajoitetulla
    // hypyllä. Ylhäällä hypitään katkojen yli; alhaalla juostaan suoraan.
    name: 'fork-low',
    difficulty: 2,
    fork: true,
    length: 40,
    items: [
      sign(6, 5.6, 'fork'),
      K(7, 3, 9, 1),
      K(19, 4, 6, 1),
      S(22, 5),
      K(28, 3, 7, 1),
      M(32, 5.4),
      C(11, 5),
      C(22.5, 8.6),
      C(30, 5),
      C(12, 1),
      C(25, 1),
    ],
  },

  // --- Lisää reittivalintoja ---------------------------------------------
  {
    // Pakolliset portaat ylös; ylhäältä voi jatkaa vaikeaa tasannereittiä
    // tai pudottautua alas helpolle maareitille.
    name: 'fork-high',
    difficulty: 2,
    fork: true,
    length: 46,
    items: [
      K(4, 0, 4, 1),
      K(8, 0, 4, 2),
      K(12, 0, 5, 3),
      sign(14.5, 6.2, 'fork'),
      K(20, 4, 5, 1),
      K(28, 4, 6, 1),
      S(31, 5),
      K(37, 4, 6, 1),
      M(40, 6.4),
      C(22.5, 6.2),
      C(31.5, 8.6),
      C(24, 1),
      C(32, 1),
    ],
  },
  {
    // Ilmassa leijuvan pomppulevyn päälle hypätään, jos haluaa ylös.
    name: 'fork-pad',
    difficulty: 2,
    fork: true,
    length: 42,
    items: [
      sign(6.5, 6.4, 'fork'),
      K(5, 3, 3, 1),
      J(6, 4),
      K(13, 6, 8, 1),
      K(24, 6, 5, 1),
      S(26, 7),
      K(32, 6, 6, 1),
      M(35, 8.4),
      C(17, 8),
      C(26.5, 10.6),
      C(14, 1),
      C(28, 1),
    ],
  },
  {
    // Nostetuulessa tavallinen hyppy riittää ylemmälle tasanteelle.
    name: 'fork-thermal',
    difficulty: 2,
    fork: true,
    length: 38,
    items: [
      G(2, 10),
      sign(5, 6.4, 'fork'),
      K(9, 5, 7, 1),
      K(19, 5, 5, 1),
      S(21, 6),
      K(27, 5, 6, 1),
      M(30, 7.4),
      C(12, 7),
      C(21.5, 9.6),
      C(14, 1),
      C(24, 1),
    ],
  },

  // --- SeAMK: lakeuden kiito – nopea, tasainen rytmi ja ladot -----------
  {
    name: 'lakeus-rhythm',
    owner: 'seamk',
    difficulty: 2,
    length: 30,
    items: [S(5), S(6), S(14), S(15), S(23), S(24), S(25), C(6, 4.6), C(15, 4.6), C(24.5, 4.8)],
  },
  {
    name: 'ladot',
    owner: 'seamk',
    difficulty: 2,
    length: 28,
    items: [K(4, 0, 5, 1), K(12, 0, 5, 2), K(20, 0, 6, 1), C(6.5, 2), C(14.5, 3), C(23, 2)],
  },
  {
    name: 'siilo',
    owner: 'seamk',
    difficulty: 2,
    higher: true,
    length: 20,
    items: [K(3, 0, 5, 1), J(6, 1), K(11, 0, 3, 8), C(12.5, 9.2), sign(6.5, 4.2, 'pad')],
  },

  // --- Thomas More: porraspäädyt – portaita ylös ja alas ----------------
  {
    name: 'gables',
    owner: 'thomasmore',
    difficulty: 2,
    length: 26,
    items: [K(4, 0, 3, 1), K(7, 0, 3, 2), K(10, 0, 3, 3), K(13, 0, 3, 2), K(16, 0, 3, 1), S(22), C(11.5, 4.1), C(22.5, 4.4)],
  },
  {
    name: 'rooftops',
    owner: 'thomasmore',
    difficulty: 3,
    length: 22,
    items: [P(4, 16), K(7, 1, 4, 1), K(13, 2, 4, 1), C(15, 4.2)],
  },
  {
    name: 'belfry',
    owner: 'thomasmore',
    difficulty: 2,
    higher: true,
    length: 20,
    items: [K(4, 0, 4, 2), J(6, 2), K(11, 0, 4, 8), C(13, 9.2), sign(6.5, 5.2, 'pad')],
  },

  // --- Fontys: piirilevy – rengasketjut ja nopeusportti -----------------
  {
    name: 'orbchain',
    owner: 'fontys',
    difficulty: 2,
    length: 25,
    items: [P(4, 17), O(9, 3.8), O(16, 3.8), C(12.5, 6), sign(9, 6, 'orb')],
  },
  {
    name: 'circuit',
    owner: 'fontys',
    difficulty: 3,
    length: 36,
    items: [K(4, 0, 10, 1), S(10, 1), K(23, 0, 10, 2), S(29, 2), C(10.5, 5.6), C(29.5, 6.6)],
  },
  {
    name: 'speedgate',
    owner: 'fontys',
    difficulty: 2,
    length: 44,
    items: [V(2, 1.18), sign(2, 4.4, 'speed'), S(11), S(12), S(23), S(34), S(35), C(11.5, 4.6), C(23.5, 4.6), V(42, 1)],
  },

  // --- UCN: Limvuonon lautat – vettä, lauttoja ja satamanosturit --------
  {
    name: 'ferries',
    owner: 'ucn',
    difficulty: 2,
    length: 28,
    items: [P(4, 20), K(8, 1, 4, 1), K(15, 1, 4, 1), C(10, 3), C(17, 3)],
  },
  {
    name: 'jetty',
    owner: 'ucn',
    difficulty: 2,
    higher: true,
    length: 24,
    items: [K(4, 0, 6, 1), J(8, 1), P(10, 6), K(16, 0, 4, 6), C(18, 7.2), sign(8.5, 4.2, 'pad')],
  },
  {
    name: 'harbour',
    owner: 'ucn',
    difficulty: 2,
    length: 26,
    items: [K(5, 4, 12, 1), X(7, 4), X(10, 4), X(13, 4), S(22), C(11, 1), C(22.5, 4.4), sign(5.5, 6.2, 'ceiling')],
  },

  // --- IPBeja: Alentejon nostetuuli – kevyet, pitkät hypyt --------------
  {
    name: 'thermal',
    owner: 'ipbeja',
    difficulty: 2,
    length: 22,
    items: [G(2, 16), P(6, 10), C(11, 7), sign(3, 4.4, 'grav')],
  },
  {
    name: 'olivegrove',
    owner: 'ipbeja',
    difficulty: 1,
    length: 38,
    items: [S(5), S(14), S(15), S(24), S(33), S(34), C(14.5, 4.4), C(33.5, 4.4)],
  },
  {
    name: 'keep',
    owner: 'ipbeja',
    difficulty: 2,
    higher: true,
    length: 20,
    items: [G(2, 13), K(10, 0, 4, 7), C(12, 8.2)],
  },

  // --- DIT: Baijerin terassit – rinteitä ja pomppulevyketju -------------
  {
    name: 'terraces',
    owner: 'thdeg',
    difficulty: 2,
    length: 32,
    items: [K(4, 0, 8, 1), K(12, 0, 8, 2), S(16, 2), K(20, 0, 8, 3), C(8, 2), C(16.5, 6.6), C(24, 4)],
  },
  {
    name: 'padchain',
    owner: 'thdeg',
    difficulty: 2,
    higher: true,
    length: 26,
    items: [J(4), K(9, 0, 5, 5), J(11, 5), K(17, 0, 4, 9), C(19, 10.2), sign(4.5, 3.2, 'pad')],
  },
  {
    name: 'forest-hop',
    owner: 'thdeg',
    difficulty: 3,
    length: 24,
    items: [S(5), S(6), K(10, 0, 2, 2), S(14), S(15), K(19, 0, 2, 2), C(5.5, 4.6), C(14.5, 4.6)],
  },

  // --- Halmstad: rantakalliot – dyynit, vuorovesialtaat, kallioräystäät -
  {
    name: 'dunes',
    owner: 'halmstad',
    difficulty: 1,
    length: 24,
    items: [K(4, 0, 6, 1), K(11, 0, 3, 2), K(15, 0, 6, 1), C(7, 2), C(12.5, 3), C(18, 2)],
  },
  {
    name: 'tidepools',
    owner: 'halmstad',
    difficulty: 3,
    length: 43,
    items: [P(4, 3), S(15), P(16, 3), S(26), S(27), P(37, 4), C(5.5, 4.2), C(17, 5), C(26.5, 4.6), C(39, 4.2)],
  },
  {
    name: 'cliffs',
    owner: 'halmstad',
    difficulty: 2,
    length: 28,
    items: [K(4, 5, 19, 1), X(5, 5), X(6, 5), S(12), X(20, 5), X(21, 5), C(12.5, 3), sign(4.5, 7.2, 'ceiling')],
  },

  // --- VIKO: linnamäki – muurit, sakarat ja rengas tornin huipulle ------
  {
    name: 'battlements',
    owner: 'viko',
    difficulty: 2,
    length: 30,
    items: [K(4, 0, 24, 2), S(12, 2), S(20, 2), C(12.5, 6.6), C(20.5, 6.6)],
  },
  {
    name: 'castlehill',
    owner: 'viko',
    difficulty: 2,
    higher: true,
    length: 22,
    items: [K(4, 0, 4, 2), O(9, 5.5), K(12, 0, 4, 8), C(14, 9.2), sign(9, 7.7, 'orb')],
  },
  {
    name: 'gediminas',
    owner: 'viko',
    difficulty: 3,
    length: 24,
    items: [K(4, 0, 4, 1), K(8, 0, 4, 2), K(12, 0, 6, 3), S(15, 3), C(15.5, 6.8)],
  },

  // --- MENDELU: Mendelin herneet – viinirivit, herneenpalot, kellari ----
  {
    name: 'vinerows',
    owner: 'mendelu',
    difficulty: 2,
    length: 30,
    items: [K(4, 0, 2, 1), S(14), S(15), K(25, 0, 2, 1), C(5, 3.4), C(14.5, 4.6), C(26, 3.4)],
  },
  {
    name: 'peapods',
    owner: 'mendelu',
    difficulty: 3,
    length: 24,
    items: [P(4, 17), K(8, 1, 4, 1), K(14, 2, 4, 1), C(10, 3), C(16, 4)],
  },
  {
    name: 'cellar',
    owner: 'mendelu',
    difficulty: 2,
    length: 24,
    items: [K(4, 5, 16, 1), S(9), S(16), C(12.5, 1.2)],
  },
];
