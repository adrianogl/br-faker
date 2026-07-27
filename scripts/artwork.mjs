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
  rows: [0.22, 0.15],
  rowHalfHeight: 0.032,
  rowSpacing: 0.116,
  rowLeft: -0.15,
};

export function toHex([r, g, b]) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
