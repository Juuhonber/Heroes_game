export type ActionName = 'primary' | 'secondary';

export interface InputEvent {
  type: 'press' | 'release';
  action: ActionName;
  /** Osoittimen sijainti virtuaalikoordinaatistossa, jos tapahtuma tuli hiirestä tai kosketuksesta. */
  x?: number;
  y?: number;
  pointer: boolean;
}

/**
 * Yhdistää hiiren, kosketuksen ja näppäimistön kahdeksi toiminnoksi.
 *
 * primary   = hiiren vasen, kosketus, väli, nuoli ylös, Enter
 * secondary = hiiren oikea, vaihto, nuoli alas
 *
 * Tilat lukevat tapahtumat jonosta kerran ruudussa, jolloin kuuntelijoita ei
 * tarvitse kytkeä ja purkaa tilasiirtymien yhteydessä.
 */
export class Input {
  private queue: InputEvent[] = [];
  private held = new Set<ActionName>();
  readonly pointer = { x: -1, y: -1, inside: false, down: false };
  lastActivity = performance.now();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly toVirtual: (clientX: number, clientY: number) => { x: number; y: number },
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private keyAction(code: string): ActionName | null {
    switch (code) {
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
      case 'Enter':
        return 'primary';
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'ArrowDown':
      case 'KeyS':
        return 'secondary';
      default:
        return null;
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture?.(e.pointerId);
    const action: ActionName = e.button === 2 ? 'secondary' : 'primary';
    const p = this.toVirtual(e.clientX, e.clientY);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.inside = true;
    this.pointer.down = true;
    this.push({ type: 'press', action, x: p.x, y: p.y, pointer: true });
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.toVirtual(e.clientX, e.clientY);
    // Osoittimen liike ei yksin nollaa joutoaikalaskuria: messupöytää
    // hipaiseva ohikulkija ei saa jäädyttää palautusta aloitusruutuun.
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.inside = true;
  };

  private onPointerUp = (e: PointerEvent): void => {
    const action: ActionName = e.button === 2 ? 'secondary' : 'primary';
    this.pointer.down = false;
    this.push({ type: 'release', action, x: this.pointer.x, y: this.pointer.y, pointer: true });
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const action = this.keyAction(e.code);
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    this.push({ type: 'press', action, pointer: false });
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const action = this.keyAction(e.code);
    if (!action) return;
    e.preventDefault();
    this.push({ type: 'release', action, pointer: false });
  };

  private push(event: InputEvent): void {
    if (event.type === 'press') this.held.add(event.action);
    else this.held.delete(event.action);
    this.lastActivity = performance.now();
    this.queue.push(event);
    if (this.queue.length > 32) this.queue.shift();
  }

  isHeld(action: ActionName): boolean {
    return this.held.has(action);
  }

  /** Palauttaa ruudun aikana kertyneet tapahtumat ja tyhjentää jonon. */
  drain(): InputEvent[] {
    if (this.queue.length === 0) return [];
    const events = this.queue;
    this.queue = [];
    return events;
  }

  get idleSeconds(): number {
    return (performance.now() - this.lastActivity) / 1000;
  }

  resetIdle(): void {
    this.lastActivity = performance.now();
  }
}
