import * as bu from '@brazilian-utils/brazilian-utils';
import { cnpj as alphanumericCnpj, cpf as cpfValidator } from 'cpf-cnpj-validator';
import { describe, expect, it } from 'vitest';

import { GENERATORS, allKeys, findGenerator, generate } from '@br-faker/core';
import { AREA_CODES, generateLandline, generateMobile } from '../src/phone.js';
import { onlyDigits } from '../src/format.js';

const RUNS = 200;

/** Run a generator many times and return the values. */
function sample(id: string, raw = false): string[] {
  const generator = findGenerator(id);
  if (!generator) throw new Error(`generator missing from the registry: ${id}`);
  return generate(generator, RUNS, raw);
}

describe('registry', () => {
  it('has no duplicate ids or aliases', () => {
    const keys = allKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('resolves every generator by id and by each alias', () => {
    for (const generator of GENERATORS) {
      expect(findGenerator(generator.id)).toBe(generator);
      for (const alias of generator.aliases ?? []) {
        expect(findGenerator(alias)).toBe(generator);
      }
    }
  });

  it('accepts keys with surrounding space and mixed case', () => {
    expect(findGenerator('  CPF ')?.id).toBe('cpf');
  });

  it('returns undefined for an unknown key', () => {
    expect(findGenerator('does-not-exist')).toBeUndefined();
  });

  it('never returns an empty string', () => {
    for (const generator of GENERATORS) {
      for (const value of generate(generator, 20)) {
        expect(value.trim(), `generator ${generator.id} returned empty`).not.toBe('');
      }
    }
  });

  it('honours the requested count', () => {
    expect(generate(findGenerator('cpf')!, 7)).toHaveLength(7);
  });

  it('uses the unmasked variant when one exists', () => {
    for (const value of sample('cpf', true)) {
      expect(value).toMatch(/^\d{11}$/);
    }
  });

  it('falls back to the formatted value when there is no unmask transform', () => {
    const name = findGenerator('name')!;
    expect(name.unmask).toBeUndefined();
    expect(generate(name, 1, true)[0]).toBeTruthy();
  });

  it('unmask reuses the formatted value, inventing and losing nothing', () => {
    // Compares the multiset of alphanumeric characters, so `birthdate`
    // reordering 23/07/1993 into 1993-07-23 is allowed while a generator
    // producing an unrelated value is not.
    const characters = (value: string) =>
      value
        .replace(/[^0-9a-z]/gi, '')
        .toLowerCase()
        .split('')
        .sort()
        .join('');

    for (const generator of GENERATORS) {
      if (!generator.unmask) continue;
      for (let i = 0; i < 20; i++) {
        const formatted = generator.generate();
        const raw = generator.unmask(formatted);
        expect(characters(raw), `${generator.id}: ${formatted} -> ${raw}`).toBe(
          characters(formatted),
        );
      }
    }
  });

  it('keeps Portuguese aliases reachable', () => {
    for (const [alias, id] of [
      ['nome', 'name'],
      ['endereco', 'address'],
      ['celular', 'mobile'],
      ['cep', 'postal-code'],
      ['placa', 'license-plate'],
      ['titulo', 'voter-id'],
    ] as const) {
      expect(findGenerator(alias)?.id, alias).toBe(id);
    }
  });
});

describe('documents pass the official validators', () => {
  it('cpf', () => {
    for (const value of sample('cpf')) {
      expect(bu.isValidCpf(value), value).toBe(true);
      expect(cpfValidator.isValid(value), value).toBe(true);
    }
  });

  it('numeric cnpj', () => {
    for (const value of sample('cnpj')) {
      expect(value, value).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
      expect(bu.isValidCnpj(value), value).toBe(true);
    }
  });

  it('alphanumeric cnpj', () => {
    for (const value of sample('cnpj-alpha')) {
      expect(alphanumericCnpj.isValid(value), value).toBe(true);
    }
  });

  it('cnh', () => {
    for (const value of sample('cnh')) {
      expect(bu.isValidCnh(value), value).toBe(true);
    }
  });

  it('pis', () => {
    for (const value of sample('pis')) {
      expect(bu.isValidPis(value), value).toBe(true);
    }
  });

  it('voter id', () => {
    for (const value of sample('voter-id')) {
      expect(bu.isValidVoterId(value), value).toBe(true);
    }
  });

  it('licence plate', () => {
    for (const value of sample('license-plate')) {
      expect(bu.isValidLicensePlate(value), value).toBe(true);
    }
  });

  it('postal code', () => {
    for (const value of sample('postal-code')) {
      expect(value, value).toMatch(/^\d{5}-\d{3}$/);
      expect(bu.isValidCep(value), value).toBe(true);
    }
  });

  it('lawsuit number', () => {
    for (const value of sample('lawsuit')) {
      expect(bu.isValidProcessoJuridico(value), value).toBe(true);
    }
  });
});

describe('phone numbers', () => {
  it('mobile is a valid mobile, with a real area code and a complete mask', () => {
    for (const value of sample('mobile')) {
      expect(value, value).toMatch(/^\(\d{2}\) 9\d{4}-\d{4}$/);
      const digits = onlyDigits(value);
      expect(digits).toHaveLength(11);
      expect(AREA_CODES, value).toContain(Number(digits.slice(0, 2)));
      expect(bu.isValidMobilePhone(digits), value).toBe(true);
    }
  });

  it('landline has 10 digits and a real area code', () => {
    for (const value of sample('landline')) {
      expect(value, value).toMatch(/^\(\d{2}\) [2-5]\d{3}-\d{4}$/);
      const digits = onlyDigits(value);
      expect(digits).toHaveLength(10);
      expect(AREA_CODES, value).toContain(Number(digits.slice(0, 2)));
    }
  });

  it('raw generators return digits only', () => {
    for (let i = 0; i < RUNS; i++) {
      expect(generateMobile()).toMatch(/^\d{11}$/);
      expect(generateLandline()).toMatch(/^\d{10}$/);
    }
  });
});

describe('address', () => {
  it('puts the number after the street, not before', () => {
    for (const value of sample('street')) {
      expect(value, value).toMatch(/, \d+$/);
      expect(value, value).not.toMatch(/^\d/);
    }
  });

  it('full address carries street, city, state code and postal code', () => {
    for (const value of sample('address')) {
      expect(value, value).toMatch(/^.+, \d+ - .+\/[A-Z]{2} - \d{5}-\d{3}$/);
    }
  });

  it('state code is two uppercase letters', () => {
    for (const value of sample('state-code')) {
      expect(value, value).toMatch(/^[A-Z]{2}$/);
    }
  });
});

describe('internet', () => {
  it('email is lowercase and well formed', () => {
    for (const value of sample('email')) {
      expect(value, value).toBe(value.toLowerCase());
      expect(bu.isValidEmail(value), value).toBe(true);
    }
  });

  it('uuid is v4', () => {
    for (const value of sample('uuid')) {
      expect(value, value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it('ipv4 has four octets in range', () => {
    for (const value of sample('ip')) {
      const parts = value.split('.');
      expect(parts, value).toHaveLength(4);
      for (const part of parts) {
        expect(Number(part), value).toBeGreaterThanOrEqual(0);
        expect(Number(part), value).toBeLessThanOrEqual(255);
      }
    }
  });
});
