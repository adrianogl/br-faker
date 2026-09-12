import { generatePerson } from '@br-faker/core';

import { t } from './i18n.js';

import {
  FLOATING_DEFAULTS,
  FLOATING_SCRIPT_ID,
  type FloatingSettings,
} from './floating-button.js';
import { EMAIL_DEFAULTS, type EmailSettings, withEmailAlias } from './email.js';
import { type FieldOverride, overridesFor, upsertOverride } from './overrides.js';
import { DEFAULT_SETTINGS, type ScopeSettings, isAllowed, originPatternsFor } from './scope.js';

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

async function readSettings(): Promise<ScopeSettings & FloatingSettings & EmailSettings> {
  const stored = await chrome.storage.sync.get({
    ...DEFAULT_SETTINGS,
    ...FLOATING_DEFAULTS,
    ...EMAIL_DEFAULTS,
  });
  return stored as ScopeSettings & FloatingSettings & EmailSettings;
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

/**
 * Register or drop the content script that draws the floating button.
 *
 * It is the one thing here that runs without a gesture, so it is fenced twice:
 * the user has to turn it on, and the host permissions for the allowed sites
 * have to be granted. Losing either takes the script back off — a permission
 * revoked in Chrome's settings has to actually stop it.
 */
export interface FloatingState {
  registered: boolean;
  matches: string[];
  error?: string;
}

/**
 * Why the button is not on the page.
 *
 * Registration fails as a rejected promise — one pattern Chrome dislikes and
 * the whole call goes — and swallowing that leaves a switch that says "on" over
 * a page with no button. The options page reads this back.
 */
let floatingError: string | undefined;

async function syncFloatingButton(): Promise<void> {
  const settings = await readSettings();
  const origins = originPatternsFor(settings);
  const wanted =
    settings.floatingButton &&
    origins.length > 0 &&
    (await chrome.permissions.contains({ origins }));

  const [registered] = await chrome.scripting.getRegisteredContentScripts({
    ids: [FLOATING_SCRIPT_ID],
  });

  if (!wanted) {
    if (registered) await chrome.scripting.unregisterContentScripts({ ids: [FLOATING_SCRIPT_ID] });
    return;
  }

  const script: chrome.scripting.RegisteredContentScript = {
    id: FLOATING_SCRIPT_ID,
    js: ['floating.js'],
    matches: origins,
    runAt: 'document_idle',
    allFrames: false,
    persistAcrossSessions: true,
  };

  try {
    if (registered) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
    floatingError = undefined;
  } catch (error) {
    // A pattern Chrome rejects must not leave a half-registered script behind.
    floatingError = error instanceof Error ? error.message : String(error);
    await chrome.scripting.unregisterContentScripts({ ids: [FLOATING_SCRIPT_ID] }).catch(() => {});
    return;
  }

  await drawOnOpenTabs(origins);
}

/**
 * Registering only covers the next navigation, and the tab the user turned the
 * button on from is already open — waiting for a reload reads as "it did not
 * work". The script guards against running twice, so injecting here is safe
 * even where the registration has already fired.
 */
async function drawOnOpenTabs(origins: string[]): Promise<void> {
  const tabs = await chrome.tabs.query({ url: origins }).catch(() => []);

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      await chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: ['floating.js'] })
        .catch(() => undefined);
    }),
  );
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

  void syncFloatingButton();
});

chrome.runtime.onStartup.addListener(() => void syncFloatingButton());

// The allowed sites decide where the button may appear, so a change to them is
// a change to the script's matches.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if ('floatingButton' in changes || 'allowlist' in changes || 'enforce' in changes) {
    void syncFloatingButton();
  }
});

chrome.permissions.onAdded.addListener(() => void syncFloatingButton());
chrome.permissions.onRemoved.addListener(() => void syncFloatingButton());

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'fill-form' && tab) await runFill(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message?.type === 'floating-state') {
    void (async () => {
      const [registered] = await chrome.scripting.getRegisteredContentScripts({
        ids: [FLOATING_SCRIPT_ID],
      });

      sendResponse({
        registered: Boolean(registered),
        matches: registered?.matches ?? [],
        error: floatingError,
      } satisfies FloatingState);
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
      const [stored, { emailBase }] = await Promise.all([readOverrides(), readSettings()]);
      const overrides = overridesFor(message.url ?? '', stored);
      sendResponse({ person: withEmailAlias(generatePerson(), emailBase), overrides });
    })();

    return true;
  }

  // The floating button names its own tab rather than asking for the active
  // one: the click happened in that page, and `runFill` re-checks the
  // allowlist from there, so the button cannot reach a tab it does not sit on.
  if (message?.type === 'fill-here') {
    void (async () => {
      const tab = sender.tab && { ...sender.tab, url: sender.tab.url ?? sender.url };
      sendResponse(tab ? await runFill(tab) : { ok: false, reason: 'no-tab' });
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
