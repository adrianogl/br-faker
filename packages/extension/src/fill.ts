import type { Person } from '@br-faker/core';

import { type Fillable, fillField, isFillable } from './apply.js';
import { type FieldKind, detect, readSignals } from './fields.js';

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

export interface FillReport {
  person: Person;
  filled: FilledField[];
  /** Controls that were visible and editable but matched no known field. */
  skipped: number;
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

export function fillForm(root: ParentNode, person: Person): FillReport {
  const filled: FilledField[] = [];
  let skipped = 0;

  for (const candidate of Array.from(root.querySelectorAll('input, textarea, select'))) {
    if (!isFillable(candidate)) continue;

    const detection = detect(readSignals(candidate as HTMLElement));
    if (!detection) {
      skipped++;
      continue;
    }

    const [formatted, raw] = valuesFor(detection.kind, person, candidate);
    const result = fillField(candidate, formatted, raw);

    if (result.filled) {
      filled.push({
        kind: detection.kind,
        value: result.used ?? formatted,
        label: describe(candidate),
      });
    } else {
      skipped++;
    }
  }

  return { person, filled, skipped };
}
