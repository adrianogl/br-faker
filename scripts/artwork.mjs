/**
 * Shared definition of the emblem: the Brazilian diamond carrying a document.
 *
 * The icon renderer rasterises these numbers into a PNG and the banner
 * renderer emits them as SVG. Keeping the proportions in one place is what
 * stops the two artworks from drifting apart.
 *
 * Every measurement is a fraction of the artwork's width, so the same emblem
 * can be drawn at 512px for Alfred or 180px inside a banner.
 */

export const COLOURS = {
  greenTop: [0x1a, 0xb5, 0x54],
  greenBottom: [0x00, 0x7a, 0x2e],
  yellow: [0xff, 0xdf, 0x00],
  blue: [0x00, 0x27, 0x76],
  white: [0xff, 0xff, 0xff],
};

export const GEOMETRY = {
  plateHalf: 0.46,
  plateRadius: 0.22,
  diamondHalf: 0.4,
  diamondRadius: 0.02,
  cardHalfWidth: 0.2,
  cardHalfHeight: 0.145,
  cardRadius: 0.03,

  /**
   * Widths of the data rows on the card.
   *
   * Two rows, not three: Alfred draws the icon at roughly 32px, where anything
   * thinner than ~2px of final artwork blurs into a smudge. Two bold bars still
   * read as fields on a document; three did not survive the downscale.
   */
  rows: [0.22],
  rowHalfHeight: 0.032,
  rowSpacing: 0.116,
  rowLeft: -0.15,

  /**
   * An arrow in place of the second row: the card does not just hold data, it
   * pushes it out into the form. Kept inside the plate on purpose — anything
   * drawn outside it sits on the browser toolbar, whose colour we do not
   * control, so a white mark there vanishes on a light theme.
   */
  arrow: {
    shaftHalfWidth: 0.09,
    shaftHalfHeight: 0.026,
    shaftCentre: -0.06,
    headApex: 0.1,
    headHalfHeight: 0.062,
  },
};

/**
 * The same emblem, redrawn for the toolbar.
 *
 * At 16px the rows and the arrow collapse into a smudge — every variant tested
 * lost them. Chrome takes a separate file per size, so the small one is a
 * simplification rather than a reduction: fewer shapes, each bigger.
 */
export const SMALL_GEOMETRY = {
  ...GEOMETRY,
  diamondHalf: 0.44,
  cardHalfWidth: 0.24,
  cardHalfHeight: 0.17,
  cardRadius: 0.04,
  rows: [],
  arrow: null,
};

/** Chrome paints 16 and 32 in the toolbar; everything larger has room to speak. */
export function geometryFor(size) {
  return size < 48 ? SMALL_GEOMETRY : GEOMETRY;
}

export function toHex([r, g, b]) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * The emblem as SVG shapes, drawn at `size` around (`cx`, `cy`).
 *
 * Shared by the README banner and the store artwork so the mark is defined
 * once. `gradientId` names the plate gradient the caller must have declared.
 */
export function emblemSvg(size, cx, cy, gradientId = 'plate') {
  const g = GEOMETRY;
  const plate = size * g.plateHalf;
  const diamond = size * g.diamondHalf;
  const cardW = size * g.cardHalfWidth;
  const cardH = size * g.cardHalfHeight;

  const rows = g.rows
    .map((width, row) => {
      const height = 2 * size * g.rowHalfHeight;
      const centreY = cy + (row - (g.rows.length - 1) / 2) * size * g.rowSpacing;
      const x = cx + size * g.rowLeft;
      return `<rect x="${round(x)}" y="${round(centreY - height / 2)}" width="${round(width * size)}" height="${round(height)}" rx="${round(height / 2)}" fill="${toHex(COLOURS.white)}"/>`;
    })
    .join('\n      ');

  const a = g.arrow;
  const arrowY = cy + size * g.rowSpacing * 0.5;
  const shaftX = cx + size * (a.shaftCentre - a.shaftHalfWidth);
  const apex = cx + size * a.headApex;
  const head = size * a.headHalfHeight;

  return `<rect x="${round(cx - plate)}" y="${round(cy - plate)}" width="${round(plate * 2)}" height="${round(plate * 2)}" rx="${round(size * g.plateRadius)}" fill="url(#${gradientId})"/>
      <polygon points="${round(cx)},${round(cy - diamond)} ${round(cx + diamond)},${round(cy)} ${round(cx)},${round(cy + diamond)} ${round(cx - diamond)},${round(cy)}" fill="${toHex(COLOURS.yellow)}" stroke="${toHex(COLOURS.yellow)}" stroke-width="${round(size * g.diamondRadius * 2)}" stroke-linejoin="round"/>
      <rect x="${round(cx - cardW)}" y="${round(cy - cardH)}" width="${round(cardW * 2)}" height="${round(cardH * 2)}" rx="${round(size * g.cardRadius)}" fill="${toHex(COLOURS.blue)}"/>
      ${rows}
      <rect x="${round(shaftX)}" y="${round(arrowY - size * a.shaftHalfHeight)}" width="${round(size * a.shaftHalfWidth * 2)}" height="${round(size * a.shaftHalfHeight * 2)}" rx="${round(size * a.shaftHalfHeight)}" fill="${toHex(COLOURS.white)}"/>
      <polygon points="${round(apex)},${round(arrowY)} ${round(apex - head)},${round(arrowY - head)} ${round(apex - head)},${round(arrowY + head)}" fill="${toHex(COLOURS.white)}"/>`;
}
