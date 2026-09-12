import { describe, expect, it } from 'vitest';
import type { Person } from '@br-faker/core';

import { aliasFor, parseEmailBase, withEmailAlias } from '../src/email.js';

const person = { email: 'joao.silva42@gmail.com', firstName: 'João' } as Person;

describe('parseEmailBase', () => {
  it('splits a plain address', () => {
    expect(parseEmailBase('adgoleva@gmail.com')).toEqual({ local: 'adgoleva', domain: 'gmail.com' });
  });

  it('normalises case and surrounding space', () => {
    expect(parseEmailBase('  AdgoLeva@Gmail.COM ')).toEqual({
      local: 'adgoleva',
      domain: 'gmail.com',
    });
  });

  it('drops a tag the address already carries', () => {
    // Keeping it would build you+teste+260911t143012@gmail.com, which most
    // providers no longer route.
    expect(parseEmailBase('adgoleva+teste@gmail.com')).toEqual({
      local: 'adgoleva',
      domain: 'gmail.com',
    });
  });

  it('accepts a multi-level domain', () => {
    expect(parseEmailBase('eu@mail.empresa.com.br')?.domain).toBe('mail.empresa.com.br');
  });

  it('rejects what is not an address', () => {
    for (const value of ['', '   ', 'adgoleva', 'adgoleva@', '@gmail.com', 'a@gmail', 'a b@x.com']) {
      expect(parseEmailBase(value)).toBeNull();
    }
  });

  it('rejects a local part no provider would accept', () => {
    // A leading, trailing or doubled dot is invalid by RFC 5321 and refused by
    // Gmail. Accepting one would send every fill to an address that does not
    // exist, which is the opposite of what the setting is for.
    for (const value of ['.a@gmail.com', 'a.@gmail.com', 'a..b@gmail.com', '...@gmail.com']) {
      expect(parseEmailBase(value)).toBeNull();
    }
  });

  it('accepts a dotted local part', () => {
    expect(parseEmailBase('adriano.goncalves@gmail.com')?.local).toBe('adriano.goncalves');
  });

  it('rejects an address that is only a tag', () => {
    expect(parseEmailBase('+001@gmail.com')).toBeNull();
  });
});

describe('aliasFor', () => {
  it('tags the address with the local date and time', () => {
    const at = new Date(2026, 8, 11, 14, 30, 12);
    expect(aliasFor({ local: 'adgoleva', domain: 'gmail.com' }, at)).toBe(
      'adgoleva+260911t143012@gmail.com',
    );
  });

  it('pads every part to a fixed width', () => {
    const at = new Date(2026, 0, 2, 3, 4, 5);
    expect(aliasFor({ local: 'eu', domain: 'x.com' }, at)).toBe('eu+260102t030405@x.com');
  });

  it('differs between two fills in the same minute', () => {
    const base = { local: 'eu', domain: 'x.com' };
    const first = aliasFor(base, new Date(2026, 8, 11, 14, 30, 12));
    const second = aliasFor(base, new Date(2026, 8, 11, 14, 30, 49));
    expect(first).not.toBe(second);
  });

  it('resolves to the second, and no finer', () => {
    // Two fills inside one second — a double click, or two frames of the same
    // page — share a tag. They are the same signup attempt, so the address
    // being the same is not a problem worth a longer tag.
    const base = { local: 'eu', domain: 'x.com' };
    expect(aliasFor(base, new Date(2026, 8, 11, 14, 30, 12, 100))).toBe(
      aliasFor(base, new Date(2026, 8, 11, 14, 30, 12, 900)),
    );
  });
});

describe('withEmailAlias', () => {
  it('replaces the generated email when a base is configured', () => {
    const at = new Date(2026, 8, 11, 14, 30, 12);
    expect(withEmailAlias(person, 'adgoleva@gmail.com', at).email).toBe(
      'adgoleva+260911t143012@gmail.com',
    );
  });

  it('leaves the rest of the person alone', () => {
    const filled = withEmailAlias(person, 'adgoleva@gmail.com');
    expect(filled.firstName).toBe(person.firstName);
    expect(person.email).toBe('joao.silva42@gmail.com');
  });

  it('keeps the generated email when nothing is configured', () => {
    expect(withEmailAlias(person, '').email).toBe(person.email);
  });

  it('keeps the generated email when the setting is a typo', () => {
    // A bad setting should cost a fake email, never the fill.
    expect(withEmailAlias(person, 'adgoleva(at)gmail.com').email).toBe(person.email);
  });
});
