import { describe, expect, it } from 'vitest';

import { formatPhone, formatPostalCode, formatStreetAddress, onlyDigits } from '../src/format.js';

describe('formatPhone', () => {
  it('formats an 11-digit mobile without losing a digit', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('formats a 10-digit landline', () => {
    expect(formatPhone('1132654789')).toBe('(11) 3265-4789');
  });

  it('preserves every input digit', () => {
    // brazilian-utils' formatPhone truncated: 11987654321 -> 11987-6543.
    for (const input of ['11987654321', '6597648731', '41966178071']) {
      expect(onlyDigits(formatPhone(input))).toBe(input);
    }
  });

  it('accepts already-masked input', () => {
    expect(formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
  });

  it('returns the input untouched when the length is unexpected', () => {
    expect(formatPhone('123')).toBe('123');
  });
});

describe('formatPostalCode', () => {
  it('formats 8 digits', () => {
    expect(formatPostalCode('01310100')).toBe('01310-100');
  });

  it('leaves an invalid length alone', () => {
    expect(formatPostalCode('123')).toBe('123');
  });
});

describe('formatStreetAddress', () => {
  it('uses Brazilian order, with the number after the street', () => {
    expect(formatStreetAddress('Avenida Ígor', '1009')).toBe('Avenida Ígor, 1009');
  });
});

describe('onlyDigits', () => {
  it('strips the mask', () => {
    expect(onlyDigits('42.638.682/0001-02')).toBe('42638682000102');
  });
});
