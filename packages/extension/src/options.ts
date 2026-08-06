import { DEFAULT_LANGUAGE, type Language, applyTranslations, initI18n, t } from './i18n.js';
import { type FieldOverride, parseOverrides, serialiseOverrides } from './overrides.js';
import { FLOATING_DEFAULTS, type FloatingSettings } from './floating-button.js';
import { DEFAULT_SETTINGS, type ScopeSettings, originPatternsFor } from './scope.js';

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

const floatingEl = document.getElementById('floating') as HTMLInputElement;
const floatingStatus = document.getElementById('floating-status') as HTMLElement;

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

  const settings = (await chrome.storage.sync.get({
    ...DEFAULT_SETTINGS,
    ...FLOATING_DEFAULTS,
  })) as ScopeSettings & FloatingSettings;
  allowlistEl.value = settings.allowlist.join('\n');
  enforceEl.checked = settings.enforce;
  floatingEl.checked = settings.floatingButton;

  const { overrides } = (await chrome.storage.sync.get({ overrides: [] })) as {
    overrides: FieldOverride[];
  };
  overridesEl.value = serialiseOverrides(overrides);
  overridesCount.textContent = describeCount(overrides.length);
}

function editedScope(): ScopeSettings {
  return {
    allowlist: allowlistEl.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    enforce: enforceEl.checked,
  };
}

/**
 * Ask for the hosts the button needs.
 *
 * `chrome.permissions.request` only works while the click that triggered it is
 * still being handled, so it is called before anything is awaited — an `await`
 * first and Chrome refuses the prompt as gestureless.
 */
function requestFloatingAccess(scope: ScopeSettings): Promise<boolean> {
  const origins = originPatternsFor(scope);
  if (origins.length === 0) return Promise.resolve(false);
  return chrome.permissions.request({ origins });
}

document.getElementById('save-allowlist')?.addEventListener('click', () => {
  const scope = editedScope();
  // Saved sites are what the button's script matches, so a widened list needs
  // the matching permission before the button can follow it there.
  const wanted = floatingEl.checked;
  const granted = wanted ? requestFloatingAccess(scope) : Promise.resolve(false);

  void (async () => {
    const floatingButton = wanted && (await granted);
    floatingEl.checked = floatingButton;

    await chrome.storage.sync.set({ ...scope, floatingButton });
    flash(allowlistStatus, t('optionsSaved'));
    if (wanted && !floatingButton) flash(floatingStatus, t('optionsFloatingDenied'));
  })();
});

floatingEl.addEventListener('change', () => {
  const scope = editedScope();

  if (!floatingEl.checked) {
    void (async () => {
      await chrome.storage.sync.set({ floatingButton: false });
      await chrome.permissions.remove({ origins: originPatternsFor(scope) }).catch(() => false);
      flash(floatingStatus, t('optionsSaved'));
    })();
    return;
  }

  if (originPatternsFor(scope).length === 0) {
    floatingEl.checked = false;
    flash(floatingStatus, t('optionsFloatingNoHosts'));
    return;
  }

  const granted = requestFloatingAccess(scope);

  void (async () => {
    if (!(await granted)) {
      floatingEl.checked = false;
      flash(floatingStatus, t('optionsFloatingDenied'));
      return;
    }

    await chrome.storage.sync.set({ ...scope, floatingButton: true });
    flash(floatingStatus, t('optionsSaved'));
  })();
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
