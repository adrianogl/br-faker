import { DEFAULT_SETTINGS, type ScopeSettings } from './scope.js';

const listEl = document.getElementById('allowlist') as HTMLTextAreaElement;
const enforceEl = document.getElementById('enforce') as HTMLInputElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const savedEl = document.getElementById('saved') as HTMLElement;

async function load(): Promise<void> {
  const settings = (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as ScopeSettings;
  listEl.value = settings.allowlist.join('\n');
  enforceEl.checked = settings.enforce;
}

saveButton.addEventListener('click', async () => {
  const allowlist = listEl.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  await chrome.storage.sync.set({ allowlist, enforce: enforceEl.checked } satisfies ScopeSettings);

  savedEl.textContent = 'Saved';
  setTimeout(() => (savedEl.textContent = ''), 1500);
});

void load();
