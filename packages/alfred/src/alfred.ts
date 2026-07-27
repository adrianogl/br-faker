/**
 * Alfred Script Filter.
 *
 * Takes the typed query and returns the JSON Alfred renders. Every item
 * already carries a generated value in its title, so the result is visible
 * before pressing Enter; `arg` carries that same value to Copy to Clipboard.
 */
import { GENERATORS, GROUP_LABELS, type Generator, generate } from '@br-faker/core';

export interface AlfredItem {
  uid: string;
  title: string;
  subtitle: string;
  arg: string;
  valid: boolean;
  /** Feeds Alfred's own filtering on top of ours. */
  match: string;
  text: { copy: string; largetype: string };
  mods?: {
    alt?: { subtitle: string; arg: string };
  };
}

export interface AlfredOutput {
  items: AlfredItem[];
}

/** Drop diacritics so `titulo` matches `Título`. */
function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "");
}

/** Rank a generator against the query. `null` means no match. */
function score(generator: Generator, query: string): number | null {
  if (query === '') return 0;

  const keys = [generator.id, ...(generator.aliases ?? [])];
  if (keys.includes(query)) return 0;
  if (keys.some((key) => key.startsWith(query))) return 1;
  if (keys.some((key) => key.includes(query))) return 2;
  if (fold(generator.label).includes(query)) return 3;

  return null;
}

function toItem(generator: Generator): AlfredItem {
  const value = generate(generator, 1)[0] ?? '';
  // Derived from `value`, so Option copies the same number the title shows.
  const raw = generator.unmask?.(value);

  return {
    uid: generator.id,
    title: value,
    subtitle: `${GROUP_LABELS[generator.group]} › ${generator.label}`,
    arg: value,
    valid: true,
    match: [generator.id, ...(generator.aliases ?? []), generator.label].join(' '),
    text: { copy: value, largetype: value },
    mods: raw === undefined ? undefined : { alt: { subtitle: `Unmasked: ${raw}`, arg: raw } },
  };
}

export function buildOutput(rawQuery: string): AlfredOutput {
  const query = fold(rawQuery);

  const ranked = GENERATORS.map((generator) => ({ generator, rank: score(generator, query) }))
    .filter((entry): entry is { generator: Generator; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank);

  if (ranked.length === 0) {
    return {
      items: [
        {
          uid: 'no-match',
          title: 'No generator found',
          subtitle: `Nothing matches "${rawQuery.trim()}"`,
          arg: '',
          valid: false,
          match: '',
          text: { copy: '', largetype: '' },
        },
      ],
    };
  }

  return { items: ranked.map((entry) => toItem(entry.generator)) };
}
