/** Maanpinnan y-koordinaatti virtuaaliruudussa. */
export const GROUND_Y = 880;
/** Pelaajan vaakasijainti ruudulla. */
export const PLAYER_SCREEN_X = 430;
/** Kuinka monta pikseliä vastaa yhtä radan metriä. */
export const PIXELS_PER_METRE = 20;

export const PHYSICS = {
  gravity: 3400,
  jumpVelocity: -1320,
  /** Hypyn katkaisu, kun painallus vapautetaan nousun aikana. */
  jumpCutoff: 0.45,
  coyoteTime: 0.1,
  jumpBuffer: 0.13,
  baseSpeed: 470,
  maxSpeed: 610,
  /** Kiihtyvyys pikseleinä sekunnissa toiseen. */
  speedRamp: 9,
};

export const PLAYER_SIZE = { w: 104, h: 132, drawHeight: 236 };

/** Suojavoiman kesto sekunteina ja suurin varausmäärä. */
export const POWER = { duration: 1.5, maxCharges: 3, speedBoost: 130 };
