import { describe, expect, it } from 'vitest';
import { SpriteSheet } from '../src/core/SpriteSheet';
import { fitProjection } from '../src/data/europe';
import { destinations } from './helpers';

describe('sprite sheet -leikkaus', () => {
  it('lukee ruudut riveittäin vasemmalta oikealle', () => {
    const sheet = new SpriteSheet({} as CanvasImageSource, 320, 320, 8, 4);
    expect(sheet.frameRect(0)).toEqual({ sx: 0, sy: 0, sw: 320, sh: 320 });
    expect(sheet.frameRect(3)).toEqual({ sx: 960, sy: 0, sw: 320, sh: 320 });
    expect(sheet.frameRect(4)).toEqual({ sx: 0, sy: 320, sw: 320, sh: 320 });
    expect(sheet.frameRect(9)).toEqual(sheet.frameRect(1));
  });
});

describe('kartan projektio', () => {
  const projection = fitProjection(
    { minLon: -14, maxLon: 32, minLat: 35, maxLat: 68 },
    { x: 0, y: 0, w: 1000, h: 800 },
  );
  const at = (id: string) => {
    const d = destinations.find((x) => x.id === id)!;
    return projection.project(d.lon, d.lat);
  };

  it('Seinäjoki on Bejan koillispuolella', () => {
    expect(at('seamk').x).toBeGreaterThan(at('ipbeja').x);
    expect(at('seamk').y).toBeLessThan(at('ipbeja').y);
  });

  it('kaikki kohteet osuvat karttanäkymän sisään', () => {
    for (const d of destinations) {
      const p = projection.project(d.lon, d.lat);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1000);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(800);
    }
  });
});
