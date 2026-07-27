import type { FieldKind } from './fields.js';

/**
 * Manual field mapping, per URL.
 *
 * Heuristics cannot win against a component library that keeps the label in a
 * React prop and never puts the word anywhere the DOM can see it. When that
 * happens the answer is not a cleverer regex — it is letting the person who is
 * looking at the form say "this selector is the CNPJ" and having that stick.
 *
 * Overrides beat detection outright, and `skip` is a first-class target so a
 * field the heuristics grab wrongly can be told to stay empty.
 */

export interface FieldOverride {
  /** Where it applies: `host[:port][/path-prefix]`, `*.` allowed on the host. */
  url: string;
  /** CSS selector, matched within the page. */
  selector: string;
  /** Which Person key to write, or `skip` to leave the control alone. */
  kind: FieldKind | 'skip';
}

/**
 * Does a URL fall under an override's pattern?
 *
 * The host must match exactly (or by `*.` wildcard) and the path is a prefix,
 * so `localhost:5173/cadastro` covers `/cadastro` and `/cadastro/etapa-2`
 * without leaking into the rest of the app.
 */
export function matchesUrl(url: string, pattern: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const trimmed = pattern.trim().toLowerCase();
  if (!trimmed) return false;

  const slash = trimmed.indexOf('/');
  const hostPattern = slash === -1 ? trimmed : trimmed.slice(0, slash);
  const pathPattern = slash === -1 ? '' : trimmed.slice(slash);

  // A pattern without a port matches any port, so `localhost` covers :5173.
  const host = hostPattern.includes(':') ? parsed.host.toLowerCase() : parsed.hostname.toLowerCase();

  const hostMatches = hostPattern.startsWith('*.')
    ? host.endsWith(hostPattern.slice(1))
    : host === hostPattern;
  if (!hostMatches) return false;

  return pathPattern === '' || parsed.pathname.toLowerCase().startsWith(pathPattern);
}

/** The overrides that apply to a URL, in the order they were defined. */
export function overridesFor(url: string, all: FieldOverride[]): FieldOverride[] {
  return all.filter((override) => matchesUrl(url, override.url));
}

/**
 * Find the override governing one control, if any.
 *
 * Uses `matches` rather than querying the document so a selector is evaluated
 * against the element itself — the same rule applies wherever it appears.
 */
export function overrideFor(
  element: Element,
  applicable: FieldOverride[],
): FieldOverride | undefined {
  return applicable.find((override) => {
    try {
      return element.matches(override.selector);
    } catch {
      // An invalid selector should not take the whole fill down with it.
      return false;
    }
  });
}

/**
 * The pattern the picker writes when it saves a mapping.
 *
 * Host plus the exact path: specific enough that mapping a field on
 * `/cadastro` does not silently apply to the checkout, and easy to widen by
 * hand afterwards by deleting the path.
 */
export function defaultPatternFor(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * Add a mapping, replacing any earlier one for the same URL and selector.
 *
 * Re-mapping a field you already mapped should correct it, not leave two rules
 * where the stale one wins by being first.
 */
export function upsertOverride(
  existing: FieldOverride[],
  override: FieldOverride,
): FieldOverride[] {
  const others = existing.filter(
    (candidate) => candidate.url !== override.url || candidate.selector !== override.selector,
  );
  return [...others, override];
}

/** Every field a mapping may target, plus the opt-out. */
export const OVERRIDE_TARGETS: readonly (FieldKind | 'skip')[] = [
  'fullName', 'firstName', 'lastName', 'email', 'username', 'password',
  'cpf', 'cnpj', 'company', 'mobile', 'landline', 'birthdate',
  'postalCode', 'street', 'city', 'stateCode', 'stateName', 'skip',
];

/**
 * Parse the options page's `url | selector | field` lines.
 *
 * Returns the errors rather than throwing on the first one, so the page can
 * point at every bad line at once instead of making the user fix them one by
 * one. A mapping that does not parse is never saved silently.
 */
export function parseOverrides(text: string): { overrides: FieldOverride[]; errors: string[] } {
  const overrides: FieldOverride[] = [];
  const errors: string[] = [];

  text.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const parts = line.split('|').map((part) => part.trim());
    if (parts.length !== 3 || parts.some((part) => !part)) {
      errors.push(`line ${index + 1}: expected "url | selector | field"`);
      return;
    }

    const [url, selector, kind] = parts as [string, string, string];

    if (!OVERRIDE_TARGETS.includes(kind as FieldKind | 'skip')) {
      errors.push(`line ${index + 1}: unknown field "${kind}"`);
      return;
    }

    overrides.push({ url, selector, kind: kind as FieldKind | 'skip' });
  });

  return { overrides, errors };
}

/** Render mappings back into the text form the options page edits. */
export function serialiseOverrides(overrides: FieldOverride[]): string {
  return overrides.map((o) => `${o.url} | ${o.selector} | ${o.kind}`).join('\n');
}

/**
 * A selector a person can paste into their overrides.
 *
 * Prefers whatever is most likely to survive a re-render: an id, then a name,
 * then a test id. Falls back to a positional path, which is brittle but still
 * a starting point they can edit.
 */
export function suggestSelector(element: Element): string {
  const id = element.getAttribute('id');
  if (id) return `#${id}`;

  const name = element.getAttribute('name');
  if (name) return `${element.tagName.toLowerCase()}[name="${name}"]`;

  for (const attribute of ['data-testid', 'data-test', 'formcontrolname']) {
    const value = element.getAttribute(attribute);
    if (value) return `[${attribute}="${value}"]`;
  }

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return `${element.tagName.toLowerCase()}[placeholder="${placeholder}"]`;

  const parent = element.parentElement;
  if (!parent) return element.tagName.toLowerCase();

  const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  const index = siblings.indexOf(element) + 1;
  return `${element.tagName.toLowerCase()}:nth-of-type(${index})`;
}
