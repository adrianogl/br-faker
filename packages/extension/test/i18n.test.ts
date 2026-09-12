import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  type Language,
  applyTranslations,
  messageFor,
  resolveCatalogue,
  t,
} from '../src/i18n.js';
import { OVERRIDE_TARGETS } from '../src/overrides.js';

const EXTENSION = join(import.meta.dirname, '..');
const LOCALES = join(EXTENSION, '_locales');
const SRC = join(EXTENSION, 'src');

function messages(locale: string): Record<string, { message: string }> {
  return JSON.parse(readFileSync(join(LOCALES, locale, 'messages.json'), 'utf8'));
}

const locales = readdirSync(LOCALES);
const catalogues = Object.fromEntries(locales.map((locale) => [locale, messages(locale)]));

/** Every source and markup file, so keys can be traced back to their use. */
function sources(): string[] {
  return readdirSync(SRC)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.html') || file.endsWith('.json'))
    .map((file) => readFileSync(join(SRC, file), 'utf8'));
}

describe('the catalogues agree', () => {
  it('ships pt_BR and en', () => {
    expect(locales.sort()).toEqual(['en', 'pt_BR']);
  });

  it('defines the same keys in every locale', () => {
    // A key present in one language and missing in another shows up as a raw
    // identifier in the interface, which is the failure this prevents.
    const [reference, ...rest] = locales;
    const expected = Object.keys(catalogues[reference!]!).sort();

    for (const locale of rest) {
      expect(Object.keys(catalogues[locale]!).sort(), locale).toEqual(expected);
    }
  });

  it('leaves no message empty', () => {
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      for (const [key, entry] of Object.entries(catalogue)) {
        expect(entry.message.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('declares a placeholder for every substitution it uses', () => {
    for (const [locale, catalogue] of Object.entries(catalogues)) {
      for (const [key, entry] of Object.entries(catalogue) as [string, Record<string, unknown>][]) {
        const used = [...String(entry.message).matchAll(/\$([A-Z]+)\$?/g)].map((m) => m[1]!);
        if (used.length === 0) continue;

        const declared = Object.keys((entry.placeholders as object) ?? {}).map((p) =>
          p.toUpperCase(),
        );
        for (const placeholder of used) {
          expect(declared, `${locale}.${key}`).toContain(placeholder);
        }
      }
    }
  });
});

describe('every key the code asks for exists', () => {
  const text = sources().join('\n');

  it('covers t() calls', () => {
    const keys = [...text.matchAll(/\bt\('([A-Za-z_]+)'/g)].map((match) => match[1]!);
    expect(keys.length).toBeGreaterThan(0);

    for (const key of new Set(keys)) {
      expect(Object.keys(catalogues.pt_BR!), key).toContain(key);
    }
  });

  it('covers data-i18n attributes in the pages', () => {
    const keys = [...text.matchAll(/data-i18n(?:-placeholder)?="([A-Za-z_]+)"/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(0);

    for (const key of new Set(keys)) {
      expect(Object.keys(catalogues.pt_BR!), key).toContain(key);
    }
  });

  it('covers __MSG__ references in the manifest', () => {
    const manifest = readFileSync(join(SRC, 'manifest.json'), 'utf8');
    const keys = [...manifest.matchAll(/__MSG_([A-Za-z_]+)__/g)].map((match) => match[1]!);
    expect(keys.length).toBeGreaterThan(0);

    for (const key of new Set(keys)) {
      expect(Object.keys(catalogues.pt_BR!), key).toContain(key);
    }
  });

  it('has a label for every field the picker offers', () => {
    // The picker builds its keys as `field_<kind>`, so a new field kind would
    // otherwise reach the menu as a bare identifier.
    for (const kind of OVERRIDE_TARGETS) {
      expect(Object.keys(catalogues.pt_BR!), kind).toContain(`field_${kind}`);
    }
  });
});

describe('Portuguese is the default, not the browser\u2019s choice', () => {
  it('defaults the preference to pt_BR', () => {
    // Chrome would resolve by browser UI language and offers no override, so
    // shipping an English catalogue meant an English browser got English no
    // matter what default_locale said. The preference settles it here.
    expect(DEFAULT_LANGUAGE).toBe('pt_BR');
  });

  it('honours an explicit choice over the browser language', () => {
    expect(resolveCatalogue('pt_BR', 'en-US').popupFill!.message).toBe('Preencher este formulário');
    expect(resolveCatalogue('en', 'pt-BR').popupFill!.message).toBe('Fill this form');
  });

  it('follows the browser only when asked to', () => {
    expect(resolveCatalogue('auto', 'pt-BR').popupFill!.message).toBe('Preencher este formulário');
    expect(resolveCatalogue('auto', 'en-GB').popupFill!.message).toBe('Fill this form');
    // "Follow the browser" means exactly that, so a language with no catalogue
    // of its own gets English — the useful international fallback. Portuguese
    // is the default for the *preference*, not for this branch.
    expect(resolveCatalogue('auto', 'ja').popupFill!.message).toBe('Fill this form');
  });

  it('falls back to Portuguese for a language it has no catalogue for', () => {
    // storage.sync carries settings between versions, so a stored language can
    // outlive its catalogue. Returning undefined here threw on every lookup and
    // took the whole interface down with it.
    expect(resolveCatalogue('es' as Language, 'pt-BR').popupFill!.message).toBe(
      'Preencher este formulário',
    );
  });

  it('still declares default_locale, which Chrome uses for the manifest strings', () => {
    const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
    expect(manifest.default_locale).toBe('pt_BR');
  });
});

describe('t and applyTranslations', () => {
  it('resolves from the bundled catalogue, in Portuguese by default', () => {
    expect(t('popupFill')).toBe('Preencher este formulário');
  });

  it('substitutes named placeholders', () => {
    expect(t('popupFilled', '7')).toBe('7 campo(s) preenchido(s).');
    expect(t('popupAllowed', 'localhost')).toBe('localhost liberado.');
  });

  it('does not read a substituted value as another placeholder', () => {
    // The email preview passes an address the user typed, and `$` is legal in
    // a local part. Filling the slot must not hand the value back to be filled
    // in again.
    expect(t('popupAllowed', 'a$1b.com')).toBe('a$1b.com liberado.');
  });

  it('returns the key for a message that does not exist', () => {
    expect(t('naoExiste')).toBe('naoExiste');
  });

  it('answers from the Portuguese catalogue when the active one lacks the key', () => {
    // A raw `popupFilled` on screen is the failure this prevents: one sentence
    // in the wrong language beats an identifier where a message should be.
    const incomplete = { extName: { message: 'BR Faker' } };
    expect(messageFor(incomplete, 'popupFilled')).toBe('$COUNT campo(s) preenchido(s).');
    expect(messageFor(incomplete, 'naoExiste')).toBeUndefined();
  });

  it('fills text and placeholders from data attributes', () => {
    document.body.innerHTML = `
      <h1 data-i18n="extName">old</h1>
      <input data-i18n-placeholder="popupFill">
    `;
    applyTranslations();

    expect(document.querySelector('h1')?.textContent).toBe('BR Faker');
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe(
      'Preencher este formulário',
    );
  });
});
