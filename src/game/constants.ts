/** Maanpinnan y-koordinaatti virtuaaliruudussa. */
export const GROUND_Y = 880;
/** Pelaajan vaakasijainti ruudulla. */
export const PLAYER_SCREEN_X = 430;
/** Kuinka monta pikseliä vastaa yhtä radan metriä. */
export const PIXELS_PER_METRE = 20;
/** Kenttäsuunnittelun ruutu: palikat, piikit ja välit mitataan tällä. */
export const BLOCK = 60;

/**
 * Fysiikka. Hyppy on aina samanlainen riippumatta painalluksen kestosta,
 * koska messuilla pelataan klikkaamalla. Nopeus on vakio kuten Geometry
 * Dashissa, jolloin kentän rytmi on suunniteltavissa ruudun tarkkuudella.
 *
 * Normaali hyppy: lakipiste v0² / 2g ≈ 291 px (4,85 ruutua), ilma-aika 0,73 s.
 * Pomppulevy: lakipiste ≈ 550 px, joten sillä pääsee normaalia korkeammalle.
 */
export const PHYSICS = {
  gravity: 4400,
  jumpVelocity: -1600,
  padVelocity: -2200,
  coyoteTime: 0.08,
  jumpBuffer: 0.12,
  speed: 620,
  /** Fysiikan aika-askel: pienet askeleet pitävät liikkeen tasaisena kaikilla näytöillä. */
  maxSubstep: 1 / 240,
};

export const JUMP_AIRTIME = (2 * -PHYSICS.jumpVelocity) / PHYSICS.gravity;
export const JUMP_APEX = (PHYSICS.jumpVelocity * PHYSICS.jumpVelocity) / (2 * PHYSICS.gravity);
export const PAD_APEX = (PHYSICS.padVelocity * PHYSICS.padVelocity) / (2 * PHYSICS.gravity);

/** Törmäyslaatikko on spriteä kapeampi, jotta peli tuntuu reilulta. */
export const PLAYER_SIZE = { w: 76, h: 116, drawHeight: 236 };

/** Piikin törmäysalue on piirrettyä kolmiota pienempi, kuten Geometry Dashissa. */
export const SPIKE_HITBOX = { inset: 18, top: 22 };
/** Kuopan reunoilla on armonvara: keskipiste saa hipaista reunaa. */
export const PIT_EDGE_GRACE = 10;
/** Hyppyrenkaan säde: sen sisällä painettu hyppy lähtee ilmasta. */
export const ORB_RADIUS = 52;

export const POWER = { startCharges: 1, maxCharges: 3 };

export const POWER_TUNING = {
  shield: { duration: 2.4 },
  /** Raketti lentää matalalla: läpäisee kaiken, mutta ei kerää bonusreitin palkintoa. */
  rocket: { duration: 1.6, altitude: 200 },
  grow: { range: 1800 },
  slowmo: { duration: 3.4, timeScale: 0.45 },
};

/** Etäisyys, jonka sisällä opintopiste tai oppimiskokonaisuus kerätään. */
export const PICKUP_REACH = { x: 72, y: 96 };
/** Opintopisteitä oppimiskokonaisuudesta. */
export const MODULE_CREDITS = 5;
