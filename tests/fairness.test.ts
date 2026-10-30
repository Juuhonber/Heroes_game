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
 * 9 peräkkäiseen ruutuun (150 ms 60 Hz:llä). Bonusreitillä vara on
 * 5 ruutua (83 ms): se on tarkoituksella vaikeampi.
 */
const MAIN_WINDOW = 4;
const BONUS_WINDOW = 2;

describe('jokainen rata on läpäistävissä ilman supervoimia', () => {
  for (const destination of destinations) {
    it(`${destination.name}: pääreitti 150 ms ajoitusvaralla, myös 50 ja 144 Hz:llä`, () => {
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

/** Radat, joilla pala esiintyy: oma pala omistajallaan, reittivalinta käyttäjillään, yhteiset kaikilla. */
function hosts(chunk: (typeof CHUNKS)[number]): Destination[] {
  const test = (d: Destination) => ({ ...d, goalDistance: 260 });
  if (chunk.owner) return destinations.filter((d) => d.id === chunk.owner).map(test);
  if (chunk.fork) return destinations.filter((d) => d.level.fork === chunk.name).map(test);
  // Yhteiset palat: hitain ja nopein tempo kattavat kaikki radat.
  const bySpeed = [...destinations].sort((a, b) => a.level.speed - b.level.speed);
  return [bySpeed[0]!, bySpeed[bySpeed.length - 1]!].map(test);
}

describe('kenttäpalat', () => {
  for (const chunk of CHUNKS) {
    it(`${chunk.name} on läpäistävissä yksinään jokaisen käyttäjäradan tempolla`, () => {
      const users = hosts(chunk);
      expect(users.length, 'palaa ei käytä mikään rata').toBeGreaterThan(0);
      for (const d of users) {
        expect(new Solver(d, { window: MAIN_WINDOW, chunks: [chunk.name] }).solve(), d.id).toBe(true);
      }
    });
  }

  it('korkeiden seinien yli ei pääse tavallisella hypyllä', () => {
    for (const chunk of CHUNKS.filter((c) => c.higher)) {
      const tallest = Math.max(
        ...chunk.items.filter((i) => i.t === 'block').map((i) => (i.t === 'block' ? (i.y + i.h) * BLOCK : 0)),
      );
      expect(tallest, chunk.name).toBeGreaterThan(JUMP_APEX + 40);
    }
  });

  it('korkean seinän edessä on aina pomppulevy, rengas tai nostetuuli', () => {
    for (const chunk of CHUNKS.filter((c) => c.higher)) {
      expect(chunk.items.some((i) => i.t === 'pad' || i.t === 'orb' || i.t === 'grav'), chunk.name).toBe(true);
    }
  });

  it('pomppulevy riittää jokaisen pomppulevyseinän yli', () => {
    for (const chunk of CHUNKS.filter((c) => c.higher && c.items.some((i) => i.t === 'pad'))) {
      const pad = chunk.items.find((i) => i.t === 'pad')!;
      const padHeight = pad.t === 'pad' ? pad.y * BLOCK : 0;
      const tallest = Math.max(
        ...chunk.items.filter((i) => i.t === 'block').map((i) => (i.t === 'block' ? (i.y + i.h) * BLOCK : 0)),
      );
      expect(tallest, chunk.name).toBeLessThan(padHeight + PAD_APEX);
    }
  });

  it('reittivalinnan ylempi reitti on vaikeampi kuin alempi', () => {
    for (const chunk of CHUNKS.filter((c) => c.fork)) {
      for (const d of hosts(chunk)) {
        const widest = (requireModules: boolean) => {
          let best = -1;
          for (let k = 0; k <= 7; k++) {
            if (new Solver(d, { window: k, chunks: [chunk.name], requireModules }).solve()) best = k;
            else break;
          }
          return best;
        };
        const upper = widest(true);
        expect(upper, `${chunk.name} @ ${d.id}`).toBeGreaterThanOrEqual(BONUS_WINDOW);
        expect(upper, `${chunk.name} @ ${d.id}`).toBeLessThan(widest(false));
      }
    }
  });

  it('alempi reitti kulkee ilmassa olevien tasanteiden alta', () => {
    for (const chunk of CHUNKS.filter((c) => c.fork)) {
      for (const item of chunk.items) {
        if (item.t === 'block' && item.y > 0) {
          expect(item.y * BLOCK, chunk.name).toBeGreaterThan(PLAYER_SIZE.h + 40);
        }
      }
    }
  });
});

describe('ratojen erilaisuus', () => {
  const levels = destinations.map((d) => ({ d, level: new RunSim(d).level }));

  it('jokaisella radalla on vähintään kaksi omaa palaa, ja kaikki ovat mukana radalla', () => {
    for (const { d, level } of levels) {
      const own = CHUNKS.filter((c) => c.owner === d.id);
      expect(own.length, d.id).toBeGreaterThanOrEqual(2);
      for (const c of own) expect(level.layout, `${d.id}: ${c.name}`).toContain(c.name);
    }
  });

  it('yli puolet jokaisen radan paloista on radan omia tai sen reittivalinta', () => {
    for (const { d, level } of levels) {
      const ownNames = new Set(CHUNKS.filter((c) => c.owner === d.id).map((c) => c.name));
      ownNames.add(d.level.fork);
      const ownMetres = level.layout.filter((n) => ownNames.has(n)).reduce((s, n) => s + CHUNKS.find((c) => c.name === n)!.length, 0);
      const allMetres = level.layout.reduce((s, n) => s + CHUNKS.find((c) => c.name === n)!.length, 0);
      expect(ownMetres / allMetres, d.id).toBeGreaterThan(0.5);
    }
  });

  it('kahdella radalla on korkeintaan kolmannes samoja paloja', () => {
    for (let i = 0; i < levels.length; i++) {
      for (let j = i + 1; j < levels.length; j++) {
        const a = new Set(levels[i]!.level.layout);
        const b = new Set(levels[j]!.level.layout);
        const common = [...a].filter((n) => b.has(n)).length;
        const union = new Set([...a, ...b]).size;
        expect(common / union, `${levels[i]!.d.id} – ${levels[j]!.d.id}`).toBeLessThanOrEqual(1 / 3);
      }
    }
  });

  it('radoilla on eri tempoja ja vähintään neljä erilaista reittivalintaa', () => {
    expect(new Set(destinations.map((d) => d.level.speed)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(destinations.map((d) => d.level.fork)).size).toBeGreaterThanOrEqual(4);
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
