import type { Strength } from '../data/destinations';

/**
 * Supervoimat. Jokainen vahvuusalue saa oman voimansa, jolloin toinen
 * toiminto kertoo jotain kohteen teemasta.
 */
export type PowerKind = 'shield' | 'rocket' | 'grow' | 'slowmo';

export const POWER_FOR_STRENGTH: Record<Strength, PowerKind> = {
  community: 'shield',
  innovation: 'rocket',
  sustainability: 'grow',
  digital: 'slowmo',
};
