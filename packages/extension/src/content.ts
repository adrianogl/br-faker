import type { Person } from '@br-faker/core';

import { fillForm } from './fill.js';

/**
 * Injected on demand by the service worker, never auto-loaded.
 *
 * The person is requested from the service worker rather than generated here:
 * the generators carry faker's locale data, and bundling them into a script
 * that gets injected into every page would mean shipping half a megabyte per
 * fill. This file stays DOM logic only.
 *
 * The last expression is what `chrome.scripting.executeScript` hands back, so
 * the popup can report how much was filled without a second round trip.
 */
async function run(): Promise<{ filled: number; skipped: number }> {
  const person: Person = await chrome.runtime.sendMessage({ type: 'person' });
  const report = fillForm(document, person);

  // Surfacing the mapping in the page console makes a wrong guess debuggable:
  // you can see which control received which field.
  if (report.filled.length > 0) {
    console.groupCollapsed(`[BR Faker] filled ${report.filled.length} field(s)`);
    for (const field of report.filled) console.log(`${field.label} → ${field.kind}: ${field.value}`);
    console.groupEnd();
  }

  return { filled: report.filled.length, skipped: report.skipped };
}

run();
