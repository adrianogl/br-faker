import type { FillOutcome } from './background.js';
import { DEFAULT_SETTINGS, type ScopeSettings, hostnameOf, isAllowed } from './scope.js';

/**
 * Popup: shows whether the current site is in scope before anything is typed
 * into it, so allowing a new site is a deliberate click rather than a surprise.
 */

const hostEl = document.getElementById('host') as HTMLElement;
const scopeEl = document.getElementById('scope') as HTMLElement;
const fillButton = document.getElementById('fill') as HTMLButtonElement;
const allowButton = document.getElementById('allow') as HTMLButtonElement;
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

  hostEl.textContent = hostname ?? 'no page';

  if (!hostname) {
    scopeEl.textContent = '';
    fillButton.disabled = true;
    return;
  }

  const allowed = isAllowed(url, await settings());
  scopeEl.textContent = allowed ? 'In your allowed sites' : 'Not in your allowed sites';
  scopeEl.className = allowed ? '' : 'muted';
  fillButton.disabled = !allowed;
  allowButton.hidden = allowed;
}

fillButton.addEventListener('click', async () => {
  statusEl.textContent = 'Filling…';
  const outcome: FillOutcome = await chrome.runtime.sendMessage({ type: 'fill' });

  if (!outcome?.ok) {
    statusEl.textContent =
      outcome?.reason === 'not-allowed'
        ? 'This site is not allowed.'
        : 'Could not run on this page.';
    return;
  }

  statusEl.textContent =
    outcome.filled === 0
      ? 'No recognisable fields found.'
      : `Filled ${outcome.filled} field${outcome.filled === 1 ? '' : 's'}.`;
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

  statusEl.textContent = `${hostname} allowed.`;
  await render();
});

optionsLink.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

void render();
