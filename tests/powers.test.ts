import { describe, expect, it } from 'vitest';
import { RunSim } from '../src/game/RunSim';
import type { SimEvent } from '../src/game/RunSim';
import { BLOCK, GROUND_Y, POWER, POWER_TUNING } from '../src/game/constants';
import { POWER_FOR_STRENGTH } from '../src/game/powers';
import type { Strength } from '../src/data/destinations';
import { DT } from './helpers';

/** Tyhjä rata, jolle testi asettaa omat esteensä. */
function emptyRun(strength: Strength): RunSim {
  const sim = new RunSim({ id: `power-${strength}`, goalDistance: 400, strength }, []);
  return sim;
}

function run(sim: RunSim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let f = 0; f < seconds / DT && sim.phase === 'run'; f++) events.push(...sim.step(DT));
  return events;
}

/** Piikkirivi ja kuoppa pelaajan edessä. */
function hazards(sim: RunSim): void {
  for (let i = 0; i < 3; i++) sim.level.spikes.push({ x: 600 + i * BLOCK, base: GROUND_Y, hit: false, grown: false });
  sim.level.pits.push({ x: 1100, w: 200, bridged: false });
}

describe('opintopisteet', () => {
  it('ilmassa oleva opintopiste ei kerry pelkällä juoksulla', () => {
    const sim = emptyRun('community');
    sim.level.pickups.push({ x: 600, y: GROUND_Y - 3.2 * BLOCK, kind: 'credit', taken: false });
    run(sim, 2);
    expect(sim.credits).toBe(0);
  });

  it('hypyllä kerätty opintopiste kasvattaa pisteitä ja voimavarausta', () => {
    const sim = emptyRun('community');
    sim.level.pickups.push({ x: 600, y: GROUND_Y - 3.2 * BLOCK, kind: 'credit', taken: false });
    sim.charges = 0;
    // Kaari kulkee 3,2 ruudun korkeuden kautta noin 0,1 s ponnistuksen jälkeen.
    for (let f = 0; f < 120; f++) {
      if (sim.jumps === 0 && sim.player.worldX > 600 - sim.player.speed * 0.1) sim.press('jump');
      sim.step(DT);
    }
    expect(sim.credits).toBe(1);
    expect(sim.charges).toBe(1);
  });

  it('oppimiskokonaisuus on viiden opintopisteen arvoinen', () => {
    const sim = emptyRun('community');
    sim.level.pickups.push({ x: 500, y: GROUND_Y - BLOCK, kind: 'module', taken: false });
    run(sim, 1);
    expect(sim.modules).toBe(1);
    expect(sim.totalCredits).toBe(5);
  });
});

describe('supervoimat', () => {
  it('jokainen juoksu alkaa yhdellä varauksella', () => {
    expect(emptyRun('digital').charges).toBe(POWER.startCharges);
    expect(POWER.startCharges).toBeGreaterThanOrEqual(1);
  });

  it('ilman varauksia voima ei käynnisty ja pelaaja saa palautteen', () => {
    const sim = emptyRun('community');
    sim.charges = 0;
    sim.press('power');
    expect(sim.step(DT)).toContainEqual({ type: 'noCharge' });
    expect(sim.activePower).toBeNull();
  });

  it('ilman voimaa piikkirivi kaatuu (testi erottelee)', () => {
    const sim = emptyRun('community');
    hazards(sim);
    run(sim, 2.5);
    expect(sim.phase).toBe('crashed');
  });

  for (const strength of ['community', 'innovation', 'sustainability'] as Strength[]) {
    it(`${POWER_FOR_STRENGTH[strength]} vie piikkirivin ja kuopan läpi ilman hyppyä`, () => {
      const sim = emptyRun(strength);
      hazards(sim);
      sim.press('power');
      run(sim, 2.6);
      expect(sim.phase).toBe('run');
      expect(sim.player.worldX).toBeGreaterThan(1350);
      expect(sim.jumps).toBe(0);
    });
  }

  it('tiimisuoja murskaa myös palikan, johon muuten törmäisi', () => {
    const sim = emptyRun('community');
    sim.level.blocks.push({ x: 700, top: GROUND_Y - 3 * BLOCK, w: 3 * BLOCK, h: 3 * BLOCK, hit: false });
    sim.press('power');
    run(sim, 1.5);
    expect(sim.phase).toBe('run');
    expect(sim.level.blocks[0]!.hit).toBe(true);
  });

  it('hidastus hidastaa maailmaa voiman keston ajan', () => {
    const normal = emptyRun('digital');
    run(normal, 1);
    const slowed = emptyRun('digital');
    slowed.press('power');
    run(slowed, 1);
    const ratio = slowed.player.worldX / normal.player.worldX;
    expect(ratio).toBeGreaterThan(POWER_TUNING.slowmo.timeScale - 0.05);
    expect(ratio).toBeLessThan(POWER_TUNING.slowmo.timeScale + 0.05);
    run(slowed, POWER_TUNING.slowmo.duration);
    expect(slowed.activePower).toBeNull();
  });

  it('raketti ei laskeudu esteen päälle eikä kerää oppimiskokonaisuutta', () => {
    const sim = emptyRun('innovation');
    for (let x = 1000; x < 1700; x += 120) sim.level.spikes.push({ x, base: GROUND_Y, hit: false, grown: false });
    sim.level.pickups.push({ x: 800, y: GROUND_Y - 4.3 * BLOCK, kind: 'module', taken: false });
    sim.press('power');
    run(sim, 4);
    expect(sim.phase).toBe('run');
    expect(sim.player.worldX).toBeGreaterThan(1800);
    expect(sim.modules).toBe(0);
  });
});
