import content from '../src/assets/data/destinations.json';
import type { Destination } from '../src/data/destinations';
import { RunSim } from '../src/game/RunSim';
import type { RunPhase, RunSimOptions } from '../src/game/RunSim';

/** step() muuttaa tilaa, jota TypeScript ei näe: luetaan vaihe funktion kautta. */
const phaseOf = (sim: RunSim): RunPhase => sim.phase;

export const DT = 1 / 60;
export const destinations = content.destinations as unknown as Destination[];

/**
 * Leveyshaku yli aikaruutujen. Koska juoksunopeus ei riipu hyppimisestä,
 * maassa oleva pelaaja on samassa paikassa samalla ruudulla riippumatta
 * siitä, miten sinne päästiin. Tila on siis pelkkä ruutuindeksi, ja haku on
 * täydellinen: jos se ei löydä reittiä, reittiä ei ole.
 *
 * Palauttaa ruudut, joilla hyppy painetaan, tai null.
 */
export function solveJumps(
  destination: Destination,
  options: RunSimOptions = {},
): number[] | null {
  const sim = new RunSim(destination, options);
  const maxFrames = 120 * 60;
  const states: ({ snap: ReturnType<RunSim['snapshot']>; schedule: number[] } | undefined)[] = [];
  states[0] = { snap: sim.snapshot(), schedule: [] };

  for (let f = 0; f < maxFrames; f++) {
    const entry = states[f];
    if (!entry) continue;

    // Vaihtoehto A: pysy maassa yksi ruutu.
    sim.restore(entry.snap);
    sim.step(DT);
    if (phaseOf(sim) === 'finished') return entry.schedule;
    if (phaseOf(sim) === 'run' && sim.player.onGround && !states[f + 1]) {
      states[f + 1] = { snap: sim.snapshot(), schedule: entry.schedule };
    }

    // Vaihtoehto B: hyppää tällä ruudulla ja aja laskeutumiseen asti.
    sim.restore(entry.snap);
    sim.press('jump');
    let g = f;
    for (;;) {
      sim.step(DT);
      g += 1;
      if (phaseOf(sim) === 'finished') return [...entry.schedule, f];
      if (phaseOf(sim) !== 'run') break;
      if (sim.player.onGround) {
        if (!states[g]) states[g] = { snap: sim.snapshot(), schedule: [...entry.schedule, f] };
        break;
      }
      if (g - f > 300) break;
    }
  }
  return null;
}

/** Ajaa oikean simulaation annetulla hyppyaikataululla. */
export function replay(destination: Destination, schedule: number[]): RunSim {
  const sim = new RunSim(destination);
  const jumps = new Set(schedule);
  for (let f = 0; f < 120 * 60 && phaseOf(sim) === 'run'; f++) {
    if (jumps.has(f)) sim.press('jump');
    sim.step(DT);
  }
  return sim;
}
