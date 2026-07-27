#!/usr/bin/env node
/**
 * Chrome Web Store promotional tiles.
 *
 * The store takes PNG or JPEG only, and these carry text, so the pipeline is
 * SVG for layout and macOS Quick Look for rasterising. Quick Look always
 * renders to a square, so each tile is drawn centred on a square canvas and
 * cropped back down afterwards — that way the crop is symmetric and cannot
 * shave the artwork.
 *
 * Screenshots are deliberately not generated here. The store requires them to
 * show the extension as it really is, and a drawing of an interface is not a
 * picture of one.
 */
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { COLOURS, emblemSvg, toHex } from './artwork.mjs';

const run = promisify(execFile);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'assets', 'store');

const SANS = 'system-ui, -apple-system, &#34;Segoe UI&#34;, Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Real output of the generators, checked against the official validators. */
const SAMPLES = [
  ['CPF', '768.706.350-30'],
  ['CNPJ', '36.783.109/6055-04'],
  ['CEP', '01310-100'],
];

const TILES = [
  { name: 'promo-small', width: 440, height: 280 },
  { name: 'promo-marquee', width: 1400, height: 560 },
];

function background(width, height) {
  return `<rect width="${width}" height="${height}" fill="url(#bg)"/>`;
}

/**
 * The small tile is displayed at a fraction of its size in the store grid, so
 * it carries the mark, the name and one line — anything denser turns to mush
 * exactly where it has to work hardest.
 */
function smallTile() {
  const w = 440;
  const h = 280;
  return `${background(w, h)}
  <g>${emblemSvg(126, 220, 104)}</g>
  <text x="220" y="212" font-family="${SANS}" font-size="40" font-weight="700" fill="#fff" text-anchor="middle">br-faker</text>
  <text x="220" y="245" font-family="${SANS}" font-size="18" fill="#c6efd8" text-anchor="middle">CPF, CNPJ e endereço em um atalho</text>`;
}

function marqueeTile() {
  const w = 1400;
  const h = 560;
  const chips = SAMPLES.map(([label, value], index) => {
    const y = 250 + index * 78;
    return `<g>
      <rect x="620" y="${y}" width="560" height="60" rx="12" fill="rgba(255,255,255,0.12)"/>
      <text x="644" y="${y + 39}" font-family="${MONO}" font-size="21" fill="#a9e6c4">${label}</text>
      <text x="1156" y="${y + 39}" font-family="${MONO}" font-size="22" fill="#fff" text-anchor="end">${value}</text>
    </g>`;
  }).join('\n  ');

  return `${background(w, h)}
  <g>${emblemSvg(300, 300, 280)}</g>
  <text x="620" y="150" font-family="${SANS}" font-size="66" font-weight="700" fill="#fff">br-faker</text>
  <text x="620" y="200" font-family="${SANS}" font-size="26" fill="#d7f5e3">Preenche o formulário inteiro com um atalho</text>
  ${chips}
  <text x="620" y="520" font-family="${SANS}" font-size="20" fill="#a9e6c4">Uma pessoa coerente · documentos que passam na validação · sem permissão de host</text>`;
}

/**
 * Wrap a tile in a square canvas, centred.
 *
 * Quick Look scales the document into a square thumbnail; centring here means
 * the crop afterwards is a plain centred crop.
 */
function squareCanvas(content, width, height) {
  const side = Math.max(width, height);
  const offsetY = (side - height) / 2;
  const offsetX = (side - width) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${toHex(COLOURS.greenTop)}"/>
      <stop offset="1" stop-color="${toHex(COLOURS.greenBottom)}"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <rect width="${side}" height="${side}" fill="${toHex(COLOURS.greenBottom)}"/>
  <g transform="translate(${offsetX} ${offsetY})">
    ${content}
  </g>
</svg>
`;
}

await mkdir(OUT, { recursive: true });

for (const tile of TILES) {
  const content = tile.name === 'promo-small' ? smallTile() : marqueeTile();
  const svg = squareCanvas(content, tile.width, tile.height);
  const svgPath = join(OUT, `${tile.name}.svg`);
  await writeFile(svgPath, svg);

  const side = Math.max(tile.width, tile.height);
  await run('qlmanage', ['-t', '-s', String(side), '-o', OUT, svgPath]);
  const raster = join(OUT, `${tile.name}.svg.png`);

  // Centred crop back to the tile's real dimensions.
  await run('sips', ['-c', String(tile.height), String(tile.width), raster, '--out', join(OUT, `${tile.name}.png`)]);
  await run('rm', ['-f', raster]);

  console.log(`built ${join(OUT, `${tile.name}.png`)} (${tile.width}x${tile.height})`);
}
