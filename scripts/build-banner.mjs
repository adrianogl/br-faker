#!/usr/bin/env node
/**
 * Render the README banner as SVG, in a light and a dark variant.
 *
 * SVG rather than PNG because there is no image toolchain to depend on, the
 * result stays a few KB, and it survives any display density. The emblem
 * reuses the icon's proportions from artwork.mjs so the two never drift.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLOURS, emblemSvg, toHex } from './artwork.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSETS = join(ROOT, 'assets');

const WIDTH = 860;
const HEIGHT = 300;

// Emblem box: 180px square, centred vertically, inset from the left edge.
const EMBLEM = 180;
const EMBLEM_CX = 150;
const EMBLEM_CY = HEIGHT / 2;

const TEXT_X = 290;

const TITLE = 'br-faker';
const TAGLINE = 'Brazilian fake data, in Alfred and in your browser';
const CHIPS = ['cpf', 'cnpj', 'cnpj-alpha', 'cnh', 'cep'];

const SANS = 'system-ui, -apple-system, &#34;Segoe UI&#34;, Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const THEMES = {
  light: {
    title: '#0f172a',
    tagline: '#475569',
    chipFill: '#f1f5f9',
    chipStroke: '#dbe2ea',
    chipText: '#334155',
  },
  dark: {
    title: '#e6edf3',
    tagline: '#9198a1',
    chipFill: '#1c2128',
    chipStroke: '#30363d',
    chipText: '#c9d1d9',
  },
};


/**
 * Generator chips. Widths are derived from the label length because SVG has no
 * text measurement — a monospace face keeps that estimate honest.
 */
function chips(theme) {
  const fontSize = 17;
  const charWidth = fontSize * 0.6;
  const height = 32;
  const y = 206;
  let x = TEXT_X;

  return CHIPS.map((label) => {
    const width = label.length * charWidth + 28;
    const chip = `<g>
        <rect x="${round(x)}" y="${y}" width="${round(width)}" height="${height}" rx="8" fill="${theme.chipFill}" stroke="${theme.chipStroke}"/>
        <text x="${round(x + width / 2)}" y="${y + height / 2 + 6}" font-family="${MONO}" font-size="${fontSize}" fill="${theme.chipText}" text-anchor="middle">${label}</text>
      </g>`;
    x += width + 10;
    return chip;
  }).join('\n      ');
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function banner(theme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${TITLE} — ${TAGLINE}">
  <defs>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${toHex(COLOURS.greenTop)}"/>
      <stop offset="1" stop-color="${toHex(COLOURS.greenBottom)}"/>
    </linearGradient>
  </defs>
  <g>
      ${emblemSvg(EMBLEM, EMBLEM_CX, EMBLEM_CY)}
  </g>
  <text x="${TEXT_X}" y="128" font-family="${SANS}" font-size="52" font-weight="700" fill="${theme.title}">${TITLE}</text>
  <text x="${TEXT_X}" y="168" font-family="${SANS}" font-size="21" fill="${theme.tagline}">${TAGLINE}</text>
  <g>
      ${chips(theme)}
  </g>
</svg>
`;
}

await mkdir(ASSETS, { recursive: true });

for (const [name, theme] of Object.entries(THEMES)) {
  const path = join(ASSETS, `banner-${name}.svg`);
  const svg = banner(theme);
  await writeFile(path, svg);
  console.log(`built ${path} (${(svg.length / 1024).toFixed(1)} KB)`);
}
