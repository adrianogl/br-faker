import type { Person } from '@br-faker/core';

import { type Fillable, fillField, fillabilityProblem } from './apply.js';
import { type FieldKind, detect, readSignals } from './fields.js';
import { type FieldOverride, overrideFor, suggestSelector } from './overrides.js';

/**
 * Walking a form and filling what it recognises.
 *
 * Kept free of any chrome.* API so it can run under jsdom in tests, and it
 * takes the person as an argument rather than generating one. That import
 * boundary matters: the generators pull in faker and its locale data, which
 * would put half a megabyte into the content script injected on every page.
 * The service worker generates the person and hands it over; this module and
 * the content script stay a few kilobytes of DOM logic.
 */

/** Values that carry an unmasked variant worth retrying with. */
const UNMASK: Partial<Record<FieldKind, (value: string) => string>> = {
  cpf: (value) => value.replace(/\D/g, ''),
  cnpj: (value) => value.replace(/\D/g, ''),
  postalCode: (value) => value.replace(/\D/g, ''),
  mobile: (value) => value.replace(/\D/g, ''),
  landline: (value) => value.replace(/\D/g, ''),
  birthdate: (value) => value.split('/').reverse().join('-'),
};

export interface FilledField {
  kind: FieldKind;
  value: string;
  /** A short description of the control, for reporting back to the popup. */
  label: string;
}

export interface SkippedField {
  /** A selector the user can paste straight into a manual override. */
  selector: string;
  /** The placeholder or name, so the field is recognisable in the log. */
  hint: string;
}

export interface IgnoredField {
  selector: string;
  /** Why it could not be typed into: disabled, hidden, wrong type. */
  reason: string;
}

export interface FillReport {
  person: Person;
  filled: FilledField[];
  /**
   * Controls that were visible and editable but matched no known field, each
   * with a ready-made selector. Detection will never cover every component
   * library, so the honest move is to hand back exactly what is needed to map
   * the field by hand.
   */
  skipped: SkippedField[];
  /**
   * Controls that could not be typed into at all. Reported rather than dropped:
   * a field that appears in no list is impossible to debug from a console.
   */
  ignored: IgnoredField[];
}

function describe(element: Fillable): string {
  return (
    element.getAttribute('name') ||
    element.getAttribute('id') ||
    element.getAttribute('placeholder') ||
    element.tagName.toLowerCase()
  );
}

/**
 * A date input needs an ISO value regardless of how the page displays it, so
 * it takes the unmasked form first rather than the dd/mm/yyyy one.
 */
function valuesFor(kind: FieldKind, person: Person, element: Fillable): [string, string?] {
  const formatted = String(person[kind]);
  const unmask = UNMASK[kind];
  const raw = unmask?.(formatted);

  if (kind === 'birthdate' && element.getAttribute('type') === 'date' && raw) {
    return [raw, formatted];
  }

  return [formatted, raw];
}

export function fillForm(
  root: ParentNode,
  person: Person,
  overrides: FieldOverride[] = [],
): FillReport {
  const filled: FilledField[] = [];
  const skipped: SkippedField[] = [];
  const ignored: IgnoredField[] = [];

  const note = (element: Element) =>
    skipped.push({
      selector: suggestSelector(element),
      hint: element.getAttribute('placeholder') ?? element.getAttribute('name') ?? '',
    });

  for (const candidate of Array.from(root.querySelectorAll('input, textarea, select'))) {
    const problem = fillabilityProblem(candidate);
    if (problem) {
      ignored.push({ selector: suggestSelector(candidate), reason: problem });
      continue;
    }

    // `fillabilityProblem` returning null is exactly the check isFillable makes.
    const control = candidate as Fillable;

    // A manual mapping wins outright: the person looking at the form knows
    // more than the heuristics do.
    const override = overrideFor(control, overrides);
    if (override?.kind === 'skip') continue;

    const kind = override?.kind ?? detect(readSignals(control as HTMLElement))?.kind;
    if (!kind) {
      note(control);
      continue;
    }

    const [formatted, raw] = valuesFor(kind, person, control);
    const result = fillField(control, formatted, raw);

    if (result.filled) {
      filled.push({ kind, value: result.used ?? formatted, label: describe(control) });
    } else {
      note(control);
    }
  }

  return { person, filled, skipped, ignored };
}
