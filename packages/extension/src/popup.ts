import type { FillOutcome } from './background.js';
import { applyTranslations, initI18n, t } from './i18n.js';
import { DEFAULT_SETTINGS, type ScopeSettings, hostnameOf, isAllowed } from './scope.js';

/**
 * Popup: shows whether the current site is in scope before anything is typed
 * into it, so allowing a new site is a deliberate click rather than a surprise.
 */

const hostEl = document.getElementById('host') as HTMLElement;
const scopeEl = document.getElementById('scope') as HTMLElement;
const fillButton = document.getElementById('fill') as HTMLButtonElement;
const allowButton = document.getElementById('allow') as HTMLButtonElement;
const pickButton = document.getElementById('pick') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;
const optionsLink = document.getElementById('options') as HTMLAnchorElement;

async function currentTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function settings(): Promise<ScopeSettings> {
  return (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as ScopeSettings;
}

async function render(): Promise<void> {
  const tab = await currentTab();
  const url = tab?.url ?? '';
  const hostname = hostnameOf(url);

  hostEl.textContent = hostname ?? t('popupNoPage');

  if (!hostname) {
    scopeEl.textContent = '';
    fillButton.disabled = true;
    return;
  }

  const allowed = isAllowed(url, await settings());
  scopeEl.textContent = t(allowed ? 'popupScopeAllowed' : 'popupScopeNotAllowed');
  scopeEl.className = allowed ? '' : 'muted';
  fillButton.disabled = !allowed;
  allowButton.hidden = allowed;
}

fillButton.addEventListener('click', async () => {
  statusEl.textContent = t('popupFilling');
  const outcome: FillOutcome = await chrome.runtime.sendMessage({ type: 'fill' });

  if (!outcome?.ok) {
    statusEl.textContent = t(
      outcome?.reason === 'not-allowed' ? 'popupNotAllowed' : 'popupCannotRun',
    );
    return;
  }

  statusEl.textContent =
    outcome.filled === 0 ? t('popupNoFields') : t('popupFilled', String(outcome.filled));
});

allowButton.addEventListener('click', async () => {
  const tab = await currentTab();
  const hostname = hostnameOf(tab?.url ?? '');
  if (!hostname) return;

  const current = await settings();
  await chrome.storage.sync.set({
    ...current,
    allowlist: [...new Set([...current.allowlist, hostname])],
  });

  statusEl.textContent = t('popupAllowed', hostname);
  await render();
});

pickButton.addEventListener('click', async () => {
  const outcome = await chrome.runtime.sendMessage({ type: 'start-picker' });

  if (!outcome?.ok) {
    statusEl.textContent = t('popupCannotRun');
    return;
  }

  // The picker lives in the page, and the popup closes the moment focus moves
  // there — closing it explicitly avoids a stale window hanging around.
  window.close();
});

optionsLink.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

void (async () => {
  await initI18n();
  applyTranslations();
  await render();
})();
