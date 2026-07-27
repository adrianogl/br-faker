import type { Person } from '@br-faker/core';

import { fillForm } from './fill.js';
import type { FieldOverride } from './overrides.js';

/**
 * Injected on demand by the service worker, never auto-loaded.
 *
 * The person and the manual overrides are requested from the service worker
 * rather than produced here: the generators carry faker's locale data, and
 * bundling them into a script injected into every page would mean shipping
 * half a megabyte per fill. This file stays DOM logic only.
 *
 * The last expression is what `chrome.scripting.executeScript` hands back, so
 * the popup can report how much was filled without a second round trip.
 */
interface Payload {
  person: Person;
  overrides: FieldOverride[];
}

async function run(): Promise<{ filled: number; skipped: number }> {
  const { person, overrides }: Payload = await chrome.runtime.sendMessage({
    type: 'payload',
    url: location.href,
  });

  const report = fillForm(document, person, overrides);

  // The mapping goes to the page console so a wrong guess is debuggable, and
  // anything unrecognised comes with a selector ready to paste into the manual
  // mappings — the fastest path from "this field is wrong" to a fix.
  if (report.filled.length > 0) {
    console.groupCollapsed(`[BR Faker] filled ${report.filled.length} field(s)`);
    for (const field of report.filled) console.log(`${field.label} → ${field.kind}: ${field.value}`);
    console.groupEnd();
  }

  if (report.ignored.length > 0) {
    console.groupCollapsed(`[BR Faker] ${report.ignored.length} control(s) could not be typed into`);
    for (const field of report.ignored) console.log(`  ${field.selector}   // ${field.reason}`);
    console.groupEnd();
  }

  if (report.skipped.length > 0) {
    console.groupCollapsed(
      `[BR Faker] ${report.skipped.length} field(s) not recognised — map them by hand`,
    );
    console.log('Paste these into "Field mappings" in the extension options:');
    for (const field of report.skipped) {
      console.log(`  ${field.selector}${field.hint ? `   // ${field.hint}` : ''}`);
    }
    console.groupEnd();
  }

  return { filled: report.filled.length, skipped: report.skipped.length };
}

run();
