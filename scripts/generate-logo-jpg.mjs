// Renders the TOLDPROOF pixel wax-seal mark from components/design/bitmaps.ts
// into JPG files in public/. Run via `pnpm logo` (defined in package.json).
//
// Source-of-truth: components/design/bitmaps.ts (BRAND_MARK). The 9x9 grid is
// framed by 1 cell of ink padding on every side, matching app/icon.svg.

import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const BITMAPS_FILE = path.join(ROOT, 'components/design/bitmaps.ts');
const OUT_DIR = path.join(ROOT, 'public');

const INK = [0x14, 0x13, 0x0f];
const PAPER = [0xf6, 0xf4, 0xef];

function extractBitmap(name) {
  const src = fs.readFileSync(BITMAPS_FILE, 'utf8');
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`);
  const m = src.match(re);
  if (!m) throw new Error(`${name} not found in bitmaps.ts`);
  return m[1]
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map((c) => c === 'X'));
}

function renderJpg({ grid, padCells, size, outFile, quality = 95 }) {
  const cols = grid[0].length;
  const rows = grid.length;
  const frameCols = cols + padCells * 2;
  const cell = size / frameCols;
  const pad = padCells * cell;

  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    buf[i * 4 + 0] = INK[0];
    buf[i * 4 + 1] = INK[1];
    buf[i * 4 + 2] = INK[2];
    buf[i * 4 + 3] = 0xff;
  }
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!grid[y][x]) continue;
      const px0 = Math.round(pad + x * cell);
      const py0 = Math.round(pad + y * cell);
      const px1 = Math.round(pad + (x + 1) * cell);
      const py1 = Math.round(pad + (y + 1) * cell);
      for (let py = py0; py < py1; py += 1) {
        for (let px = px0; px < px1; px += 1) {
          const off = (py * size + px) * 4;
          buf[off + 0] = PAPER[0];
          buf[off + 1] = PAPER[1];
          buf[off + 2] = PAPER[2];
        }
      }
    }
  }

  const encoded = jpeg.encode({ data: buf, width: size, height: size }, quality);
  fs.writeFileSync(outFile, encoded.data);
  console.log(`  ${path.relative(ROOT, outFile)}  (${size}×${size})`);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const brandMark = extractBitmap('BRAND_MARK');
  console.log('TOLDPROOF brand mark → JPG');
  for (const size of [400, 512, 1024, 2048]) {
    renderJpg({
      grid: brandMark,
      padCells: 1,
      size,
      outFile: path.join(OUT_DIR, `toldproof-logo-${size}.jpg`),
    });
  }

  const bigSeal = extractBitmap('BIG_SEAL');
  console.log('TOLDPROOF wax-seal stamp → JPG');
  renderJpg({
    grid: bigSeal,
    padCells: 2,
    size: 1024,
    outFile: path.join(OUT_DIR, 'toldproof-stamp-1024.jpg'),
  });
}

main();
