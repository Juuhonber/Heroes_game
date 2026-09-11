import type { Game } from './Game';
import type { InputEvent } from './Input';

/** Pelin tilakoneen yksi tila. */
export interface GameState {
  readonly name: string;
  /** Kutsutaan kun tilaan siirrytään. Payload tulee vaihtajalta. */
  enter(game: Game, payload?: unknown): void;
  exit?(game: Game): void;
  update(dt: number, events: readonly InputEvent[]): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Palauttaa true, jos tila haluaa estää automaattisen palautuksen kartalle. */
  blocksIdleReset?(): boolean;
}
