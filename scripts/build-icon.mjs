#!/usr/bin/env node
/**
 * Render the Alfred workflow icon.
 *
 * Writes workflow/icon.png with no image dependencies: shapes are signed
 * distance fields, antialiased by smoothstep, and the PNG is encoded here on
 * top of the built-in zlib. Keeping it in code means the icon is reproducible
 * and reviewable in a diff rather than an opaque binary someone has to trust.
 *
 * The proportions live in artwork.mjs, shared with the README banner.
 */
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLOURS, GEOMETRY } from './artwork.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Alfred takes one large icon; the extension needs the sizes Chrome asks for
 * in its manifest. All of them come from the same renderer.
 */
const TARGETS = [
  { size: 512, path: join(ROOT, 'packages', 'alfred', 'workflow', 'icon.png') },
  ...[16, 32, 48, 128].map((size) => ({
    size,
    path: join(ROOT, 'packages', 'extension', 'icons', `icon-${size}.png`),
  })),
];

/** Distance to a rounded rectangle centred on the origin. */
function sdRoundedRect(x, y, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x) - halfWidth + radius;
  const dy = Math.abs(y) - halfHeight + radius;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Distance to a rhombus (the flag's diamond), with rounded corners. */
function sdDiamond(x, y, halfDiagonal, radius) {
  return (Math.abs(x) + Math.abs(y) - halfDiagonal) / Math.SQRT2 - radius;
}

/** 1 inside the shape, 0 outside, ramped across `width` pixels for antialiasing. */
function coverage(distance, width = 1.5) {
  return Math.min(Math.max(0.5 - distance / width, 0), 1);
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Source-over composite of an opaque colour onto an RGBA accumulator. */
function over(dst, colour, alpha) {
  const outAlpha = alpha + dst[3] * (1 - alpha);
  if (outAlpha === 0) return [0, 0, 0, 0];
  for (let i = 0; i < 3; i++) {
    dst[i] = (colour[i] * alpha + dst[i] * dst[3] * (1 - alpha)) / outAlpha;
  }
  dst[3] = outAlpha;
  return dst;
}

function render(SIZE) {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  const centre = SIZE / 2;
  const g = GEOMETRY;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      // Sample at pixel centres, in coordinates relative to the icon centre.
      const x = px + 0.5 - centre;
      const y = py + 0.5 - centre;
      const pixel = [0, 0, 0, 0];

      // Background plate: a rounded square with a soft vertical gradient, and a
      // little inset so the icon does not touch Alfred's row edges.
      const plate = sdRoundedRect(x, y, SIZE * g.plateHalf, SIZE * g.plateHalf, SIZE * g.plateRadius);
      const gradient = mix(COLOURS.greenTop, COLOURS.greenBottom, (y + centre) / SIZE);
      over(pixel, gradient, coverage(plate));

      // The flag's diamond, carrying a document in place of the celestial
      // globe: green and yellow still read as Brazil, while the card and its
      // rows of text say the workflow produces records.
      over(pixel, COLOURS.yellow, coverage(sdDiamond(x, y, SIZE * g.diamondHalf, SIZE * g.diamondRadius)));
      const card = sdRoundedRect(x, y, SIZE * g.cardHalfWidth, SIZE * g.cardHalfHeight, SIZE * g.cardRadius);
      over(pixel, COLOURS.blue, coverage(card));

      // Rows of data on the card, ragged on the right the way real fields are.
      for (const [row, width] of g.rows.entries()) {
        // Subtracting puts rows[0] at the top: y grows downwards here.
        const rowY = y - (row - (g.rows.length - 1) / 2) * SIZE * g.rowSpacing;
        const halfWidth = (width * SIZE) / 2;
        const rowX = x - (g.rowLeft * SIZE + halfWidth);
        const bar = sdRoundedRect(rowX, rowY, halfWidth, SIZE * g.rowHalfHeight, SIZE * g.rowHalfHeight);
        over(pixel, COLOURS.white, coverage(bar));
      }

      const offset = (py * SIZE + px) * 4;
      pixels[offset] = Math.round(pixel[0]);
      pixels[offset + 1] = Math.round(pixel[1]);
      pixels[offset + 2] = Math.round(pixel[2]);
      pixels[offset + 3] = Math.round(pixel[3] * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(pixels, SIZE) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type; 0 means "none".
  const stride = SIZE * 4;
  const raw = Buffer.alloc(SIZE * (stride + 1));
  for (let row = 0; row < SIZE; row++) {
    raw[row * (stride + 1)] = 0;
    pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const { size, path } of TARGETS) {
  await mkdir(dirname(path), { recursive: true });
  const png = encodePng(render(size), size);
  await writeFile(path, png);
  console.log(`built ${path} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
