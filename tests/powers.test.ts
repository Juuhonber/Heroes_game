import { describe, expect, it } from 'vitest';
import { RunSim } from '../src/game/RunSim';
import type { SimEvent } from '../src/game/RunSim';
import { OBSTACLE_SHAPES } from '../src/game/Level';
import { GROUND_Y, POWER, POWER_TUNING } from '../src/game/constants';
import { POWER_FOR_STRENGTH } from '../src/game/powers';
import type { Strength } from '../src/data/destinations';
import { DT } from './helpers';

/** Tyhjä rata, jolle testi asettaa omat esteensä. */
function emptyRun(strength: Strength): RunSim {
  const sim = new RunSim({ id: `power-${strength}`, goalDistance: 400, obstacleDensity: 1, strength });
  sim.level.obstacles.length = 0;
  sim.level.pits.length = 0;
  sim.level.tokens.length = 0;
  return sim;
}

function run(sim: RunSim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let f = 0; f < seconds / DT && sim.phase === 'run'; f++) events.push(...sim.step(DT));
  return events;
}

describe('kuutiot', () => {
  it('yksikään kuutio ei kerry pelkällä juoksulla ilman hyppyä', () => {
    const sim = emptyRun('community');
    sim.level.tokens.push({ x: 600, y: GROUND_Y - 205, taken: false });
    sim.level.tokens.push({ x: 900, y: GROUND_Y - 300, taken: false });
    run(sim, 3);
    expect(sim.tokensTaken).toBe(0);
  });
});

describe('supervoimat', () => {
  it('jokainen juoksu alkaa yhdellä varauksella, jotta voiman voi kokeilla heti', () => {
    expect(new RunSim({ id: 'x', goalDistance: 400, obstacleDensity: 1, strength: 'digital' }).charges).toBe(
      POWER.startCharges,
    );
    expect(POWER.startCharges).toBeGreaterThanOrEqual(1);
  });

  it('ilman varauksia voima ei käynnisty ja pelaaja saa palautteen', () => {
    const sim = emptyRun('community');
    sim.charges = 0;
    sim.press('power');
    const events = sim.step(DT);
    expect(events).toContainEqual({ type: 'noCharge' });
    expect(sim.activePower).toBeNull();
  });

  // Tiimisuoja, raketti ja kasvuvoima vievät läpi sekä korkean esteen että
  // kuopan ilman yhtäkään hyppyä.
  for (const strength of ['community', 'innovation', 'sustainability'] as Strength[]) {
    it(`${POWER_FOR_STRENGTH[strength]} vie esteen ja kuopan läpi ilman hyppyä`, () => {
      const sim = emptyRun(strength);
      const tall = OBSTACLE_SHAPES.tall;
      sim.level.obstacles.push({ kind: 'tall', x: 520, w: tall.w, h: tall.h, hit: false, grown: false });
      sim.level.pits.push({ x: 900, w: 200, bridged: false });
      sim.press('power');
      // 2,8 s riittää kuopan (900–1100) ohi alkunopeudella.
      run(sim, 2.8);
      expect(sim.phase).toBe('run');
      expect(sim.player.worldX).toBeGreaterThan(1150);
      expect(sim.jumps).toBe(0);
    });
  }

  it('ilman voimaa sama tilanne kaatuu (testi erottelee)', () => {
    const sim = emptyRun('community');
    const tall = OBSTACLE_SHAPES.tall;
    sim.level.obstacles.push({ kind: 'tall', x: 520, w: tall.w, h: tall.h, hit: false, grown: false });
    run(sim, 2.2);
    expect(sim.phase).toBe('crashed');
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

  it('raketti ei laskeudu esteen päälle', () => {
    const sim = emptyRun('innovation');
    // Esteitä juuri siihen kohtaan, johon lento normaalisti päättyisi.
    const block = OBSTACLE_SHAPES.block;
    for (let x = 1100; x < 1700; x += 150) {
      sim.level.obstacles.push({ kind: 'block', x, w: block.w, h: block.h, hit: false, grown: false });
    }
    sim.press('power');
    run(sim, 4);
    expect(sim.phase).toBe('run');
    expect(sim.player.worldX).toBeGreaterThan(1800);
  });

  it('kuutio esteen yllä kerätään hyvin ajoitetulla hypyllä ja se antaa varauksen', () => {
    const sim = emptyRun('community');
    const block = OBSTACLE_SHAPES.block;
    sim.level.obstacles.push({ kind: 'block', x: 800, w: block.w, h: block.h, hit: false, grown: false });
    sim.level.tokens.push({ x: 845, y: GROUND_Y - 300, taken: false });
    const before = sim.charges;
    // Lakipiste esteen kohdalle: ilma-aika 0,8 s, joten ponnistus 0,4 s ennen.
    for (let f = 0; f < 240 && sim.phase === 'run'; f++) {
      if (sim.player.onGround && sim.player.worldX > 845 - sim.player.speed * 0.4 && sim.jumps === 0) {
        sim.press('jump');
      }
      sim.step(DT);
    }
    expect(sim.phase).toBe('run');
    expect(sim.tokensTaken).toBe(1);
    expect(sim.charges).toBe(before + 1);
  });
});
