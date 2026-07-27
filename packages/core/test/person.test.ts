import * as bu from '@brazilian-utils/brazilian-utils';
import { describe, expect, it } from 'vitest';

import { generatePerson } from '../src/person.js';
import { onlyDigits } from '../src/format.js';

const RUNS = 200;
const people = Array.from({ length: RUNS }, () => generatePerson());

describe('generatePerson', () => {
  it('never leaves a field empty', () => {
    for (const person of people) {
      for (const [key, value] of Object.entries(person)) {
        expect(String(value).trim(), key).not.toBe('');
      }
    }
  });

  it('produces documents that pass the official validators', () => {
    for (const person of people) {
      expect(bu.isValidCpf(person.cpf), person.cpf).toBe(true);
      expect(bu.isValidCnpj(person.cnpj), person.cnpj).toBe(true);
      expect(bu.isValidCep(person.postalCode), person.postalCode).toBe(true);
    }
  });
});

describe('coherence — the reason this exists', () => {
  it('places the person in a real municipality of their own state', () => {
    // faker's pt_BR invents cities and pairs them with unrelated states
    // ("Bryan do Descoberto / DF"). Every city here must be a real one that
    // brazilian-utils lists for that exact state.
    for (const person of people) {
      const cities = bu.getCities(person.stateCode);
      expect(cities, `${person.city}/${person.stateCode}`).toContain(person.city);
    }
  });

  it('gives the state code and name that belong together', () => {
    const states = new Map(bu.getStates().map((state) => [state.code, state.name]));
    for (const person of people) {
      expect(states.get(person.stateCode), person.stateCode).toBe(person.stateName);
    }
  });

  it('derives the email from the person’s own name', () => {
    const fold = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    for (const person of people) {
      const local = person.email.split('@')[0] ?? '';
      expect(local, person.email).toContain(fold(person.firstName));
      expect(local, person.email).toContain(fold(person.lastName));
    }
  });

  it('puts the postal code inside the drawn state’s range', () => {
    // The ranges are approximate at the edges, so this asserts the leading
    // digits land in the right block rather than pinning an exact CEP.
    const blockOf: Record<string, number[]> = {
      SP: [0, 1], RJ: [2], ES: [2], MG: [3], BA: [4], SE: [4], PE: [5], AL: [5],
      PB: [5], RN: [5], CE: [6], PI: [6], MA: [6], PA: [6], AP: [6], AM: [6],
      RR: [6], AC: [6], DF: [7], GO: [7], RO: [7], TO: [7], MT: [7], MS: [7],
      PR: [8], SC: [8], RS: [9],
    };

    for (const person of people) {
      const first = Number(onlyDigits(person.postalCode)[0]);
      expect(blockOf[person.stateCode], `${person.stateCode} ${person.postalCode}`).toContain(first);
    }
  });

  it('gives the full name as its own first and last name', () => {
    for (const person of people) {
      expect(person.fullName).toBe(`${person.firstName} ${person.lastName}`);
    }
  });

  it('formats phones completely, keeping every digit', () => {
    for (const person of people) {
      expect(person.mobile, person.mobile).toMatch(/^\(\d{2}\) 9\d{4}-\d{4}$/);
      expect(person.landline, person.landline).toMatch(/^\(\d{2}\) [2-5]\d{3}-\d{4}$/);
      expect(onlyDigits(person.mobile)).toHaveLength(11);
      expect(onlyDigits(person.landline)).toHaveLength(10);
    }
  });

  it('varies between calls', () => {
    expect(new Set(people.map((person) => person.cpf)).size).toBeGreaterThan(RUNS * 0.9);
  });
});
