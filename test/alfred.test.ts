import { describe, expect, it } from 'vitest';

import { buildOutput } from '../src/alfred.js';
import { GENERATORS } from '../src/generators.js';

describe('buildOutput', () => {
  it('returns every generator when the query is empty', () => {
    expect(buildOutput('').items).toHaveLength(GENERATORS.length);
  });

  it('ranks the exact match first', () => {
    expect(buildOutput('cnpj').items[0]?.uid).toBe('cnpj');
  });

  it('finds by alias', () => {
    expect(buildOutput('cnpja').items[0]?.uid).toBe('cnpj-alpha');
  });

  it('finds by Portuguese alias', () => {
    expect(buildOutput('endereco').items[0]?.uid).toBe('address');
  });

  it('finds by prefix', () => {
    expect(buildOutput('cn').items.map((item) => item.uid)).toContain('cnh');
  });

  it('ignores diacritics when matching the label', () => {
    expect(buildOutput('licence').items[0]?.uid).toBe('cnh');
  });

  it('carries the generated value in the title and mirrors it in arg', () => {
    const item = buildOutput('cpf').items[0]!;
    expect(item.title).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(item.arg).toBe(item.title);
    expect(item.text.copy).toBe(item.title);
  });

  it('offers the unmasked value under the alt modifier', () => {
    expect(buildOutput('cpf').items[0]?.mods?.alt?.arg).toMatch(/^\d{11}$/);
  });

  it('alt carries the same value as the title, only unmasked', () => {
    // Regression: alt used to call the generator a second time, so Option
    // copied a completely different number from the one on screen.
    for (const query of ['cpf', 'cnpj', 'cnpj-alpha', 'cep', 'celular', 'cnh']) {
      const item = buildOutput(query).items[0]!;
      const alt = item.mods?.alt?.arg;
      expect(alt, query).toBeDefined();
      const canonical = (v: string) => v.replace(/[^0-9a-z]/gi, "").toLowerCase().split("").sort().join("");
      expect(canonical(alt!), `${query}: ${item.title} vs ${alt}`).toBe(canonical(item.title));
    }
  });

  it('omits alt when there is no unmask transform', () => {
    expect(buildOutput('name').items[0]?.mods).toBeUndefined();
  });

  it('returns a non-selectable item when nothing matches', () => {
    const items = buildOutput('xyzzy').items;
    expect(items).toHaveLength(1);
    expect(items[0]?.valid).toBe(false);
  });

  it('gives every item the fields Alfred requires', () => {
    for (const item of buildOutput('').items) {
      expect(item.uid).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.subtitle).toBeTruthy();
      expect(typeof item.arg).toBe('string');
      expect(typeof item.valid).toBe('boolean');
    }
  });
});
