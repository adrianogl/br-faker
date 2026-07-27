import { describe, expect, it } from 'vitest';

import { parseArgs, run } from '../src/cli.js';

describe('parseArgs', () => {
  it('reads the positional generator', () => {
    expect(parseArgs(['cpf']).key).toBe('cpf');
  });

  it('accepts short and long flag forms', () => {
    expect(parseArgs(['cpf', '-n', '3']).count).toBe(3);
    expect(parseArgs(['cpf', '--count', '3']).count).toBe(3);
    expect(parseArgs(['cpf', '-r']).raw).toBe(true);
    expect(parseArgs(['cpf', '--json']).json).toBe(true);
  });

  it('rejects an invalid count', () => {
    expect(() => parseArgs(['cpf', '-n', '0'])).toThrow(/integer >= 1/);
    expect(() => parseArgs(['cpf', '-n', 'abc'])).toThrow(/integer >= 1/);
    expect(() => parseArgs(['cpf', '-n'])).toThrow(/integer >= 1/);
  });

  it('rejects an unknown option and an extra argument', () => {
    expect(() => parseArgs(['cpf', '--nope'])).toThrow(/unknown option/);
    expect(() => parseArgs(['cpf', 'cnpj'])).toThrow(/unexpected argument/);
  });
});

describe('run', () => {
  it('produces one value with clean output', () => {
    const { stdout, exitCode } = run(['cpf']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  });

  it('produces N values, one per line', () => {
    expect(run(['cpf', '-n', '5']).stdout.split('\n')).toHaveLength(5);
  });

  it('emits valid JSON with --json', () => {
    const parsed = JSON.parse(run(['cnpj', '--json', '-n', '2']).stdout);
    expect(parsed.generator).toBe('cnpj');
    expect(parsed.values).toHaveLength(2);
  });

  it('resolves an alias', () => {
    expect(run(['cnpja', '--json']).stdout).toContain('"generator": "cnpj-alpha"');
  });

  it('lists the generators', () => {
    const { stdout, exitCode } = run(['--list']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Documents');
    expect(stdout).toContain('cnpj-alpha');
  });

  it('exits 1 on an unknown generator', () => {
    const { stdout, exitCode } = run(['banana']);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('unknown generator');
  });

  it('exits 2 on a usage error', () => {
    expect(run(['--nope']).exitCode).toBe(2);
    expect(run([]).exitCode).toBe(2);
  });

  it('exits 0 on --help', () => {
    const { stdout, exitCode } = run(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage:');
  });
});
