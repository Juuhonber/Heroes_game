/** Maanpinnan y-koordinaatti virtuaaliruudussa. */
export const GROUND_Y = 880;
/** Pelaajan vaakasijainti ruudulla. */
export const PLAYER_SCREEN_X = 430;
/** Kuinka monta pikseliä vastaa yhtä radan metriä. */
export const PIXELS_PER_METRE = 20;

/**
 * Hyppy on aina samanlainen riippumatta siitä, kuinka pitkään nappia
 * painetaan. Messuilla pelataan hiiren klikkauksella, ja klikkaus on lyhyt
 * painallus: vaihteleva hyppykorkeus teki korkeista esteistä mahdottomia.
 *
 * Huippukorkeus = v0² / 2g = 300 px, ilma-aika = 2 v0 / g = 0,8 s.
 */
export const PHYSICS = {
  gravity: 3750,
  jumpVelocity: -1500,
  coyoteTime: 0.1,
  jumpBuffer: 0.16,
  baseSpeed: 470,
  maxSpeed: 600,
  /** Kiihtyvyys pikseleinä sekunnissa toiseen. */
  speedRamp: 8,
};

export const JUMP_AIRTIME = (2 * -PHYSICS.jumpVelocity) / PHYSICS.gravity;
export const JUMP_APEX = (PHYSICS.jumpVelocity * PHYSICS.jumpVelocity) / (2 * PHYSICS.gravity);

/** Törmäyslaatikko on spriteä kapeampi, jotta peli tuntuu reilulta. */
export const PLAYER_SIZE = { w: 84, h: 120, drawHeight: 236 };
/** Spriten ruudun alareunan ja jalkojen väli ruudun korkeuteen suhteutettuna. */
export const SPRITE_FOOT_PAD = 0.085;

/** Esteen törmäysalue on piirrettyä muotoa hieman pienempi. */
export const OBSTACLE_INSET = { x: 6, top: 8 };
/** Kuopan reunoilla on armonvara: keskipiste saa hipaista reunaa. */
export const PIT_EDGE_GRACE = 10;

export const POWER = { startCharges: 1, maxCharges: 3 };

export const POWER_TUNING = {
  shield: { duration: 2.4 },
  rocket: { duration: 1.9, altitude: 250 },
  grow: { range: 1800 },
  slowmo: { duration: 3.4, timeScale: 0.45 },
};

/** Etäisyys, jonka sisällä kuutio kerätään. */
export const TOKEN_REACH = { x: 90, y: 115 };
