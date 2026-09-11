import { Input } from './Input';
import type { GameState } from './GameState';
import type { Clip } from './Animator';
import type { Alliance, Destination } from '../data/destinations';
import type { EuropeMap } from '../data/europe';
import { clamp } from './math';

/** Virtuaaliresoluutio: kaikki piirto tehdään tässä koordinaatistossa. */
export const VIRTUAL_W = 1920;
export const VIRTUAL_H = 1080;

/** Joutoaika sekunteina, jonka jälkeen peli palaa aloitusnäkymään. */
export const IDLE_RESET_SECONDS = 45;
/** Kuinka monta sekuntia ennen palautusta varoitus näytetään. */
export const IDLE_WARN_SECONDS = 10;

export interface GameAssets {
  clips: Record<string, Clip>;
  token: HTMLImageElement;
  destinations: Destination[];
  alliance: Alliance;
  europe: EuropeMap;
}

interface Transition {
  phase: 'out' | 'in';
  t: number;
  next?: { name: string; payload?: unknown };
}

const TRANSITION_SECONDS = 0.28;

export class Game {
  readonly ctx: CanvasRenderingContext2D;
  readonly input: Input;
  /** Kuluva aika sekunteina pelin käynnistyksestä. */
  time = 0;

  private states = new Map<string, GameState>();
  private current: GameState | null = null;
  private transition: Transition | null = null;
  private lastFrame = 0;
  private running = false;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly assets: GameAssets,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D -konteksti ei ole käytettävissä.');
    this.ctx = ctx;
    this.input = new Input(canvas, (cx, cy) => this.clientToVirtual(cx, cy));
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
  }

  register(state: GameState): void {
    this.states.set(state.name, state);
  }

  get currentStateName(): string {
    return this.current?.name ?? '';
  }

  /** Vaihtaa tilan häivytyksen kautta. */
  transitionTo(name: string, payload?: unknown): void {
    if (this.transition?.next?.name === name) return;
    this.transition = { phase: 'out', t: 0, next: { name, payload } };
  }

  /** Vaihtaa tilan välittömästi ilman häivytystä. */
  setState(name: string, payload?: unknown): void {
    const next = this.states.get(name);
    if (!next) throw new Error(`Tuntematon tila: ${name}`);
    this.current?.exit?.(this);
    this.current = next;
    next.enter(this, payload);
  }

  destination(id: string): Destination {
    const found = this.assets.destinations.find((d) => d.id === id);
    if (!found) throw new Error(`Tuntematon kohde: ${id}`);
    return found;
  }

  start(initial: string): void {
    this.setState(initial);
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    // Välilehden palatessa taustalta dt voi olla suuri: rajataan se,
    // jottei hahmo hyppää esteiden läpi.
    const dt = clamp((now - this.lastFrame) / 1000, 0, 1 / 20);
    this.lastFrame = now;
    this.time += dt;

    this.updateTransition(dt);
    this.checkIdle();

    const events = this.input.drain();
    this.current?.update(dt, this.transition ? [] : events);

    this.draw();
    requestAnimationFrame(this.frame);
  };

  private updateTransition(dt: number): void {
    const tr = this.transition;
    if (!tr) return;
    tr.t += dt / TRANSITION_SECONDS;
    if (tr.phase === 'out' && tr.t >= 1) {
      const next = tr.next;
      if (next) this.setState(next.name, next.payload);
      this.transition = { phase: 'in', t: 0 };
    } else if (tr.phase === 'in' && tr.t >= 1) {
      this.transition = null;
    }
  }

  private checkIdle(): void {
    if (this.input.idleSeconds < IDLE_RESET_SECONDS) return;
    if (this.current?.blocksIdleReset?.()) {
      this.input.resetIdle();
      return;
    }
    this.input.resetIdle();
    if (this.current?.name !== 'map') this.transitionTo('map', { idle: true });
  }

  /** Sekunteja jäljellä ennen automaattista palautusta, tai null jos ei lähellä. */
  idleCountdown(): number | null {
    const left = IDLE_RESET_SECONDS - this.input.idleSeconds;
    if (left > IDLE_WARN_SECONDS) return null;
    return Math.max(0, left);
  }

  private draw(): void {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04201d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(
      this.scale * dpr,
      0,
      0,
      this.scale * dpr,
      this.offsetX * dpr,
      this.offsetY * dpr,
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.clip();
    this.current?.render(ctx);
    ctx.restore();

    const tr = this.transition;
    if (tr) {
      const alpha = tr.phase === 'out' ? clamp(tr.t, 0, 1) : clamp(1 - tr.t, 0, 1);
      ctx.fillStyle = `rgba(4, 32, 29, ${alpha})`;
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    }
  }

  private get dpr(): number {
    // Isolla messunäytöllä 2x on turha kuormitus; 1.5 riittää terävyyteen.
    return Math.min(window.devicePixelRatio || 1, 1.5);
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.dpr;
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = Math.min(w / VIRTUAL_W, h / VIRTUAL_H);
    this.offsetX = (w - VIRTUAL_W * this.scale) / 2;
    this.offsetY = (h - VIRTUAL_H * this.scale) / 2;
  }

  private clientToVirtual(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    };
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Selain voi estää koko näytön tilan ilman käyttäjän elettä. Ei kaadeta peliä.
    }
  }
}
