import { generatePerson } from '@br-faker/core';

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
    title: 'Fill this form with fake data',
    contexts: ['editable', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'fill-form' && tab) await runFill(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // The content script asks for the data. Generating here keeps faker out of
  // the script injected into the page.
  if (message?.type === 'person') {
    sendResponse(generatePerson());
    return false;
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
