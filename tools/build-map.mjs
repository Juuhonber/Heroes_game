/**
 * Rakentaa Euroopan kartan geometrian pelin staattiseksi aineistoksi.
 *
 * Lähde: Natural Earth (public domain) npm-paketin world-atlas kautta.
 * Tuloste: src/assets/data/europe.json, joka sisältää maiden rajapolygonit
 * asteina (lon/lat). Projektio tehdään ajonaikaisesti selaimessa.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// Rajaus, jonka sisältä geometria säilytetään.
const CLIP = { minLon: -26, maxLon: 46, minLat: 32, maxLat: 72 };

// Yksinkertaistuksen kynnys asteina. Isompi arvo = pienempi tiedosto.
const SIMPLIFY_DEG = 0.06;
// Rengas hylätään, jos sen pinta-ala jää tämän alle (neliöastetta).
const MIN_AREA = 0.02;

const topo = JSON.parse(
  readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'),
);
const geo = feature(topo, topo.objects.countries);

/** Poistaa päivämäärärajan ylitykset jatkamalla pituusasteita monotonisesti. */
function unwrap(ring) {
  const out = [];
  let offset = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    if (i > 0) {
      const prev = ring[i - 1][0] + offset;
      if (lon + offset - prev > 180) offset -= 360;
      else if (lon + offset - prev < -180) offset += 360;
    }
    out.push([lon + offset, lat]);
  }
  return out;
}

/** Sutherland–Hodgman -leikkaus suorakulmioon. */
function clipRing(ring, box) {
  const edges = [
    { inside: (p) => p[0] >= box.minLon, cut: (a, b) => lerpX(a, b, box.minLon) },
    { inside: (p) => p[0] <= box.maxLon, cut: (a, b) => lerpX(a, b, box.maxLon) },
    { inside: (p) => p[1] >= box.minLat, cut: (a, b) => lerpY(a, b, box.minLat) },
    { inside: (p) => p[1] <= box.maxLat, cut: (a, b) => lerpY(a, b, box.maxLat) },
  ];
  let poly = ring;
  for (const edge of edges) {
    const next = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i];
      const prev = poly[(i + poly.length - 1) % poly.length];
      const curIn = edge.inside(cur);
      const prevIn = edge.inside(prev);
      if (curIn) {
        if (!prevIn) next.push(edge.cut(prev, cur));
        next.push(cur);
      } else if (prevIn) {
        next.push(edge.cut(prev, cur));
      }
    }
    poly = next;
    if (poly.length === 0) return [];
  }
  return poly;
}

function lerpX(a, b, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + (b[1] - a[1]) * t];
}
function lerpY(a, b, y) {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + (b[0] - a[0]) * t, y];
}

function area(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

/** Karsii pisteitä, jotka ovat liian lähellä edellistä säilytettyä pistettä. */
function simplify(ring, tol) {
  if (ring.length < 8) return ring;
  const out = [ring[0]];
  for (let i = 1; i < ring.length - 1; i++) {
    const last = out[out.length - 1];
    const p = ring[i];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= tol) out.push(p);
  }
  out.push(ring[ring.length - 1]);
  return out.length >= 4 ? out : ring;
}

const round = (v) => Math.round(v * 100) / 100;

const countries = [];
for (const f of geo.features) {
  const name = f.properties?.name ?? 'unknown';
  const polys =
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    // Vain ulkorengas: saarten reiät eivät näy tässä mittakaavassa.
    const clipped = clipRing(unwrap(poly[0]), CLIP);
    if (clipped.length < 4) continue;
    if (area(clipped) < MIN_AREA) continue;
    rings.push(simplify(clipped, SIMPLIFY_DEG).map(([lon, lat]) => [round(lon), round(lat)]));
  }
  if (rings.length > 0) countries.push({ name, rings });
}

countries.sort((a, b) => a.name.localeCompare(b.name));

const out = {
  source: 'Natural Earth 1:50m via world-atlas (public domain)',
  bbox: [CLIP.minLon, CLIP.minLat, CLIP.maxLon, CLIP.maxLat],
  countries,
};

mkdirSync(resolve(root, 'src/assets/data'), { recursive: true });
const file = resolve(root, 'src/assets/data/europe.json');
writeFileSync(file, JSON.stringify(out));
const points = countries.reduce((n, c) => n + c.rings.reduce((m, r) => m + r.length, 0), 0);
console.log(
  `europe.json: ${countries.length} maata, ${points} pistettä, ` +
    `${(readFileSync(file).byteLength / 1024).toFixed(1)} kB`,
);
