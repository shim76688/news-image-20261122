// The World Today - Sunday 22 November 2026
// A newspaper front page drawn entirely in code (Node 22, standard library only).
// It writes a deterministic 1024x1024 PNG to /output/entry.png (or $MAKEFUN_OUTPUT_DIR).
// Every glyph, rule and picture on the page is drawn by the code below: no image
// files, no fonts, no network. Running the program twice writes identical bytes.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 228];
const INK: RGB = [20, 20, 20];
const RED: RGB = [163, 22, 33];
const GREY: RGB = [96, 96, 92];
const SKY: RGB = [207, 224, 234];
const SUN: RGB = [232, 182, 76];
const MT1: RGB = [138, 122, 104];
const MT2: RGB = [107, 93, 79];
const SAND: RGB = [176, 154, 122];
const ROAD: RGB = [90, 90, 90];
const HELI: RGB = [34, 34, 34];

const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = PAPER[0];
  buf[i * 3 + 1] = PAPER[1];
  buf[i * 3 + 2] = PAPER[2];
}

// ---- PNG encoding (manual chunks + zlib deflate, filter 0) ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePNG(): Buffer {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', new Uint8Array(idat)),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

// ---- Canvas primitives ----
function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  rect(x, y, t, h, c);
}

function line(x1: number, y1: number, x2: number, y2: number, c: RGB, t = 1): void {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;
  for (;;) {
    for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) setPx(x + i, y + j, c);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function poly(points: [number, number][], c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, py] of points) {
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }
  for (let y = Math.ceil(minY); y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(Math.round(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) setPx(x, y, c);
    }
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPx(cx + x, cy + y, c);
    }
  }
}

// ---- A 5x7 bitmap font, drawn by hand for this page ----
// Each glyph is 7 rows of 5 cells; '#' is ink, '.' is blank.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.###.'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.####', '#....', '#....', '#....', '.####'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#...', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '#..#.', '#...#'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '&': ['.##..', '#..#.', '#..#.', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  '*': ['.....', '.#.#.', '..#..', '#####', '..#..', '.#.#.', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
};

// ---- Text helpers ----
const CHAR_ADV = 6; // font units per character advance

function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === '#') rect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function textWidth(s: string, sc: number): number {
  return s.length * CHAR_ADV * sc - sc;
}

function drawText(s: string, x: number, y: number, sc: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawChar(ch, cx, y, sc, c);
    cx += CHAR_ADV * sc;
  }
}

function centerText(s: string, cx: number, y: number, sc: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, sc) / 2), y, sc, c);
}

function rightText(s: string, rx: number, y: number, sc: number, c: RGB): void {
  drawText(s, rx - textWidth(s, sc), y, sc, c);
}

function wrap(s: string, maxW: number, sc: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, sc) <= maxW) {
      cur = t;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function block(lines: string[], x: number, y: number, sc: number, lh: number, c: RGB): number {
  let yy = y;
  for (const ln of lines) {
    drawText(ln, x, yy, sc, c);
    yy += lh;
  }
  return yy;
}

// ---- The front page ----
function drawIllustration(x: number, y: number, w: number, h: number): void {
  // A flat illustration of the Sinaloa hills at dawn, with a helicopter overhead.
  rect(x, y, w, h, SKY);
  circle(x + w - 70, y + 42, 26, SUN);
  poly([[x, y + 130], [x + 130, y + 78], [x + 230, y + 130]], MT1);
  poly([[x + 170, y + 130], [x + 300, y + 62], [x + w, y + 130]], MT2);
  rect(x, y + 130, w, h - 130, SAND);
  poly([[x + 40, y + h], [x + 190, y + 130], [x + 250, y + 130], [x + 330, y + h]], ROAD);
  // helicopter silhouette
  const hx = x + 150;
  const hy = y + 52;
  rect(hx, hy, 74, 22, HELI);
  poly([[hx + 74, hy + 6], [hx + 128, hy + 12], [hx + 74, hy + 16]], HELI);
  line(hx + 8, hy - 8, hx + 66, hy - 8, HELI, 3);
  line(hx + 16, hy + 22, hx + 10, hy + 34, HELI, 3);
  line(hx + 58, hy + 22, hx + 64, hy + 34, HELI, 3);
  rect(x, y, w, 3, INK);
  rect(x, y + h - 3, w, 3, INK);
  rect(x, y, 3, h, INK);
  rect(x + w - 3, y, 3, h, INK);
}

function drawPage(): void {
  const MX = 20; // margin
  const RW = W - 2 * MX; // content width, 984

  // Top rule + masthead
  hline(MX, 12, RW, INK, 3);
  centerText('THE WORLD TODAY', W / 2, 24, 9, INK);
  drawText('WORLD EDITION', MX, 100, 2, GREY);
  centerText('SUNDAY 22 NOVEMBER 2026', W / 2, 100, 2, INK);
  rightText('No. 327', W - MX, 100, 2, GREY);
  hline(MX, 122, RW, INK, 3);
  hline(MX, 127, RW, INK, 1);

  // Lead headline
  drawText('MEXICO CAPTURES', MX, 142, 6, INK);
  drawText("'EL CHAPO ISIDRO'", MX, 190, 6, INK);
  const sub = wrap(
    'Sinaloa cartel boss seized in deadly firefight after a US tip.',
    RW, 3,
  );
  block(sub, MX, 240, 3, 27, INK);

  // Lead story: body left, illustration right
  const lead = 'MEXICO CITY - Mexican forces captured Fausto Isidro Meza, known as '
    + "'El Chapo Isidro', in Sinaloa on Sunday, ending a long hunt for one of the FBI's "
    + 'most wanted drug lords. Officials said the operation followed a tip from US '
    + 'intelligence and ended in a deadly firefight. Meza leads a trafficking group allied '
    + 'with one of the two rival factions of the Sinaloa cartel. The capture is the latest '
    + 'in a string of high-profile arrests.';
  block(wrap(lead, 560, 2), MX, 304, 2, 17, INK);
  drawIllustration(600, 304, 404, 196);
  drawText('Mexican forces in Sinaloa.', 600, 508, 2, GREY);
  drawText('(Illustration)', 600, 526, 2, GREY);

  hline(MX, 552, RW, INK, 2);

  // Row two: COP31 (left) and Houthis (right)
  drawText('ANTALYA, TURKEY', MX, 568, 2, RED);
  drawText('COP31 NEARS A DEAL', MX, 590, 4, INK);
  const cop = 'Climate talks approached a final deal early on Sunday after a new package '
    + 'was put to nearly 200 delegations. COP31 President Murat Kurum said the text was '
    + 'one all parties could agree on, with a session due on Sunday morning to approve it. '
    + 'Talks ran past a Friday deadline in a row over fossil fuels.';
  block(wrap(cop, 478, 2), MX, 628, 2, 17, INK);

  drawText('RIYADH', 526, 568, 2, RED);
  drawText('HOUTHIS STRIKE', 526, 590, 4, INK);
  drawText('RIYADH', 526, 618, 4, INK);
  const hou = "Yemen's Houthis launched strikes on the Saudi capital on Sunday, in revenge "
    + "for what the Saudi-led coalition called a 'special operation'. The strikes mark a "
    + "sharp escalation in the region's wars.";
  block(wrap(hou, 478, 2), 526, 660, 2, 17, INK);
  vline(512, 568, 200, INK, 1);

  hline(MX, 780, RW, INK, 2);

  // Row three: three columns
  drawText('WASHINGTON', MX, 796, 2, RED);
  drawText('HACKERS BREACH', MX, 818, 3, INK);
  drawText('FBI AND USDA', MX, 842, 3, INK);
  const hack = 'US media reported on Sunday that hackers breached the Agriculture Department '
    + 'and the FBI, in the latest cyber intrusion.';
  block(wrap(hack, 312, 2), MX, 872, 2, 16, INK);

  drawText('NEW YORK', 356, 796, 2, RED);
  drawText('NVIDIA FACES US', 356, 818, 3, INK);
  drawText('ACCOUNTING PROBE', 356, 842, 3, INK);
  const nvi = 'Nvidia faces a US accounting probe, media reported on Sunday, amid turmoil '
    + 'after chief executive Jensen Huang resigned.';
  block(wrap(nvi, 312, 2), 356, 872, 2, 16, INK);

  drawText('ABUJA', 692, 796, 2, RED);
  drawText('24 DIE AS BOAT', 692, 818, 3, INK);
  drawText('SINKS IN NIGERIA', 692, 842, 3, INK);
  const nig = 'Twenty-four people died when a boat capsized in Nigeria on Sunday while '
    + 'carrying passengers to a funeral, officials said.';
  block(wrap(nig, 312, 2), 692, 872, 2, 16, INK);
  vline(344, 796, 152, INK, 1);
  vline(680, 796, 152, INK, 1);

  // Footer briefs
  hline(MX, 960, RW, INK, 2);
  const foot = 'ALSO TODAY: Peru 6.7 quake, no deaths. Bulgari dies at 89. France protests, '
    + "sixth weekend. EU: Big Tech tax. UN: 'killer robot' rules by 2028. Gaza: four killed.";
  block(wrap(foot, RW, 2), MX, 972, 2, 16, GREY);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
drawPage();
writeFileSync(join(outDir, 'entry.png'), encodePNG());

