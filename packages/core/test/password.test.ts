import { describe, expect, it } from 'vitest';

import { PASSWORD_LENGTH, PASSWORD_SYMBOLS, generatePassword } from '../src/password.js';
import { generatePerson } from '../src/person.js';
import { findGenerator } from '../src/generators.js';

const RUNS = 300;
const SYMBOL = new RegExp(`[${PASSWORD_SYMBOLS.replace(/[$^\-\]\\]/g, '\\$&')}]`);

function expectStrong(password: string): void {
  expect(password, password).toMatch(/[a-z]/);
  expect(password, password).toMatch(/[A-Z]/);
  expect(password, password).toMatch(/[0-9]/);
  expect(password, password).toMatch(SYMBOL);
}

describe('generatePassword', () => {
  it('always mixes lowercase, uppercase, digit and symbol', () => {
    for (let i = 0; i < RUNS; i++) expectStrong(generatePassword());
  });

  it('honours the requested length and never drops below the four classes', () => {
    expect(generatePassword()).toHaveLength(PASSWORD_LENGTH);
    expect(generatePassword(24)).toHaveLength(24);
    expect(generatePassword(1)).toHaveLength(4);
  });

  it('does not always place the classes in the same positions', () => {
    const firstChars = new Set(Array.from({ length: RUNS }, () => generatePassword()[0]));
    expect(firstChars.size).toBeGreaterThan(1);
  });

  it('leaves out characters that look alike', () => {
    for (let i = 0; i < RUNS; i++) {
      expect(generatePassword(), 'ambiguous character').not.toMatch(/[lIO01]/);
    }
  });
});

describe('the password reaching Alfred, the CLI and the extension', () => {
  it('comes strong from the generator registry', () => {
    const generator = findGenerator('senha');
    expect(generator?.id).toBe('password');
    for (let i = 0; i < RUNS; i++) expectStrong(generator!.generate());
  });

  it('comes strong from the generated person', () => {
    for (let i = 0; i < RUNS; i++) expectStrong(generatePerson().password);
  });
});
