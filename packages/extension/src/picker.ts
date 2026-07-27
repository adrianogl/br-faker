import { initI18n, t } from './i18n.js';
import { OVERRIDE_TARGETS, defaultPatternFor, suggestSelector } from './overrides.js';
import type { FieldKind } from './fields.js';

/**
 * Point-and-click field mapping.
 *
 * Writing a CSS selector by hand is the worst part of manual mapping: you have
 * to open the console, find the control, and get the syntax right. Here you
 * hover the field, click it, and pick what it holds.
 *
 * Everything the picker draws lives in a shadow root. The page's own CSS is
 * arbitrary and would otherwise reach in and wreck the menu, and the picker's
 * styles would leak out into the page being inspected.
 */

/** Field names come from the message catalogue, like every other label. */
const fieldLabel = (kind: FieldKind | 'skip') => t(`field_${kind}`);

const HOST_ID = 'br-faker-picker';

/** Already running: a second invocation should close it rather than stack. */
if (document.getElementById(HOST_ID)) {
  document.getElementById(HOST_ID)?.remove();
} else {
  void initI18n().then(startPicker);
}

function startPicker(): void {
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      .outline {
        position: fixed;
        border: 2px solid #007a2e;
        border-radius: 4px;
        background: rgba(0, 122, 46, 0.08);
        pointer-events: none;
        transition: all 60ms ease-out;
      }
      .hint {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        border-radius: 8px;
        background: #0f172a;
        color: #fff;
        font: 13px/1.4 system-ui, sans-serif;
        pointer-events: none;
      }
      .menu {
        position: fixed;
        max-height: 300px;
        overflow-y: auto;
        padding: 4px;
        border-radius: 10px;
        background: #fff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
        font: 13px system-ui, sans-serif;
        pointer-events: auto;
      }
      .menu button {
        display: block;
        width: 100%;
        padding: 7px 12px;
        text-align: left;
        font: inherit;
        color: #0f172a;
        background: none;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .menu button:hover { background: #f1f5f9; }
      .menu .selector {
        padding: 6px 12px 8px;
        color: #64748b;
        font: 11px ui-monospace, Menlo, monospace;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 4px;
        max-width: 260px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    </style>
    <div class="outline" hidden></div>
    <div class="hint"></div>
  `;

  document.documentElement.append(host);

  const outline = shadow.querySelector('.outline') as HTMLElement;
  const hint = shadow.querySelector('.hint') as HTMLElement;
  hint.textContent = t('pickerHint');
  let menu: HTMLElement | null = null;

  const controlAt = (event: MouseEvent): Element | null => {
    // The host covers the viewport, so ask the page what is underneath it.
    const target = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((element) => element.matches('input, textarea, select') && element.closest('body'));
    return target ?? null;
  };

  const highlight = (element: Element | null) => {
    if (!element || menu) {
      outline.hidden = true;
      return;
    }
    const box = element.getBoundingClientRect();
    outline.hidden = false;
    outline.style.top = `${box.top - 2}px`;
    outline.style.left = `${box.left - 2}px`;
    outline.style.width = `${box.width}px`;
    outline.style.height = `${box.height}px`;
  };

  const close = () => {
    host.remove();
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
  };

  function onMove(event: MouseEvent) {
    highlight(controlAt(event));
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function onClick(event: MouseEvent) {
    // A click inside the menu is the user choosing, not picking another field.
    if (menu && event.composedPath().includes(menu)) return;

    const control = controlAt(event);
    if (!control) return;

    // The page must not react: this click is for us, not for the form.
    event.preventDefault();
    event.stopPropagation();

    openMenu(control, event.clientX, event.clientY);
  }

  function openMenu(control: Element, x: number, y: number) {
    menu?.remove();
    outline.hidden = true;

    const selector = suggestSelector(control);
    menu = document.createElement('div');
    menu.className = 'menu';
    menu.style.left = `${Math.min(x, window.innerWidth - 280)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 320)}px`;

    const caption = document.createElement('div');
    caption.className = 'selector';
    caption.textContent = selector;
    menu.append(caption);

    for (const kind of OVERRIDE_TARGETS) {
      const button = document.createElement('button');
      button.textContent = fieldLabel(kind);
      button.addEventListener('click', () => {
        void save(selector, kind);
      });
      menu.append(button);
    }

    shadow.append(menu);
  }

  async function save(selector: string, kind: FieldKind | 'skip') {
    await chrome.runtime.sendMessage({
      type: 'save-override',
      override: { url: defaultPatternFor(location.href), selector, kind },
    });

    hint.textContent = t('pickerMapped', fieldLabel(kind));
    menu?.remove();
    menu = null;
    setTimeout(close, 900);
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
}
