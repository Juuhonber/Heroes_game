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
  cubeTop: '#c9e35a',
};

const BODY = { x: 95, y: 58, w: 140, h: 142, r: 16, d: 26, dy: 18 };
const ARM = { y: 116, len: 82, w: 19 };
const LEG = { spread: 30, y: BODY.y + BODY.h, thigh: 54, shin: 52, w: 19 };

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

/** Yksi raaja: murtoviiva pyöristetyin päin. */
function limb(points, width) {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p[0])} ${r2(p[1])}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${C.limb}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Kulma asteina pystysuorasta alaspäin, positiivinen = eteen (oikealle). */
function segment(origin, angleDeg, length) {
  const a = (angleDeg * Math.PI) / 180;
  return [origin[0] + Math.sin(a) * length, origin[1] + Math.cos(a) * length];
}

function leg(hip, hipAngle, kneeAngle) {
  const knee = segment(hip, hipAngle, LEG.thigh);
  const foot = segment(knee, hipAngle + kneeAngle, LEG.shin);
  return limb([hip, knee, foot], LEG.w);
}

function arm(shoulder, angle, dir) {
  const a = (angle * Math.PI) / 180;
  const elbow = [shoulder[0] + Math.sin(a) * ARM.len * dir, shoulder[1] + Math.cos(a) * ARM.len];
  return limb([shoulder, elbow], ARM.w);
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

function mascot(pose) {
  const lean = pose.lean ?? 0;
  const bob = pose.bob ?? 0;
  const leftHip = [BODY.x + BODY.w / 2 - LEG.spread, LEG.y - 6];
  const rightHip = [BODY.x + BODY.w / 2 + LEG.spread, LEG.y - 6];
  const leftShoulder = [BODY.x - BODY.d + 10, ARM.y - BODY.dy * 0.4];
  const rightShoulder = [BODY.x + BODY.w - 4, ARM.y];

  const extras = pose.cube ? floatingCube(250, 44 + pose.cube, 46) : '';

  return `
  <g transform="translate(0 ${r2(bob)}) rotate(${r2(lean)} 165 200)">
    ${leg(rightHip, pose.legBack, pose.kneeBack)}
    ${arm(leftShoulder, pose.armBack, -1)}
    ${arm(rightShoulder, pose.armFront, 1)}
    ${body(pose)}
    ${leg(leftHip, pose.legFront, pose.kneeFront)}
  </g>
  ${extras}`;
}

function sheet(name, poses, columns) {
  const rows = Math.ceil(poses.length / columns);
  const w = columns * F;
  const h = rows * F;
  const frames = poses
    .map((pose, i) => {
      const cx = (i % columns) * F;
      const cy = Math.floor(i / columns) * F;
      return `<g transform="translate(${cx} ${cy})">${mascot(pose)}</g>`;
    })
    .join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<title>HEROES mascot - ${name}</title>
${frames}
</svg>`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `${name}.svg`), svg);
  return { name, columns, rows, frames: poses.length };
}

// --- Juoksusykli: 8 ruutua, jalat ja kädet vastavaiheessa ---------------
const runPoses = [];
for (let i = 0; i < 8; i++) {
  const t = (i / 8) * Math.PI * 2 + Math.PI / 4;
  const swing = Math.sin(t);
  const counter = Math.sin(t + Math.PI);
  runPoses.push({
    legFront: swing * 40,
    legBack: counter * 40,
    kneeFront: Math.max(0, -swing) * 46 + 6,
    kneeBack: Math.max(0, -counter) * 46 + 6,
    armFront: counter * 24 + 42,
    armBack: swing * 24 + 42,
    bob: -Math.abs(Math.sin(t * 2)) * 9,
    lean: 2 + swing * 1.5,
    eyes: 'normal',
    mouth: 'neutral',
  });
}

// --- Idle: 4 ruutua, kevyt hengitys ja leijuva kuutio -------------------
const idleEyes = ['normal', 'normal', 'sparkle', 'blink'];
const idleMouths = ['neutral', 'open', 'smile', 'smile'];
const idlePoses = [];
for (let i = 0; i < 4; i++) {
  const t = (i / 4) * Math.PI * 2;
  idlePoses.push({
    legFront: 9,
    legBack: -11,
    kneeFront: 5,
    kneeBack: 5,
    armFront: 40 + Math.sin(t) * 5,
    armBack: 42 + Math.sin(t) * 5,
    bob: -Math.abs(Math.sin(t)) * 5,
    lean: 0,
    cube: Math.sin(t + 1) * 8,
    eyes: idleEyes[i],
    mouth: idleMouths[i],
  });
}

// --- Hyppy: nousu ja lasku ---------------------------------------------
const jumpPoses = [
  {
    legFront: 30, legBack: -26, kneeFront: 54, kneeBack: 18,
    armFront: -34, armBack: -28, bob: -6, lean: -4,
    eyes: 'wide', mouth: 'open',
  },
  {
    legFront: 20, legBack: -34, kneeFront: 18, kneeBack: 40,
    armFront: 46, armBack: 40, bob: 2, lean: 5,
    eyes: 'wide', mouth: 'open',
  },
];

// --- Törmäys ------------------------------------------------------------
const hurtPoses = [
  {
    legFront: -30, legBack: 26, kneeFront: 30, kneeBack: 22,
    armFront: -62, armBack: -58, bob: -4, lean: -12,
    eyes: 'blink', mouth: 'open',
  },
  {
    legFront: -40, legBack: 34, kneeFront: 42, kneeBack: 30,
    armFront: -70, armBack: -66, bob: 6, lean: -18,
    eyes: 'blink', mouth: 'open',
  },
];

const sheets = [
  sheet('mascot_run', runPoses, 4),
  sheet('mascot_idle', idlePoses, 2),
  sheet('mascot_jump', jumpPoses, 2),
  sheet('mascot_hurt', hurtPoses, 2),
];

// Keräiltävä kuutio omana spritenään.
const token = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<title>HEROES token</title>
<g transform="translate(6 30)">${floatingCube(0, 12, 62)}</g>
</svg>`;
writeFileSync(resolve(outDir, 'token.svg'), token);

writeFileSync(
  resolve(outDir, 'sprites.json'),
  JSON.stringify(
    {
      note: 'Ruudut luetaan riveittäin vasemmalta oikealle. frameWidth/-Height ovat lähdekuvan pikseleitä.',
      clips: {
        idle: { src: 'sprites/mascot_idle.svg', frameWidth: F, frameHeight: F, columns: 2, frames: 4, fps: 5, loop: true },
        run: { src: 'sprites/mascot_run.svg', frameWidth: F, frameHeight: F, columns: 4, frames: 8, fps: 15, loop: true },
        jump: { src: 'sprites/mascot_jump.svg', frameWidth: F, frameHeight: F, columns: 2, frames: 2, fps: 6, loop: false },
        hurt: { src: 'sprites/mascot_hurt.svg', frameWidth: F, frameHeight: F, columns: 2, frames: 2, fps: 8, loop: false },
      },
    },
    null,
    2,
  ),
);

console.log(
  sheets.map((s) => `${s.name}.svg: ${s.frames} ruutua (${s.columns}x${s.rows})`).join('\n'),
);
