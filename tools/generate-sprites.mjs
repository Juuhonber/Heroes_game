/**
 * Piirtää maskottihahmon sprite sheet -arkit SVG:nä.
 *
 * Arkit ovat ruudukoita: ruudut luetaan riveittäin vasemmalta oikealle,
 * samalla tavalla kuin pelin SpriteSheet-luokka ne leikkaa. Jos alkuperäiset
 * brändigrafiikat halutaan tilalle, riittää että korvaava PNG/SVG noudattaa
 * samaa ruutukokoa ja sarakemäärää kuin sprites.json kertoo.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'src/assets/sprites');

const F = 320; // ruudun leveys ja korkeus

const C = {
  front: '#19a08c',
  side: '#0f7c6c',
  top: '#23b8a0',
  band: '#f0e558',
  ink: '#08130f',
  limb: '#0a0f0d',
  /** Kauempana olevat raajat hieman vaaleampia: syvyys erottuu ristikkäin. */
  limbFar: '#3d4a47',
  cubeTop: '#c9e35a',
};

const BODY = { x: 95, y: 58, w: 140, h: 142, r: 16, d: 26, dy: 18 };
const ARM = { y: 116, upper: 46, fore: 40, w: 18 };
const LEG = { spread: 30, y: BODY.y + BODY.h, thigh: 54, shin: 52, w: 19 };
/** Maaviiva ruudussa: jalat osuvat tähän, ja peli ankkuroi hahmon tästä. */
const GROUND = 300;
const HIP_BACK = [BODY.x + BODY.w / 2 + LEG.spread, LEG.y - 6];
const HIP_FRONT = [BODY.x + BODY.w / 2 - LEG.spread, LEG.y - 6];
const SHOULDER_L = [BODY.x - BODY.d + 10, ARM.y - BODY.dy * 0.4];
const SHOULDER_R = [BODY.x + BODY.w - 4, ARM.y];
const PIVOT = [165, 200];

// Pikselimaskit kasvoille. '#' = musta pikseli, '.' = läpinäkyvä.
const EYES = {
  normal: ['.###.', '.##.#', '.###.', '.....'],
  blink: ['.....', '#####', '.....', '.....'],
  sparkle: ['..#..', '.###.', '#.#.#', '..#..'],
  happy: ['..#..', '.#.#.', '#...#', '.....'],
  wide: ['.###.', '.#.#.', '.###.', '.....'],
};
const MOUTHS = {
  neutral: ['.....', '.###.', '.....'],
  smile: ['#...#', '.###.', '.....'],
  open: ['.###.', '.#.#.', '.###.'],
  flat: ['.....', '####.', '.....'],
};

const r2 = (v) => Math.round(v * 100) / 100;

function pixels(mask, x, y, cell) {
  let out = '';
  mask.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch !== '#') return;
      out += `<rect x="${r2(x + rx * cell)}" y="${r2(y + ry * cell)}" width="${r2(cell + 0.4)}" height="${r2(cell + 0.4)}" fill="${C.ink}"/>`;
    });
  });
  return out;
}

function floatingCube(x, y, size) {
  const d = size * 0.34;
  return `
    <g stroke="${C.ink}" stroke-width="3" stroke-linejoin="round">
      <path d="M${r2(x)} ${r2(y)} L${r2(x + d)} ${r2(y - d)} L${r2(x + size + d)} ${r2(y - d)} L${r2(x + size)} ${r2(y)} Z" fill="${C.cubeTop}"/>
      <rect x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size * 0.62)}" rx="4" fill="${C.front}"/>
      <path d="M${r2(x + size)} ${r2(y)} L${r2(x + size + d)} ${r2(y - d)} L${r2(x + size + d)} ${r2(y + size * 0.62 - d)} L${r2(x + size)} ${r2(y + size * 0.62)} Z" fill="${C.side}"/>
    </g>`;
}

/** Vartalo: etusivu, vasen sivu ja yläpinta, ruudukko sekä kasvot. */
function body(pose) {
  const { x, y, w, h, r, d, dy } = BODY;
  const bx = x - d;
  const by = y - dy;
  const cell = w / 3;
  const eyeCell = cell * 0.2;
  const bandY = y + cell;

  const grid = [];
  for (let i = 1; i < 3; i++) {
    grid.push(
      `<line x1="${r2(x + cell * i)}" y1="${r2(y + 2)}" x2="${r2(x + cell * i)}" y2="${r2(y + h - 2)}"/>`,
    );
    grid.push(
      `<line x1="${r2(x + 3)}" y1="${r2(y + (h / 3) * i)}" x2="${r2(x + w - 3)}" y2="${r2(y + (h / 3) * i)}"/>`,
    );
  }

  const eyeMask = EYES[pose.eyes] ?? EYES.normal;
  const mouthMask = MOUTHS[pose.mouth] ?? MOUTHS.neutral;
  const eyeW = eyeMask[0].length * eyeCell;
  const eyeH = eyeMask.length * eyeCell;
  const mouthW = mouthMask[0].length * eyeCell;
  const mouthH = mouthMask.length * eyeCell;
  const bandH = h / 3;

  return `
    <g>
      <path d="M${r2(x)} ${r2(y + r * 0.35)} L${r2(bx)} ${r2(by + r * 0.35)} L${r2(bx)} ${r2(by + h - r * 0.5)} L${r2(x)} ${r2(y + h - r * 0.5)} Z"
            fill="${C.side}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M${r2(x + r * 0.35)} ${r2(y)} L${r2(bx + r * 0.35)} ${r2(by)} L${r2(bx + w - r * 0.5)} ${r2(by)} L${r2(x + w - r * 0.5)} ${r2(y)} Z"
            fill="${C.top}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r}"
            fill="${C.front}" stroke="${C.ink}" stroke-width="3.5"/>
      <rect x="${r2(x + 1)}" y="${r2(bandY)}" width="${r2(cell - 2)}" height="${r2(bandH)}" fill="${C.band}"/>
      <rect x="${r2(x + cell * 2 + 1)}" y="${r2(bandY)}" width="${r2(cell - 2)}" height="${r2(bandH)}" fill="${C.band}"/>
      <g stroke="${C.ink}" stroke-width="2" opacity="0.85">${grid.join('')}</g>
      ${pixels(eyeMask, x + cell * 0.5 - eyeW / 2, bandY + bandH / 2 - eyeH / 2, eyeCell)}
      ${pixels(eyeMask, x + cell * 2.5 - eyeW / 2, bandY + bandH / 2 - eyeH / 2, eyeCell)}
      ${pixels(mouthMask, x + cell * 1.5 - mouthW / 2, bandY + bandH / 2 - mouthH / 2, eyeCell)}
    </g>`;
}

/** Raaja: murtoviiva pyöristetyin päin. */
function limb(points, width, color = C.limb) {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p[0])} ${r2(p[1])}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Kulma asteina pystysuorasta alaspäin, positiivinen = eteen (oikealle). */
function segment(origin, angleDeg, length) {
  const a = (angleDeg * Math.PI) / 180;
  return [origin[0] + Math.sin(a) * length, origin[1] + Math.cos(a) * length];
}

/**
 * Jalka: reisi ja sääri. Polvi taipuu kuten ihmisellä: sääri kääntyy
 * reiteen nähden taaksepäin. (Edellinen versio taivutti polvea eteenpäin,
 * mikä teki juoksusta lintumaisen.)
 */
function legPoints(hip, { T, K }) {
  const knee = segment(hip, T, LEG.thigh);
  return [hip, knee, segment(knee, T - K, LEG.shin)];
}

/** Käsi: olkavarsi ja kyynärvarsi; kulmat maailman suunnassa. */
function armPoints(shoulder, { U, E }) {
  const elbow = segment(shoulder, U, ARM.upper);
  return [shoulder, elbow, segment(elbow, U + E, ARM.fore)];
}

/** Pisteen kierto kallistuksen keskipisteen ympäri (SVG:n rotate). */
function rotate([x, y], deg) {
  const a = (deg * Math.PI) / 180;
  const dx = x - PIVOT[0];
  const dy = y - PIVOT[1];
  return [PIVOT[0] + dx * Math.cos(a) - dy * Math.sin(a), PIVOT[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

function feet(pose) {
  const back = rotate(legPoints(HIP_BACK, pose.back)[2], pose.lean);
  const front = rotate(legPoints(HIP_FRONT, pose.front)[2], pose.lean);
  return { back, front };
}

function mascot(pose) {
  const extras = pose.cube !== undefined ? floatingCube(250, 44 + pose.cube + pose.dy, 46) : '';
  return `
  <g transform="translate(0 ${r2(pose.dy)}) rotate(${r2(pose.lean)} ${PIVOT[0]} ${PIVOT[1]})">
    ${limb(legPoints(HIP_BACK, pose.back), LEG.w, C.limbFar)}
    ${limb(armPoints(SHOULDER_L, pose.armL), ARM.w, C.limbFar)}
    ${limb(armPoints(SHOULDER_R, pose.armR), ARM.w)}
    ${body(pose)}
    ${limb(legPoints(HIP_FRONT, pose.front), LEG.w)}
  </g>
  ${extras}`;
}

function sheet(name, poses, columns) {
  const rows = Math.ceil(poses.length / columns);
  const frames = poses
    .map((pose, i) => {
      const cx = (i % columns) * F;
      const cy = Math.floor(i / columns) * F;
      return `<g transform="translate(${cx} ${cy})">${mascot(pose)}</g>`;
    })
    .join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * F}" height="${rows * F}" viewBox="0 0 ${columns * F} ${rows * F}">
<title>HEROES mascot - ${name}</title>
${frames}
</svg>`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `${name}.svg`), svg);
  return { name, columns, rows, frames: poses.length };
}

// --- Juoksusykli ------------------------------------------------------
// Yhden jalan avainasennot vaiheen p mukaan (0..1). T = reiden kulma
// pystysuorasta (+ eteen), K = polven koukku. Toinen jalka on puoli
// sykliä jäljessä. Asennot: kosketus, jousto, keskitukivaihe, työntö,
// irtoaminen, palautus kantapää pakaraan, polvennosto ja ojennus.
const LEG_KEYS = [
  [0.0, 32, 6],
  [0.12, 14, 26],
  [0.25, -6, 16],
  [0.4, -36, 18],
  [0.52, -30, 70],
  [0.66, -6, 112],
  [0.8, 26, 86],
  [0.92, 44, 34],
];

/** Syklinen Catmull-Rom-interpolaatio: pehmeä liike avainasentojen välillä. */
function sampleLeg(p) {
  const n = LEG_KEYS.length;
  const phase = ((p % 1) + 1) % 1;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (LEG_KEYS[k][0] <= phase) i = k;
  const at = (k) => LEG_KEYS[((k % n) + n) % n];
  const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
  const start = p1[0];
  const end = i + 1 >= n ? 1 : p2[0];
  const t = (phase - start) / (end - start);
  const cr = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  return { T: cr(p0[1], p1[1], p2[1], p3[1]), K: Math.max(0, cr(p0[2], p1[2], p2[2], p3[2])) };
}

const RUN_FRAMES = 12;
const RUN_LEAN = 6;

/** Kevyt lentovaihe työnnön jälkeen: kumpikaan jalka ei kosketa maata. */
const lift = (p) => 6 * Math.max(0, Math.sin(4 * Math.PI * (p - 0.3)));

function runPose(p) {
  // Kädet vastavaiheessa jalkoihin, kyynärpäät koukussa.
  const swing = Math.sin(2 * Math.PI * (p + 0.08));
  const pose = {
    back: sampleLeg(p + 0.5),
    front: sampleLeg(p),
    armR: { U: 34 - 26 * swing, E: 24 },
    armL: { U: -34 - 26 * swing, E: -20 },
    lean: RUN_LEAN,
    dy: 0,
    eyes: 'normal',
    mouth: 'neutral',
  };
  // Alempi jalka osuu maaviivaan: hahmo ei leiju eikä uppoa.
  const { back, front } = feet(pose);
  pose.dy = GROUND - Math.max(back[1], front[1]) - lift(p);
  return pose;
}

const runPoses = [];
for (let i = 0; i < RUN_FRAMES; i++) runPoses.push(runPose(i / RUN_FRAMES));

/**
 * Askelpituus: kuinka paljon tukijalka liikkuu taaksepäin yhden syklin
 * aikana. Peli toistaa juoksua tällä tahdilla, jolloin jalka pysyy maassa
 * paikallaan eikä liu'u.
 */
function measureCycle() {
  const steps = 2000;
  let travel = 0;
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const pose = runPose(i / steps);
    const { back, front } = feet(pose);
    const stance = back[1] > front[1] ? 'back' : 'front';
    const x = stance === 'back' ? back[0] : front[0];
    if (prev && prev.stance === stance) travel += Math.max(0, prev.x - x);
    prev = { stance, x };
  }
  return travel;
}
const CYCLE_PX = measureCycle();

// --- Idle: 4 ruutua, kevyt hengitys ja leijuva kuutio -------------------
const idleEyes = ['normal', 'normal', 'sparkle', 'blink'];
const idleMouths = ['neutral', 'open', 'smile', 'smile'];
const idlePoses = [];
for (let i = 0; i < 4; i++) {
  const t = (i / 4) * Math.PI * 2;
  const pose = {
    back: { T: -7, K: 4 },
    front: { T: 8, K: 4 },
    armR: { U: 34 + Math.sin(t) * 5, E: -8 },
    armL: { U: -34 - Math.sin(t) * 5, E: 8 },
    lean: 0,
    dy: 0,
    cube: Math.sin(t + 1) * 8,
    eyes: idleEyes[i],
    mouth: idleMouths[i],
  };
  const { back, front } = feet(pose);
  pose.dy = GROUND - Math.max(back[1], front[1]) - Math.abs(Math.sin(t)) * 4;
  idlePoses.push(pose);
}

// --- Hyppy: nousu (polvet koukussa) ja lasku (jalat valmiina) -------------
const runDy = runPoses.reduce((sum, pose) => sum + pose.dy, 0) / runPoses.length;
const jumpPoses = [
  {
    back: { T: 18, K: 96 },
    front: { T: 58, K: 104 },
    armR: { U: 140, E: 24 },
    armL: { U: -140, E: -24 },
    lean: 4,
    dy: runDy - 14,
    eyes: 'wide',
    mouth: 'open',
  },
  {
    back: { T: -14, K: 34 },
    front: { T: 30, K: 42 },
    armR: { U: 84, E: 24 },
    armL: { U: -84, E: -24 },
    lean: 2,
    dy: runDy - 6,
    eyes: 'wide',
    mouth: 'neutral',
  },
];

// --- Törmäys ------------------------------------------------------------
const hurtPoses = [
  { back: { T: -40, K: 20 }, front: { T: -25, K: 30 }, armR: { U: 150, E: -30 }, armL: { U: -150, E: 30 }, lean: -12, dy: runDy - 4, eyes: 'blink', mouth: 'open' },
  { back: { T: -48, K: 30 }, front: { T: -32, K: 42 }, armR: { U: 165, E: -40 }, armL: { U: -165, E: 40 }, lean: -18, dy: runDy + 6, eyes: 'blink', mouth: 'open' },
];

const sheets = [
  sheet('mascot_run', runPoses, 4),
  sheet('mascot_idle', idlePoses, 2),
  sheet('mascot_jump', jumpPoses, 2),
  sheet('mascot_hurt', hurtPoses, 2),
];

// Keräiltävä kuutio omana spritenään (kartan ja palautekortin koristeena).
const token = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<title>HEROES token</title>
<g transform="translate(6 30)">${floatingCube(0, 12, 62)}</g>
</svg>`;
writeFileSync(resolve(outDir, 'token.svg'), token);

const clip = (src, columns, frames, fps, loop, extra = {}) => ({
  src,
  frameWidth: F,
  frameHeight: F,
  columns,
  frames,
  fps,
  loop,
  footY: GROUND,
  ...extra,
});

writeFileSync(
  resolve(outDir, 'sprites.json'),
  JSON.stringify(
    {
      note: 'Ruudut luetaan riveittäin vasemmalta oikealle. footY = jalkojen maaviiva ruudussa. cyclePx = matka, jonka hahmo etenee yhden juoksusyklin aikana (ruudun pikseleinä); peli sovittaa toistonopeuden juoksuvauhtiin.',
      clips: {
        idle: clip('sprites/mascot_idle.svg', 2, 4, 5, true),
        run: clip('sprites/mascot_run.svg', 4, RUN_FRAMES, 24, true, { cyclePx: Math.round(CYCLE_PX * 10) / 10 }),
        jump: clip('sprites/mascot_jump.svg', 2, 2, 6, false),
        hurt: clip('sprites/mascot_hurt.svg', 2, 2, 8, false),
      },
    },
    null,
    2,
  ),
);

console.log(
  sheets.map((s) => `${s.name}.svg: ${s.frames} ruutua (${s.columns}x${s.rows})`).join('\n') +
    `\njuoksusykli ${CYCLE_PX.toFixed(1)} px`,
);
