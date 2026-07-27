import { formatPhone } from './format.js';

/**
 * Area codes (DDD) currently in use in Brazil.
 *
 * `generatePhone` from brazilian-utils does use valid area codes, but it
 * alternates between landline and mobile with no way to choose — you cannot
 * ask it for "a mobile number". Since `mobile` and `landline` are separate
 * generators here, the numbers are built from this list instead.
 */
export const AREA_CODES: readonly number[] = [
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
];

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pickAreaCode(): string {
  return String(AREA_CODES[randomInt(AREA_CODES.length)]);
}

function digits(count: number): string {
  let out = '';
  for (let i = 0; i < count; i++) out += randomInt(10);
  return out;
}

/**
 * Mobile: 11 digits, starts with 9, second digit in 6-9, following Anatel's
 * numbering plan.
 */
export function generateMobile(): string {
  return `${pickAreaCode()}9${6 + randomInt(4)}${digits(7)}`;
}

/** Landline: 10 digits, first subscriber digit between 2 and 5. */
export function generateLandline(): string {
  return `${pickAreaCode()}${2 + randomInt(4)}${digits(7)}`;
}

export function generateMobileFormatted(): string {
  return formatPhone(generateMobile());
}

export function generateLandlineFormatted(): string {
  return formatPhone(generateLandline());
}
