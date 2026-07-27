import { generatePerson } from '@br-faker/core';

import { t } from './i18n.js';

import { type FieldOverride, overridesFor, upsertOverride } from './overrides.js';
import { DEFAULT_SETTINGS, type ScopeSettings, isAllowed } from './scope.js';

/**
 * Service worker: the trigger layer.
 *
 * Three ways in — the keyboard shortcut, the toolbar popup and the context
 * menu — all funnel through `runFill`, so the allowlist check cannot be
 * bypassed by taking a different route.
 *
 * Nothing is injected until the user asks. `activeTab` grants access to the
 * current tab only, only for this gesture, which is why the extension needs no
 * standing host permissions.
 */

export interface FillOutcome {
  ok: boolean;
  reason?: 'not-allowed' | 'no-tab' | 'injection-failed';
  hostname?: string;
  filled?: number;
  skipped?: number;
}

async function readSettings(): Promise<ScopeSettings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return stored as ScopeSettings;
}

async function readOverrides(): Promise<FieldOverride[]> {
  const stored = await chrome.storage.sync.get({ overrides: [] });
  return (stored as { overrides: FieldOverride[] }).overrides;
}

/** Inject the filler into the tab and return what it managed to fill. */
async function runFill(tab: chrome.tabs.Tab): Promise<FillOutcome> {
  if (!tab.id || !tab.url) return { ok: false, reason: 'no-tab' };

  const settings = await readSettings();
  if (!isAllowed(tab.url, settings)) {
    return { ok: false, reason: 'not-allowed', hostname: new URL(tab.url).hostname };
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['content.js'],
    });

    const result = injection?.result as { filled: number; skipped: number } | undefined;
    return { ok: true, filled: result?.filled ?? 0, skipped: result?.skipped ?? 0 };
  } catch {
    return { ok: false, reason: 'injection-failed' };
  }
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-form') return;
  const tab = await activeTab();
  if (tab) await runFill(tab);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'fill-form',
    title: t('contextMenuFill'),
    contexts: ['editable', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'fill-form' && tab) await runFill(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // The content script asks for the data and the mappings that apply to its
  // URL. Generating here keeps faker out of the script injected into the page.
  // The popup asks for the picker; it is injected the same way the filler is,
  // on an explicit gesture and under activeTab.
  if (message?.type === 'start-picker') {
    void (async () => {
      const tab = await activeTab();
      if (!tab?.id) {
        sendResponse({ ok: false, reason: 'no-tab' });
        return;
      }

      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['picker.js'] });
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false, reason: 'injection-failed' });
      }
    })();

    return true;
  }

  if (message?.type === 'save-override') {
    void (async () => {
      const existing = await readOverrides();
      const overrides = upsertOverride(existing, message.override as FieldOverride);
      await chrome.storage.sync.set({ overrides });
      sendResponse({ ok: true, count: overrides.length });
    })();

    return true;
  }

  if (message?.type === 'payload') {
    void (async () => {
      const overrides = overridesFor(message.url ?? '', await readOverrides());
      sendResponse({ person: generatePerson(), overrides });
    })();

    return true;
  }

  // The popup drives the same path as the shortcut, so it sees the same
  // allowlist decision.
  if (message?.type === 'fill') {
    void (async () => {
      const tab = await activeTab();
      sendResponse(tab ? await runFill(tab) : { ok: false, reason: 'no-tab' });
    })();

    // Keeps the message channel open for the async reply above.
    return true;
  }

  return false;
});
