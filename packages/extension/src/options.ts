import { DEFAULT_LANGUAGE, type Language, applyTranslations, initI18n, t } from './i18n.js';
import { type FieldOverride, parseOverrides, serialiseOverrides } from './overrides.js';
import { DEFAULT_SETTINGS, type ScopeSettings } from './scope.js';

/**
 * Two independent panels.
 *
 * They were one form with one Save, which meant a typo in a mapping refused to
 * save the allowed sites as well. Unrelated settings should not be able to
 * block each other, so each panel reads and writes only its own keys.
 */

const languageEl = document.getElementById('language') as HTMLSelectElement;
const allowlistEl = document.getElementById('allowlist') as HTMLTextAreaElement;
const enforceEl = document.getElementById('enforce') as HTMLInputElement;
const allowlistStatus = document.getElementById('allowlist-status') as HTMLElement;

const overridesEl = document.getElementById('overrides') as HTMLTextAreaElement;
const overridesStatus = document.getElementById('overrides-status') as HTMLElement;
const overridesCount = document.getElementById('overrides-count') as HTMLElement;

function flash(element: HTMLElement, message: string): void {
  element.textContent = message;
  setTimeout(() => (element.textContent = ''), 1800);
}

function describeCount(count: number): string {
  return t('optionsMappingsActive', String(count));
}

async function load(): Promise<void> {
  const { language } = (await chrome.storage.sync.get({ language: DEFAULT_LANGUAGE })) as {
    language: Language;
  };
  languageEl.value = language;

  const settings = (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as ScopeSettings;
  allowlistEl.value = settings.allowlist.join('\n');
  enforceEl.checked = settings.enforce;

  const { overrides } = (await chrome.storage.sync.get({ overrides: [] })) as {
    overrides: FieldOverride[];
  };
  overridesEl.value = serialiseOverrides(overrides);
  overridesCount.textContent = describeCount(overrides.length);
}

document.getElementById('save-allowlist')?.addEventListener('click', async () => {
  const allowlist = allowlistEl.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  await chrome.storage.sync.set({ allowlist, enforce: enforceEl.checked });
  flash(allowlistStatus, t('optionsSaved'));
});

document.getElementById('save-overrides')?.addEventListener('click', async () => {
  const { overrides, errors } = parseOverrides(overridesEl.value);

  if (errors.length > 0) {
    // Refusing to save a half-understood mapping beats silently dropping the
    // lines that did not parse.
    overridesStatus.textContent = t('optionsMappingsNotSaved', errors.join('; '));
    return;
  }

  await chrome.storage.sync.set({ overrides });
  overridesCount.textContent = describeCount(overrides.length);
  flash(overridesStatus, t('optionsSaved'));
});

// Changing the language re-renders immediately: waiting for a save button
// would leave the page describing itself in the language you just left.
languageEl?.addEventListener('change', async () => {
  await chrome.storage.sync.set({ language: languageEl.value as Language });
  await initI18n();
  applyTranslations();
  await load();
});

void (async () => {
  await initI18n();
  applyTranslations();
  await load();
})();
