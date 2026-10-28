import { overlaps } from '../core/math';
import type { Destination } from '../data/destinations';
import {
  BLOCK,
  GROUND_Y,
  MODULE_CREDITS,
  PHYSICS,
  PICKUP_REACH,
  PIXELS_PER_METRE,
  PLAYER_SIZE,
  POWER,
  POWER_TUNING,
} from './constants';
import { Level } from './Level';
import { Player } from './Player';
import { POWER_FOR_STRENGTH } from './powers';
import type { PowerKind } from './powers';

export type SimEvent =
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'pad'; x: number; y: number }
  | { type: 'orb'; x: number; y: number }
  | { type: 'bonk' }
  | { type: 'credit'; x: number; y: number }
  | { type: 'module'; x: number; y: number }
  | { type: 'crash'; reason: 'block' | 'spike' | 'pit' }
  | { type: 'goal' }
  | { type: 'power'; kind: PowerKind }
  | { type: 'powerEnd'; kind: PowerKind }
  | { type: 'noCharge' }
  | { type: 'smash'; x: number; y: number }
  | { type: 'grow'; from: number; to: number };

export type RunPhase = 'run' | 'crashed' | 'finished';

type DestinationInput = Pick<Destination, 'id' | 'goalDistance' | 'strength'>;

/** Tarkistetaan vain lähellä pelaajaa olevat kohteet. */
const NEAR = 400;

/**
 * Yhden juoksun koko pelilogiikka ilman piirtoa: fysiikka, palikat, piikit,
 * pomppulevyt, renkaat, opintopisteet, supervoimat ja maali. PlayState
 * piirtää tämän tilan ja välittää syötteen.
 */
export class RunSim {
  readonly level: Level;
  readonly player = new Player();
  readonly power: PowerKind;
  phase: RunPhase = 'run';
  charges: number = POWER.startCharges;
  credits = 0;
  modules = 0;
  jumps = 0;
  powersUsed = 0;
  activePower: PowerKind | null = null;
  powerTimer = 0;
  /** Kulunut todellinen aika sekunteina. */
  time = 0;
  private pending: ('jump' | 'power')[] = [];

  /** @param chunks Testejä varten: pakotettu kenttäpalojen järjestys. */
  constructor(destination: DestinationInput, chunks?: string[]) {
    this.level = new Level(destination, chunks);
    this.power = POWER_FOR_STRENGTH[destination.strength];
  }

  press(action: 'jump' | 'power'): void {
    this.pending.push(action);
  }

  /** Pohjassa pidetty hyppynappi hyppää jokaisella laskeutumisella. */
  setHolding(holding: boolean): void {
    this.player.holding = holding;
  }

  /** Hidastus hidastaa koko maailmaa, myös painovoimaa. */
  get timeScale(): number {
    return this.activePower === 'slowmo' ? POWER_TUNING.slowmo.timeScale : 1;
  }

  get shielded(): boolean {
    return this.activePower === 'shield';
  }

  /** Esteet eivät satuta suojan, lennon tai lennon jälkeisen laskeutumisen aikana. */
  get invulnerable(): boolean {
    return this.shielded || this.player.mode === 'rocket' || this.player.safeUntilLanding;
  }

  /** Opintopisteet: yksi per piste ja viisi oppimiskokonaisuudesta. */
  get totalCredits(): number {
    return this.credits + this.modules * MODULE_CREDITS;
  }

  get distanceMetres(): number {
    return Math.round(Math.min(this.player.worldX, this.level.goalX) / PIXELS_PER_METRE);
  }

  get progress(): number {
    return Math.min(1, this.player.worldX / this.level.goalX);
  }

  /** Onko pelaaja käyttämättömän renkaan kohdalla (testit ja ohjeet). */
  get touchingOrb(): boolean {
    const box = this.player.hitbox;
    return this.level.orbs.some((o) => !o.used && this.level.orbTouches(o, box));
  }

  step(realDt: number): SimEvent[] {
    const events: SimEvent[] = [];
    this.time += realDt;

    if (this.phase !== 'run') {
      this.pending.length = 0;
      this.afterEnd(realDt);
      return events;
    }

    for (const action of this.pending) {
      if (action === 'jump') {
        if (this.player.mode !== 'rocket') this.player.buffer = PHYSICS.jumpBuffer;
      } else {
        this.activatePower(events);
      }
    }
    this.pending.length = 0;

    if (this.activePower) {
      this.powerTimer -= realDt;
      if (this.powerTimer <= 0) this.tryEndPower(events);
    }

    const dt = realDt * this.timeScale;
    const steps = Math.max(1, Math.ceil(dt / PHYSICS.maxSubstep - 1e-9));
    for (let i = 0; i < steps && this.phase === 'run'; i++) this.substep(dt / steps, events);
    return events;
  }

  private substep(h: number, events: SimEvent[]): void {
    const p = this.player;
    const level = this.level;
    const prevY = p.y;
    const prevTop = p.y - PLAYER_SIZE.h;
    const wasGrounded = p.onGround;
    p.worldX += p.speed * h;

    if (p.mode === 'rocket') {
      const target = GROUND_Y - p.rocketAltitude;
      p.y += (target - p.y) * (1 - Math.exp(-8 * h));
      p.vy = 0;
      p.onGround = false;
      this.collectPickups(events);
      this.checkGoal(events);
      return;
    }

    p.coyote = p.onGround ? PHYSICS.coyoteTime : Math.max(0, p.coyote - h);
    p.buffer = Math.max(0, p.buffer - h);

    if ((p.buffer > 0 || (p.holding && p.onGround)) && p.coyote > 0) {
      p.vy = PHYSICS.jumpVelocity;
      p.onGround = false;
      p.coyote = 0;
      p.buffer = 0;
      this.jumps += 1;
      events.push({ type: 'jump' });
    } else if (p.buffer > 0 && !p.onGround) {
      // Hyppyrengas: ilmassa painettu hyppy lähtee renkaan kohdalta.
      const box = p.hitbox;
      const orb = level.orbs.find((o) => !o.used && level.orbTouches(o, box));
      if (orb) {
        orb.used = true;
        p.vy = PHYSICS.jumpVelocity;
        p.buffer = 0;
        events.push({ type: 'orb', x: orb.x, y: orb.y });
      }
    }

    p.vy += PHYSICS.gravity * h;
    p.y += p.vy * h;
    p.onGround = false;

    // Palikat: päälle laskeudutaan, alapintaan kopsahdetaan, kylki kaataa.
    let box = p.hitbox;
    for (const b of level.blocks) {
      if (b.hit || b.x > p.worldX + NEAR || b.x + b.w < p.worldX - NEAR) continue;
      if (!overlaps(box, level.blockRect(b))) continue;
      if (prevY <= b.top + 0.5 && p.vy >= 0) {
        p.y = b.top;
        p.vy = 0;
        p.onGround = true;
      } else if (prevTop >= b.top + b.h - 0.5 && p.vy < 0) {
        p.y = b.top + b.h + PLAYER_SIZE.h;
        p.vy = 0;
        events.push({ type: 'bonk' });
      } else if (this.shielded) {
        b.hit = true;
        events.push({ type: 'smash', x: b.x + b.w / 2, y: b.top + b.h / 2 });
      } else if (!this.invulnerable) {
        this.crash(events, 'block');
        return;
      }
      box = p.hitbox;
    }

    if (!p.onGround) {
      const overPit = !this.shielded && level.isOverPit(p.worldX);
      if (!overPit && p.y >= GROUND_Y && prevY <= GROUND_Y + 0.5) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.onGround = true;
      }
    }

    if (p.onGround && !wasGrounded) {
      p.safeUntilLanding = false;
      events.push({ type: 'land' });
    }

    // Pomppulevy laukeaa kosketuksesta.
    if (p.onGround) {
      for (const pad of level.pads) {
        if (Math.abs(p.y - pad.surface) > 1) continue;
        if (p.worldX < pad.x - 16 || p.worldX > pad.x + BLOCK + 16) continue;
        p.vy = PHYSICS.padVelocity;
        p.onGround = false;
        p.coyote = 0;
        events.push({ type: 'pad', x: pad.x + BLOCK / 2, y: pad.surface });
        break;
      }
    }

    box = p.hitbox;
    for (const s of level.spikes) {
      if (s.hit || s.grown || s.x > p.worldX + NEAR || s.x + BLOCK < p.worldX - NEAR) continue;
      if (!overlaps(box, level.spikeRect(s))) continue;
      if (this.shielded) {
        s.hit = true;
        events.push({ type: 'smash', x: s.x + BLOCK / 2, y: s.base - BLOCK / 2 });
      } else if (!this.invulnerable) {
        this.crash(events, 'spike');
        return;
      }
    }

    if (p.y > GROUND_Y + 60) {
      this.crash(events, 'pit');
      return;
    }

    this.collectPickups(events);
    this.checkGoal(events);
  }

  private checkGoal(events: SimEvent[]): void {
    if (this.phase === 'run' && this.player.worldX >= this.level.goalX) {
      this.phase = 'finished';
      this.activePower = null;
      if (this.player.mode === 'rocket') this.player.mode = 'run';
      events.push({ type: 'goal' });
    }
  }

  /** Maalin tai törmäyksen jälkeen hahmo vain putoaa lähimmälle pinnalle. */
  private afterEnd(dt: number): void {
    const p = this.player;
    if (this.phase === 'finished') p.worldX += p.speed * dt;
    const prevY = p.y;
    p.vy += PHYSICS.gravity * dt;
    p.y += p.vy * dt;
    let surface = this.level.isOverPit(p.worldX) ? Infinity : GROUND_Y;
    for (const b of this.level.blocks) {
      if (b.hit || p.worldX < b.x || p.worldX > b.x + b.w) continue;
      if (prevY <= b.top + 0.5) surface = Math.min(surface, b.top);
    }
    if (p.y >= surface) {
      p.y = surface;
      p.vy = 0;
      p.onGround = true;
    }
  }

  private activatePower(events: SimEvent[]): void {
    if (this.activePower || this.player.mode === 'hurt') return;
    if (this.charges <= 0) {
      events.push({ type: 'noCharge' });
      return;
    }
    this.charges -= 1;
    this.powersUsed += 1;
    events.push({ type: 'power', kind: this.power });

    switch (this.power) {
      case 'shield':
        this.activePower = 'shield';
        this.powerTimer = POWER_TUNING.shield.duration;
        break;
      case 'rocket':
        this.activePower = 'rocket';
        this.powerTimer = POWER_TUNING.rocket.duration;
        this.player.mode = 'rocket';
        this.player.rocketAltitude = POWER_TUNING.rocket.altitude;
        this.player.onGround = false;
        this.player.buffer = 0;
        break;
      case 'slowmo':
        this.activePower = 'slowmo';
        this.powerTimer = POWER_TUNING.slowmo.duration;
        break;
      case 'grow': {
        // Kertavaikutus: edessä olevat piikit muuttuvat kasveiksi ja kuopat
        // kasvavat umpeen. Palikat jäävät, koska ne ovat reittien tasanteita.
        const from = this.player.worldX - PLAYER_SIZE.w;
        const to = this.player.worldX + POWER_TUNING.grow.range;
        for (const s of this.level.spikes) if (s.x + BLOCK >= from && s.x <= to) s.grown = true;
        for (const pit of this.level.pits) if (pit.x + pit.w >= from && pit.x <= to) pit.bridged = true;
        events.push({ type: 'grow', from, to });
        break;
      }
    }
  }

  /**
   * Voima päättyy vasta, kun lopettaminen on turvallista: raketti ei pudota
   * pelaajaa esteen tai kuopan päälle, eikä suoja lopu kuopan kohdalla.
   */
  private tryEndPower(events: SimEvent[]): void {
    const kind = this.activePower;
    if (!kind) return;
    if (kind === 'rocket' && !this.landingZoneClear()) {
      this.powerTimer = 0.05;
      return;
    }
    if (kind === 'shield' && this.level.isOverPit(this.player.worldX)) {
      this.powerTimer = 0.05;
      return;
    }
    if (kind === 'rocket') {
      this.player.mode = 'run';
      this.player.vy = 0;
      this.player.safeUntilLanding = true;
    }
    this.activePower = null;
    this.powerTimer = 0;
    events.push({ type: 'powerEnd', kind });
  }

  private landingZoneClear(): boolean {
    const p = this.player;
    const fallTime = Math.sqrt((2 * Math.max(0, GROUND_Y - p.y)) / PHYSICS.gravity);
    const landX = p.worldX + p.speed * fallTime;
    const from = landX - PLAYER_SIZE.w;
    const to = landX + p.speed * 0.45;
    const hits = (x: number, w: number) => x < to && x + w > from;
    const level = this.level;
    if (level.blocks.some((b) => !b.hit && hits(b.x, b.w))) return false;
    if (level.spikes.some((s) => !s.hit && !s.grown && hits(s.x, BLOCK))) return false;
    if (level.pits.some((pit) => !pit.bridged && hits(pit.x, pit.w))) return false;
    if (level.pads.some((pad) => hits(pad.x, BLOCK))) return false;
    return true;
  }

  private collectPickups(events: SimEvent[]): void {
    const p = this.player;
    const cy = p.y - PLAYER_SIZE.h / 2;
    for (const pickup of this.level.pickups) {
      if (pickup.taken) continue;
      if (Math.abs(pickup.x - p.worldX) > PICKUP_REACH.x) continue;
      if (Math.abs(pickup.y - cy) > PICKUP_REACH.y) continue;
      // Oppimiskokonaisuus ansaitaan taidolla, ei raketilla.
      if (pickup.kind === 'module' && p.mode === 'rocket') continue;
      pickup.taken = true;
      if (pickup.kind === 'module') {
        this.modules += 1;
        events.push({ type: 'module', x: pickup.x, y: pickup.y });
      } else {
        this.credits += 1;
        this.charges = Math.min(POWER.maxCharges, this.charges + 1);
        events.push({ type: 'credit', x: pickup.x, y: pickup.y });
      }
    }
  }

  private crash(events: SimEvent[], reason: 'block' | 'spike' | 'pit'): void {
    this.phase = 'crashed';
    this.activePower = null;
    this.player.mode = 'hurt';
    this.player.vy = Math.min(this.player.vy, -420);
    this.player.safeUntilLanding = false;
    events.push({ type: 'crash', reason });
  }

  /** Tilan kopio hakualgoritmeja varten (testit). */
  snapshot(): RunSnapshot {
    const l = this.level;
    return {
      player: { ...this.player },
      phase: this.phase,
      charges: this.charges,
      credits: this.credits,
      modules: this.modules,
      jumps: this.jumps,
      powersUsed: this.powersUsed,
      activePower: this.activePower,
      powerTimer: this.powerTimer,
      time: this.time,
      flags: [
        ...l.blocks.map((b) => b.hit),
        ...l.spikes.flatMap((s) => [s.hit, s.grown]),
        ...l.pits.map((p) => p.bridged),
        ...l.orbs.map((o) => o.used),
        ...l.pickups.map((p) => p.taken),
      ],
    };
  }

  restore(s: RunSnapshot): void {
    Object.assign(this.player, s.player);
    this.phase = s.phase;
    this.charges = s.charges;
    this.credits = s.credits;
    this.modules = s.modules;
    this.jumps = s.jumps;
    this.powersUsed = s.powersUsed;
    this.activePower = s.activePower;
    this.powerTimer = s.powerTimer;
    this.time = s.time;
    this.pending.length = 0;
    const l = this.level;
    let i = 0;
    for (const b of l.blocks) b.hit = s.flags[i++]!;
    for (const sp of l.spikes) {
      sp.hit = s.flags[i++]!;
      sp.grown = s.flags[i++]!;
    }
    for (const p of l.pits) p.bridged = s.flags[i++]!;
    for (const o of l.orbs) o.used = s.flags[i++]!;
    for (const p of l.pickups) p.taken = s.flags[i++]!;
  }
}

export interface RunSnapshot {
  player: Record<string, unknown>;
  phase: RunPhase;
  charges: number;
  credits: number;
  modules: number;
  jumps: number;
  powersUsed: number;
  activePower: PowerKind | null;
  powerTimer: number;
  time: number;
  flags: boolean[];
}
