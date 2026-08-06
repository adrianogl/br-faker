import type { FillOutcome } from './background.js';
import {
  FLOATING_DEFAULTS,
  type FloatingButton,
  type FloatingSettings,
  type Position,
  type PositionStore,
  createFloatingButton,
  positionFor,
  withPosition,
} from './floating-button.js';
import { initI18n, t } from './i18n.js';
import { DEFAULT_SETTINGS, type ScopeSettings, isAllowed } from './scope.js';

/**
 * Registered by the service worker for the allowed sites only, and only once
 * the user has turned the button on and granted access to those sites.
 *
 * The button does not fill anything itself: it asks the service worker, which
 * runs the same `runFill` the shortcut and the popup go through, so the
 * allowlist decision is made in one place no matter which route was taken.
 */

type Settings = ScopeSettings & FloatingSettings;

/** Changing any of these can make the button appear, vanish or change its label. */
const WATCHED_KEYS = ['floatingButton', 'allowlist', 'enforce', 'language'];

let button: FloatingButton | null = null;

async function readSettings(): Promise<Settings> {
  return (await chrome.storage.sync.get({ ...DEFAULT_SETTINGS, ...FLOATING_DEFAULTS })) as Settings;
}

async function readPositions(): Promise<PositionStore> {
  const stored = (await chrome.storage.local.get({ floatingPosition: {} })) as {
    floatingPosition: PositionStore;
  };
  return stored.floatingPosition;
}

/**
 * Per hostname, in local storage: where the button has to sit to stay out of
 * the way is a property of the page it covers, and it is not worth syncing
 * across machines with different screens.
 */
async function savePosition(position: Position): Promise<void> {
  const positions = await readPositions();
  await chrome.storage.local.set({
    floatingPosition: withPosition(positions, location.hostname, position),
  });
}

async function fill(): Promise<void> {
  button?.setBusy(true);
  const outcome: FillOutcome | undefined = await chrome.runtime.sendMessage({ type: 'fill-here' });
  button?.setBusy(false);

  if (!outcome?.ok) {
    button?.showStatus(t(outcome?.reason === 'not-allowed' ? 'popupNotAllowed' : 'popupCannotRun'));
    return;
  }

  button?.showStatus(
    outcome.filled === 0 ? t('popupNoFields') : t('popupFilled', String(outcome.filled)),
  );
}

async function mount(): Promise<void> {
  const positions = await readPositions();

  button = createFloatingButton(document, {
    label: t('floatingLabel'),
    position: positionFor(positions, location.hostname),
    onFill: () => void fill(),
    onPick: () => void chrome.runtime.sendMessage({ type: 'start-picker' }),
    onMove: (position) => void savePosition(position),
  });
}

async function sync(): Promise<void> {
  const settings = await readSettings();
  const wanted = settings.floatingButton && isAllowed(location.href, settings);

  if (wanted && !button) {
    await mount();
    return;
  }

  if (!wanted && button) {
    button.destroy();
    button = null;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !WATCHED_KEYS.some((key) => key in changes)) return;

  // Rebuilt rather than patched: the label comes from the catalogue, and the
  // language is one of the settings being watched.
  void (async () => {
    await initI18n();
    button?.destroy();
    button = null;
    await sync();
  })();
});

void (async () => {
  await initI18n();
  await sync();
})();
