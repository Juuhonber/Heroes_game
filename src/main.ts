import { Game } from './core/Game';
import type { GameAssets } from './core/Game';
import { makeClip } from './core/Animator';
import type { Clip } from './core/Animator';
import { assetUrl, loadAll, loadImage, loadJson } from './core/loader';
import type { SpriteManifest } from './core/loader';
import { loadContent } from './data/destinations';
import { loadEurope } from './data/europe';
import { CampusPhotos } from './data/campus';
import { MapState } from './states/MapState';
import { PlayState } from './states/PlayState';
import { ResultState } from './states/ResultState';

const boot = document.getElementById('boot');
const bootBar = boot?.querySelector('span') as HTMLElement | null;

function progress(done: number, total: number): void {
  if (bootBar) bootBar.style.width = `${Math.round((done / total) * 100)}%`;
}

async function start(): Promise<void> {
  const canvas = document.getElementById('stage');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas-elementtiä ei löytynyt.');

  const manifest = await loadJson<SpriteManifest>(assetUrl('sprites/sprites.json'));

  const clipNames = Object.keys(manifest.clips);
  const campus = new CampusPhotos();
  const loaded = await loadAll(
    {
      content: loadContent(),
      europe: loadEurope(),
      token: loadImage(assetUrl('sprites/token.svg')),
      campus: campus.init(),
      sheets: Promise.all(
        clipNames.map(async (name) => {
          const def = manifest.clips[name]!;
          return [name, await loadImage(assetUrl(def.src))] as const;
        }),
      ),
    },
    progress,
  );

  const clips: Record<string, Clip> = {};
  for (const [name, image] of loaded.sheets) {
    clips[name] = makeClip(image, manifest.clips[name]!);
  }

  const assets: GameAssets = {
    clips,
    token: loaded.token,
    destinations: loaded.content.destinations,
    alliance: loaded.content.alliance,
    europe: loaded.europe,
    campus,
  };

  const game = new Game(canvas, assets);
  game.register(new MapState());
  game.register(new PlayState());
  game.register(new ResultState());
  game.start('map');

  // Testiapuri: ?test=1 avaa peliobjektin selaimen konsoliin ja
  // automaatiotesteille. Ilman parametria mitään ei viedä globaaliin tilaan.
  if (new URLSearchParams(location.search).has('test')) {
    (window as unknown as { heroes: Game }).heroes = game;
  }

  // Kampuskuvat ladataan taustalla, jotta aloitusnäkymä aukeaa heti.
  campus.preloadAll();

  boot?.classList.add('hidden');
  window.setTimeout(() => boot?.remove(), 400);
}

start().catch((error: unknown) => {
  console.error(error);
  if (boot) {
    boot.innerHTML = `<h1>HEROES</h1><p>Peliä ei voitu ladata.</p><p style="opacity:.6">${
      error instanceof Error ? error.message : String(error)
    }</p>`;
  }
});
