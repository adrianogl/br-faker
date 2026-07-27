import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, isAllowed, matchesPattern } from '../src/scope.js';

describe('matchesPattern', () => {
  it('matches an exact hostname', () => {
    expect(matchesPattern('localhost', 'localhost')).toBe(true);
    expect(matchesPattern('example.com', 'localhost')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(matchesPattern('Example.COM', 'example.com')).toBe(true);
  });

  it('matches subdomains under a wildcard', () => {
    expect(matchesPattern('app.example.com', '*.example.com')).toBe(true);
    expect(matchesPattern('a.b.example.com', '*.example.com')).toBe(true);
  });

  it('does not let a wildcard cover the bare domain', () => {
    // Widening scope has to be deliberate, so *.example.com must not silently
    // grant example.com itself.
    expect(matchesPattern('example.com', '*.example.com')).toBe(false);
  });

  it('does not match a domain that merely ends with the pattern text', () => {
    expect(matchesPattern('notexample.com', '*.example.com')).toBe(false);
  });

  it('ignores an empty pattern', () => {
    expect(matchesPattern('example.com', '   ')).toBe(false);
  });
});

describe('isAllowed', () => {
  it('allows local development by default', () => {
    for (const url of [
      'http://localhost:3000/signup',
      'http://127.0.0.1:8080/',
      'http://app.localhost/form',
      'http://myapp.test/register',
    ]) {
      expect(isAllowed(url, DEFAULT_SETTINGS), url).toBe(true);
    }
  });

  it('blocks the open internet by default', () => {
    for (const url of ['https://example.com/signup', 'https://bank.com.br/cadastro']) {
      expect(isAllowed(url, DEFAULT_SETTINGS), url).toBe(false);
    }
  });

  it('blocks browser-internal pages, where there is nothing to fill', () => {
    expect(isAllowed('chrome://extensions', DEFAULT_SETTINGS)).toBe(false);
    expect(isAllowed('about:blank', DEFAULT_SETTINGS)).toBe(false);
  });

  it('rejects an unparseable url rather than defaulting to allow', () => {
    expect(isAllowed('not a url', DEFAULT_SETTINGS)).toBe(false);
  });

  it('allows a site the user added', () => {
    const settings = { allowlist: ['staging.myapp.com'], enforce: true };
    expect(isAllowed('https://staging.myapp.com/x', settings)).toBe(true);
    expect(isAllowed('https://myapp.com/x', settings)).toBe(false);
  });

  it('allows everything only when enforcement is deliberately off', () => {
    expect(isAllowed('https://example.com', { allowlist: [], enforce: false })).toBe(true);
  });
});
