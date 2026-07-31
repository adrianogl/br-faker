/**
 * Alphabets without the characters that look alike (`l`, `I`, `O`, `0`, `1`):
 * a fake password is usually read off the screen and typed by hand.
 */
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
/**
 * Symbols accepted by the great majority of Brazilian sign-up forms. Quotes,
 * backslashes, angle brackets and spaces are left out on purpose: they are the
 * ones that tend to be rejected by validation or to break when the value is
 * pasted into a shell.
 */
export const PASSWORD_SYMBOLS = '!@#$%&*_-+=?';

const ALL = LOWERCASE + UPPERCASE + DIGITS + PASSWORD_SYMBOLS;

export const PASSWORD_LENGTH = 16;

function pick(alphabet: string): string {
  return alphabet.charAt(Math.floor(Math.random() * alphabet.length));
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swapped = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = swapped;
  }
  return chars;
}

/**
 * Password with at least one lowercase letter, one uppercase letter, one digit
 * and one symbol.
 *
 * faker's `internet.password` draws from a single alphabet, so it can return a
 * value with no symbol at all and get rejected by the form being filled. Here
 * one character of each class is drawn first and the rest is filled at random,
 * so the result always passes the usual complexity rules.
 */
export function generatePassword(length: number = PASSWORD_LENGTH): string {
  const size = Math.max(length, 4);
  const chars = [pick(LOWERCASE), pick(UPPERCASE), pick(DIGITS), pick(PASSWORD_SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALL));
  return shuffle(chars).join('');
}
