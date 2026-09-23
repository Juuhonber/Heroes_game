import { describe, expect, it } from 'vitest';
import { RunSim } from '../src/game/RunSim';
import { OBSTACLE_SHAPES } from '../src/game/Level';
import type { ObstacleKind } from '../src/game/Level';
import { GROUND_Y, PHYSICS } from '../src/game/constants';
import { DT, destinations, replay, solveJumps } from './helpers';

/**
 * Ajoitusvara pikseleinä kumpaankin suuntaan. 48 px on alkunopeudella noin
 * 100 ms ja huippunopeudella 80 ms: messuvieras ehtii reagoida.
 */
const MARGIN = 48;

describe('radat ovat läpäistävissä ilman supervoimia', () => {
  for (const destination of destinations) {
    it(`${destination.name}: reitti löytyy ajoitusvaralla ja toimii oikeassa simulaatiossa`, () => {
      const schedule = solveJumps(destination, { hazardMargin: MARGIN });
      expect(schedule, 'reittiä ei löytynyt').not.toBeNull();
      const sim = replay(destination, schedule!);
      expect(sim.phase).toBe('finished');
    });
  }
});

/** Laskee, kuinka pitkän ajan sisällä hyppy voi lähteä, jotta este ylittyy. */
function jumpWindow(kind: ObstacleKind, startSpeed: number): number {
  let ok = 0;
  for (let takeoff = 0; takeoff < 120; takeoff++) {
    const sim = new RunSim({ id: 'test', goalDistance: 200, obstacleDensity: 1, strength: 'community' });
    sim.level.obstacles.length = 0;
    sim.level.pits.length = 0;
    sim.level.tokens.length = 0;
    const shape = OBSTACLE_SHAPES[kind];
    sim.level.obstacles.push({ kind, x: 900, w: shape.w, h: shape.h, hit: false, grown: false });
    sim.player.speed = startSpeed;
    let crashed = false;
    for (let f = 0; f < 200; f++) {
      if (f === takeoff) sim.press('jump');
      sim.step(DT);
      if (sim.phase === 'crashed') {
        crashed = true;
        break;
      }
      if (sim.player.worldX > 1300 && sim.player.onGround) break;
    }
    if (!crashed) ok += 1;
  }
  return ok * DT;
}

describe('jokainen este on ylitettävissä', () => {
  for (const kind of Object.keys(OBSTACLE_SHAPES) as ObstacleKind[]) {
    it(`${kind}: ajoitusikkuna vähintään 150 ms alku- ja huippunopeudella`, () => {
      expect(jumpWindow(kind, PHYSICS.baseSpeed)).toBeGreaterThanOrEqual(0.15);
      expect(jumpWindow(kind, PHYSICS.maxSpeed)).toBeGreaterThanOrEqual(0.15);
    });
  }

  it('hypyn lakipiste on selvästi korkeimman esteen yläpuolella', () => {
    const sim = new RunSim({ id: 'apex', goalDistance: 200, obstacleDensity: 1, strength: 'community' });
    sim.level.obstacles.length = 0;
    sim.level.pits.length = 0;
    sim.press('jump');
    let top = GROUND_Y;
    for (let f = 0; f < 60; f++) {
      sim.step(DT);
      top = Math.min(top, sim.player.y);
    }
    const tallest = Math.max(...Object.values(OBSTACLE_SHAPES).map((s) => s.h));
    expect(GROUND_Y - top).toBeGreaterThan(tallest + 120);
  });
});
