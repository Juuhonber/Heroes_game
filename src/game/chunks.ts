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
  | { t: 'sign'; x: number; y: number; kind: 'fork' | 'pad' | 'orb' };

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
}

const S = (x: number, y = 0): ChunkItem => ({ t: 'spike', x, y });
const K = (x: number, y: number, w: number, h: number): ChunkItem => ({ t: 'block', x, y, w, h });
const P = (x: number, w: number): ChunkItem => ({ t: 'pit', x, w });
const J = (x: number, y = 0): ChunkItem => ({ t: 'pad', x, y });
const O = (x: number, y: number): ChunkItem => ({ t: 'orb', x, y });
const C = (x: number, y: number): ChunkItem => ({ t: 'credit', x, y });
const M = (x: number, y: number): ChunkItem => ({ t: 'module', x, y });
const sign = (x: number, y: number, kind: 'fork' | 'pad' | 'orb'): ChunkItem => ({ t: 'sign', x, y, kind });

export const CHUNKS: Chunk[] = [
  // --- Helpot ---------------------------------------------------------
  { name: 'spike1', difficulty: 1, length: 12, items: [S(6), C(6.5, 4.4)] },
  { name: 'spike2', difficulty: 1, length: 13, items: [S(6), S(7), C(7, 4.6)] },
  { name: 'step', difficulty: 1, length: 16, items: [K(5, 0, 6, 1), C(8, 2), C(9.5, 2)] },
  { name: 'pit3', difficulty: 1, length: 13, items: [P(5, 3), C(6.5, 4.2)] },
  { name: 'hops', difficulty: 1, length: 14, items: [C(4, 3.2), C(7.5, 3.2), C(11, 3.2)] },

  // --- Keskitaso ------------------------------------------------------
  { name: 'spike3', difficulty: 2, length: 15, items: [S(6), S(7), S(8), C(7.5, 4.8)] },
  {
    name: 'stairs',
    difficulty: 2,
    length: 23,
    items: [K(4, 0, 4, 1), K(8, 0, 4, 2), K(12, 0, 7, 3), S(17, 3), C(14, 4.1), C(17.5, 6.6)],
  },
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
];
