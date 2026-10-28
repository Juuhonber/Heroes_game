import { describe, expect, it } from 'vitest';
import { CHUNKS } from '../src/game/chunks';
import { BLOCK, JUMP_APEX, PAD_APEX, PLAYER_SIZE } from '../src/game/constants';
import { RunSim } from '../src/game/RunSim';
import { DT, Solver, destinations, extractPlan } from './helpers';
import type { Destination } from '../src/data/destinations';

/**
 * Ajaa suunnitelman oikealla simulaatiolla annetulla ruudunpäivityksellä.
 * Ratkaisija käyttää 60 Hz:iä; peli ajetaan messuilla mitä tahansa näyttöä
 * vasten, joten suunnitelman on toimittava myös 50 ja 144 Hz:llä.
 */
function replay(destination: Destination, plan: number[], dt: number): RunSim {
  const sim = new RunSim(destination);
  let i = 0;
  for (let f = 0; f < 6000 && sim.phase === 'run'; f++) {
    while (i < plan.length && sim.time >= plan[i]! - 1e-6) {
      sim.press('jump');
      i += 1;
    }
    sim.step(dt);
  }
  return sim;
}

/**
 * Pääreitin ajoitusvara: jokaisen hypyn painallus saa osua mihin tahansa
 * 11 peräkkäiseen ruutuun (183 ms 60 Hz:llä). Bonusreitillä vara on
 * 5 ruutua (83 ms): se on tarkoituksella vaikeampi.
 */
const MAIN_WINDOW = 5;
const BONUS_WINDOW = 2;

describe('jokainen rata on läpäistävissä ilman supervoimia', () => {
  for (const destination of destinations) {
    it(`${destination.name}: pääreitti 183 ms ajoitusvaralla, myös 50 ja 144 Hz:llä`, () => {
      const solver = new Solver(destination, { window: MAIN_WINDOW });
      expect(solver.solve()).toBe(true);
      const plan = extractPlan(solver);
      for (const dt of [1 / 50, 1 / 60, 1 / 144]) expect(replay(destination, plan, dt).phase, `dt ${dt}`).toBe('finished');
    });
    it(`${destination.name}: bonusreitti oppimiskokonaisuuteen asti`, () => {
      const solver = new Solver(destination, { window: BONUS_WINDOW, requireModules: true });
      expect(solver.sim.level.moduleTotal).toBe(1);
      expect(solver.solve()).toBe(true);
      const plan = extractPlan(solver);
      for (const dt of [1 / 50, 1 / 60, 1 / 144]) {
        const sim = replay(destination, plan, dt);
        expect(sim.phase, `dt ${dt}`).toBe('finished');
        expect(sim.modules, `dt ${dt}`).toBe(1);
      }
    });
  }
});

describe('kenttäpalat', () => {
  const test = { ...destinations[0]!, goalDistance: 220 };

  for (const chunk of CHUNKS) {
    it(`${chunk.name} on läpäistävissä yksinään pääreitin ajoitusvaralla`, () => {
      expect(new Solver(test, { window: MAIN_WINDOW, chunks: [chunk.name] }).solve()).toBe(true);
    });
  }

  it('korkeiden seinien yli ei pääse tavallisella hypyllä, mutta pomppulevyllä pääsee', () => {
    for (const chunk of CHUNKS.filter((c) => c.higher)) {
      const tallest = Math.max(
        ...chunk.items.filter((i) => i.t === 'block').map((i) => (i.t === 'block' ? (i.y + i.h) * BLOCK : 0)),
      );
      expect(tallest, chunk.name).toBeGreaterThan(JUMP_APEX + 40);
      expect(tallest, chunk.name).toBeLessThan(PAD_APEX);
    }
  });

  it('korkean seinän edessä on aina pomppulevy tai hyppyrengas', () => {
    for (const chunk of CHUNKS.filter((c) => c.higher)) {
      expect(chunk.items.some((i) => i.t === 'pad' || i.t === 'orb'), chunk.name).toBe(true);
    }
  });

  it('reittivalinnan ylempi reitti on vaikeampi kuin alempi', () => {
    for (const chunk of CHUNKS.filter((c) => c.fork)) {
      const widest = (requireModules: boolean) => {
        let best = -1;
        for (let k = 0; k <= 8; k++) {
          if (new Solver(test, { window: k, orbWindow: Math.min(k, 3), chunks: [chunk.name], requireModules }).solve()) best = k;
        }
        return best;
      };
      const lower = widest(false);
      const upper = widest(true);
      expect(upper, chunk.name).toBeGreaterThanOrEqual(BONUS_WINDOW);
      expect(upper, chunk.name).toBeLessThan(lower);
    }
  });

  it('alempi reitti kulkee tasanteiden alta ilman kumartumista', () => {
    for (const chunk of CHUNKS.filter((c) => c.fork)) {
      for (const item of chunk.items) {
        if (item.t === 'block') expect(item.y * BLOCK, chunk.name).toBeGreaterThan(PLAYER_SIZE.h + 40);
      }
    }
  });
});

describe('fysiikka', () => {
  it('hyppy on yhtä korkea riippumatta siitä, pidetäänkö nappia pohjassa', () => {
    const tops = [false, true].map((holding) => {
      const sim = new RunSim({ id: 'hyppy', goalDistance: 200, strength: 'community' }, ['hops']);
      sim.level.pickups.length = 0;
      sim.setHolding(holding);
      sim.press('jump');
      let top = Infinity;
      for (let f = 0; f < 40; f++) {
        sim.step(DT);
        top = Math.min(top, sim.player.y);
      }
      return top;
    });
    expect(tops[0]).toBeCloseTo(tops[1]!, 5);
  });

  it('liike on sama ruudunpäivitysnopeudesta riippumatta', () => {
    const run = (dt: number) => {
      const sim = new RunSim({ id: 'fps', goalDistance: 200, strength: 'community' }, ['hops']);
      sim.press('jump');
      let top = Infinity;
      for (let t = 0; t < 0.6; t += dt) {
        sim.step(dt);
        top = Math.min(top, sim.player.y);
      }
      return top;
    };
    // 30, 60 ja 144 Hz: hypyn lakipiste poikkeaa korkeintaan pari pikseliä.
    expect(Math.abs(run(1 / 30) - run(1 / 144))).toBeLessThan(3);
    expect(Math.abs(run(1 / 60) - run(1 / 144))).toBeLessThan(3);
  });
});
