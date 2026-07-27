import { describe, expect, it } from 'vitest';

import {
  defaultPatternFor,
  matchesUrl,
  overrideFor,
  overridesFor,
  parseOverrides,
  serialiseOverrides,
  suggestSelector,
  upsertOverride,
} from '../src/overrides.js';

describe('matchesUrl', () => {
  it('matches a bare host on any port', () => {
    expect(matchesUrl('http://localhost:5173/cadastro', 'localhost')).toBe(true);
    expect(matchesUrl('http://localhost/cadastro', 'localhost')).toBe(true);
  });

  it('honours a port when the pattern names one', () => {
    expect(matchesUrl('http://localhost:5173/x', 'localhost:5173')).toBe(true);
    expect(matchesUrl('http://localhost:3000/x', 'localhost:5173')).toBe(false);
  });

  it('treats the path as a prefix', () => {
    const pattern = 'localhost:5173/cadastro';
    expect(matchesUrl('http://localhost:5173/cadastro', pattern)).toBe(true);
    expect(matchesUrl('http://localhost:5173/cadastro/etapa-2', pattern)).toBe(true);
    expect(matchesUrl('http://localhost:5173/login', pattern)).toBe(false);
  });

  it('supports a subdomain wildcard', () => {
    expect(matchesUrl('https://app.example.com/x', '*.example.com')).toBe(true);
    expect(matchesUrl('https://example.com/x', '*.example.com')).toBe(false);
  });

  it('rejects an unparseable url and an empty pattern', () => {
    expect(matchesUrl('not a url', 'localhost')).toBe(false);
    expect(matchesUrl('http://localhost/', '  ')).toBe(false);
  });
});

describe('overridesFor', () => {
  const all = [
    { url: 'localhost:5173/cadastro', selector: '#a', kind: 'cnpj' as const },
    { url: 'localhost:5173/login', selector: '#b', kind: 'email' as const },
    { url: 'localhost', selector: '#c', kind: 'cpf' as const },
  ];

  it('keeps only what applies to the page, in order', () => {
    const applicable = overridesFor('http://localhost:5173/cadastro', all);
    expect(applicable.map((o) => o.selector)).toEqual(['#a', '#c']);
  });
});

describe('overrideFor', () => {
  it('matches the control itself, not a document query', () => {
    document.body.innerHTML = '<input id="doc"><input id="other">';
    const input = document.getElementById('doc')!;
    const override = { url: 'x', selector: '#doc', kind: 'cnpj' as const };

    expect(overrideFor(input, [override])).toBe(override);
    expect(overrideFor(document.getElementById('other')!, [override])).toBeUndefined();
  });

  it('survives an invalid selector instead of taking the fill down', () => {
    document.body.innerHTML = '<input id="doc">';
    const input = document.getElementById('doc')!;
    expect(overrideFor(input, [{ url: 'x', selector: '((', kind: 'cpf' }])).toBeUndefined();
  });

  it('returns the first match when several apply', () => {
    document.body.innerHTML = '<input id="doc" name="documento">';
    const input = document.getElementById('doc')!;
    const first = { url: 'x', selector: '#doc', kind: 'cnpj' as const };
    const second = { url: 'x', selector: '[name="documento"]', kind: 'cpf' as const };
    expect(overrideFor(input, [first, second])).toBe(first);
  });
});

describe('parseOverrides', () => {
  it('reads the three-part form', () => {
    const { overrides, errors } = parseOverrides(
      'localhost:5173/cadastro | input[placeholder="XX.XXX.XXX/XXXX-00"] | cnpj',
    );
    expect(errors).toEqual([]);
    expect(overrides).toEqual([
      {
        url: 'localhost:5173/cadastro',
        selector: 'input[placeholder="XX.XXX.XXX/XXXX-00"]',
        kind: 'cnpj',
      },
    ]);
  });

  it('ignores blank lines and comments', () => {
    const { overrides } = parseOverrides('\n# um comentario\nlocalhost | #a | cpf\n\n');
    expect(overrides).toHaveLength(1);
  });

  it('reports a malformed line with its number', () => {
    const { errors } = parseOverrides('localhost | #a');
    expect(errors[0]).toContain('line 1');
  });

  it('rejects a field name that does not exist', () => {
    const { errors } = parseOverrides('localhost | #a | banana');
    expect(errors[0]).toContain('unknown field "banana"');
  });

  it('accepts skip as a target', () => {
    expect(parseOverrides('localhost | #a | skip').overrides[0]?.kind).toBe('skip');
  });

  it('round-trips through serialise', () => {
    const text = 'localhost:5173/cadastro | #cnpj | cnpj';
    expect(serialiseOverrides(parseOverrides(text).overrides)).toBe(text);
  });
});

describe('suggestSelector', () => {
  it('prefers an id, then a name, then a test id', () => {
    document.body.innerHTML = `
      <input id="cnpj" name="documento">
      <input name="documento2">
      <input data-testid="campo-cnpj">
      <input placeholder="XX.XXX.XXX/XXXX-00">
    `;
    const [byId, byName, byTestId, byPlaceholder] = Array.from(
      document.querySelectorAll('input'),
    );

    expect(suggestSelector(byId!)).toBe('#cnpj');
    expect(suggestSelector(byName!)).toBe('input[name="documento2"]');
    expect(suggestSelector(byTestId!)).toBe('[data-testid="campo-cnpj"]');
    expect(suggestSelector(byPlaceholder!)).toBe('input[placeholder="XX.XXX.XXX/XXXX-00"]');
  });

  it('produces a selector that actually finds the element back', () => {
    document.body.innerHTML = '<form><input name="documento"><input id="x"></form>';
    for (const input of Array.from(document.querySelectorAll('input'))) {
      expect(document.querySelector(suggestSelector(input))).toBe(input);
    }
  });
});

describe('defaultPatternFor', () => {
  it('keeps host, port and path, so a mapping stays on the page it was made for', () => {
    expect(defaultPatternFor('http://localhost:5173/cadastro')).toBe('localhost:5173/cadastro');
    expect(defaultPatternFor('https://app.example.com/checkout/step-2')).toBe(
      'app.example.com/checkout/step-2',
    );
  });

  it('drops a trailing slash so the root does not become a dangling path', () => {
    expect(defaultPatternFor('http://localhost:5173/')).toBe('localhost:5173');
  });

  it('ignores the query and hash, which are not part of the page identity', () => {
    expect(defaultPatternFor('http://localhost:5173/cadastro?step=2#top')).toBe(
      'localhost:5173/cadastro',
    );
  });

  it('produces a pattern that matches the url it came from', () => {
    const url = 'http://localhost:5173/cadastro';
    expect(matchesUrl(url, defaultPatternFor(url))).toBe(true);
  });

  it('returns empty for an unparseable url', () => {
    expect(defaultPatternFor('not a url')).toBe('');
  });
});

describe('upsertOverride', () => {
  const base = { url: 'localhost/x', selector: '#a', kind: 'cpf' as const };

  it('adds a new mapping', () => {
    expect(upsertOverride([], base)).toEqual([base]);
  });

  it('replaces the mapping for the same url and selector', () => {
    // Re-mapping a field must correct it, not leave a stale rule that wins by
    // being first in the list.
    const corrected = { ...base, kind: 'cnpj' as const };
    const result = upsertOverride([base], corrected);

    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('cnpj');
  });

  it('keeps mappings for other selectors and other urls', () => {
    const other = { url: 'localhost/x', selector: '#b', kind: 'email' as const };
    const elsewhere = { url: 'localhost/y', selector: '#a', kind: 'city' as const };

    const result = upsertOverride([base, other, elsewhere], { ...base, kind: 'cnpj' });
    expect(result).toHaveLength(3);
    expect(result.filter((o) => o.selector === '#a')).toHaveLength(2);
  });
});
