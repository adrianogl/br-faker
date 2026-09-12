import type { Person } from '@br-faker/core';

/**
 * Filling forms with an address that actually reaches you.
 *
 * A generated email is right for a throwaway form and wrong for one that sends
 * a confirmation link. Gmail and most providers deliver anything after a `+` to
 * the same inbox, so one real address covers every signup — as long as each
 * fill uses a different tag, because a site that already has
 * `you+001@gmail.com` on file will refuse the second one.
 *
 * The tag is the moment of the fill, down to the second: any two fills a
 * person can make in sequence get different addresses, and reading the tag back
 * in the inbox says which test the message came from.
 */

export interface EmailSettings {
  /** The address fills should reach. Empty means keep the generated one. */
  emailBase: string;
}

export const EMAIL_DEFAULTS: EmailSettings = { emailBase: '' };

export interface EmailBase {
  local: string;
  domain: string;
}

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const LOCAL = /^[a-z0-9!#$%&'*/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*/=?^_`{|}~-]+)*$/;

/**
 * Read the configured address, dropping any tag it already carries.
 *
 * Someone who has been plus-addressing by hand will paste
 * `you+teste@gmail.com`, and keeping that tag would produce
 * `you+teste+260911t143012@gmail.com` — which most providers no longer route.
 * The part before the first `+` is the address; the rest is ours to write.
 *
 * Lowercased whole: the local part is case-sensitive by the RFC and treated as
 * insensitive by every provider this is aimed at, so normalising it costs
 * nothing and stops `You@` and `you@` from reading as two different settings.
 */
export function parseEmailBase(value: string): EmailBase | null {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return null;

  const local = trimmed.slice(0, at).split('+')[0] ?? '';
  const domain = trimmed.slice(at + 1);

  if (!local || !LOCAL.test(local)) return null;
  if (!DOMAIN.test(domain)) return null;

  return { local, domain };
}

/** `250911t143012` — local time, so the tag matches the clock on the wall. */
function stamp(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${pad(at.getFullYear() % 100)}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${date}t${time}`;
}

export function aliasFor(base: EmailBase, at: Date = new Date()): string {
  return `${base.local}+${stamp(at)}@${base.domain}`;
}

/**
 * Swap the generated email for a tagged alias, when one is configured.
 *
 * An unset or unparseable setting leaves the person untouched: a typo in the
 * options should cost a fake email, never a fill that fails.
 */
export function withEmailAlias(person: Person, emailBase: string, at: Date = new Date()): Person {
  const base = parseEmailBase(emailBase);
  if (!base) return person;

  return { ...person, email: aliasFor(base, at) };
}
