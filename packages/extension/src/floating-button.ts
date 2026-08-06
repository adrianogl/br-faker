/**
 * The button that sits on top of the page.
 *
 * Everything it draws lives in a shadow root, for the same reason the picker
 * does it: the page's CSS is arbitrary and would otherwise reach in and wreck
 * the button, and these styles would leak out into the page.
 *
 * The DOM work is here and the extension plumbing is in `floating.ts`, so this
 * half can be exercised against a plain document.
 */

export const FLOATING_HOST_ID = 'br-faker-floating-button';

/** Identifies the dynamically registered content script to the service worker. */
export const FLOATING_SCRIPT_ID = 'floating-button';

export interface FloatingSettings {
  floatingButton: boolean;
}

/**
 * Off until asked for: turning it on requests access to the allowed sites, and
 * a permission prompt has to be the answer to a deliberate click.
 */
export const FLOATING_DEFAULTS: FloatingSettings = { floatingButton: false };

export const BUTTON_SIZE = 44;

/**
 * Distances from the bottom-right corner rather than absolute coordinates, so
 * the button keeps its place when the window is resized.
 */
export interface Position {
  right: number;
  bottom: number;
}

export const DEFAULT_POSITION: Position = { right: 24, bottom: 24 };

export type PositionStore = Record<string, Position>;

export interface Viewport {
  width: number;
  height: number;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

/** Keep the button reachable: a drag must not park it outside the viewport. */
export function clampPosition(position: Position, viewport: Viewport): Position {
  return {
    right: clamp(position.right, viewport.width - BUTTON_SIZE),
    bottom: clamp(position.bottom, viewport.height - BUTTON_SIZE),
  };
}

export function positionFor(store: PositionStore, hostname: string): Position {
  const stored = store[hostname];
  if (!stored || !Number.isFinite(stored.right) || !Number.isFinite(stored.bottom)) {
    return DEFAULT_POSITION;
  }
  return stored;
}

export function withPosition(
  store: PositionStore,
  hostname: string,
  position: Position,
): PositionStore {
  return { ...store, [hostname]: position };
}

export interface FloatingButtonOptions {
  label: string;
  position: Position;
  onFill: () => void;
  onPick: () => void;
  onMove: (position: Position) => void;
}

export interface FloatingButton {
  destroy: () => void;
  setBusy: (busy: boolean) => void;
  showStatus: (message: string) => void;
}

/** A drag under this many pixels is a click that wobbled, not a move. */
const DRAG_THRESHOLD = 4;

const STATUS_WIDTH = 220;
const STATUS_GAP = 8;

/**
 * Which side the message opens on.
 *
 * It sits to the left of the button, where there is room for it in the corner
 * the button starts in. Dragged to the left edge, that room is gone and the
 * message would be cut off by the viewport, so it flips.
 */
export function statusSide(position: Position, viewport: Viewport): 'left' | 'right' {
  const spaceOnTheLeft = viewport.width - position.right - BUTTON_SIZE;
  return spaceOnTheLeft >= STATUS_WIDTH + STATUS_GAP ? 'left' : 'right';
}

const STYLE = `
  :host { all: initial; }
  .button {
    position: fixed;
    width: ${BUTTON_SIZE}px;
    height: ${BUTTON_SIZE}px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #007a2e;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.28);
    cursor: grab;
    touch-action: none;
    pointer-events: auto;
    transition: transform 120ms ease-out, box-shadow 120ms ease-out;
  }
  .button:hover { transform: scale(1.06); }
  .button:focus-visible { outline: 2px solid #1ab554; outline-offset: 3px; }
  .button[data-dragging='true'] { cursor: grabbing; transform: scale(1.06); }
  .button[data-busy='true'] { opacity: 0.65; cursor: progress; }
  .button svg { width: 30px; height: 30px; display: block; }
  .status {
    position: fixed;
    max-width: ${STATUS_WIDTH}px;
    padding: 6px 10px;
    border-radius: 8px;
    background: #0f172a;
    color: #fff;
    font: 12px/1.4 system-ui, sans-serif;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 140ms ease-out;
  }
  .status[data-visible='true'] { opacity: 1; }
`;

/**
 * The emblem, reduced the way the 16px toolbar icon is: diamond and card only.
 * The data rows and the arrow are what the artwork drops below 48px, and at
 * 30px inside a circle they collapse into a smudge here too.
 *
 * Inline rather than the packaged icon, so the button needs no web-accessible
 * resource — one less thing a page can probe the extension for.
 */
const EMBLEM = `
  <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <polygon points="50,3 97,50 50,97 3,50" fill="#ffdf00" />
    <rect x="26" y="33" width="48" height="34" rx="6" fill="#002776" />
  </svg>
`;

export function createFloatingButton(
  doc: Document,
  options: FloatingButtonOptions,
): FloatingButton {
  doc.getElementById(FLOATING_HOST_ID)?.remove();

  const host = doc.createElement('div');
  host.id = FLOATING_HOST_ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = STYLE;

  const button = doc.createElement('button');
  button.className = 'button';
  button.type = 'button';
  button.title = options.label;
  button.setAttribute('aria-label', options.label);
  button.innerHTML = EMBLEM;

  const status = doc.createElement('div');
  status.className = 'status';

  shadow.append(style, button, status);
  doc.documentElement.append(host);

  let position = options.position;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const place = () => {
    const viewport = {
      width: doc.defaultView?.innerWidth ?? 0,
      height: doc.defaultView?.innerHeight ?? 0,
    };
    position = clampPosition(position, viewport);
    button.style.right = `${position.right}px`;
    button.style.bottom = `${position.bottom}px`;

    const beside = position.right + BUTTON_SIZE + STATUS_GAP;
    if (statusSide(position, viewport) === 'left') {
      status.style.right = `${beside}px`;
      status.style.left = 'auto';
    } else {
      status.style.left = `${viewport.width - position.right + STATUS_GAP}px`;
      status.style.right = 'auto';
    }
    status.style.bottom = `${position.bottom + BUTTON_SIZE / 2 - 12}px`;
  };

  place();

  let origin: { x: number; y: number; position: Position } | null = null;
  let dragging = false;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    origin = { x: event.clientX, y: event.clientY, position };
    dragging = false;
    button.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!origin) return;

    const dx = origin.x - event.clientX;
    const dy = origin.y - event.clientY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    dragging = true;
    button.dataset.dragging = 'true';
    position = { right: origin.position.right + dx, bottom: origin.position.bottom + dy };
    place();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!origin) return;
    button.releasePointerCapture?.(event.pointerId);
    origin = null;

    if (!dragging) {
      options.onFill();
      return;
    }

    delete button.dataset.dragging;
    dragging = false;
    options.onMove(position);
  };

  // The page must not see the gesture: a button floating over a form sits on
  // top of the page's own click handlers.
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onContextMenu = (event: Event) => {
    swallow(event);
    options.onPick();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    options.onFill();
  };

  const onResize = () => place();

  button.addEventListener('pointerdown', onPointerDown);
  button.addEventListener('pointermove', onPointerMove);
  button.addEventListener('pointerup', onPointerUp);
  button.addEventListener('pointercancel', onPointerUp);
  button.addEventListener('click', swallow);
  button.addEventListener('contextmenu', onContextMenu);
  button.addEventListener('keydown', onKeyDown);
  doc.defaultView?.addEventListener('resize', onResize);

  return {
    destroy() {
      clearTimeout(statusTimer);
      doc.defaultView?.removeEventListener('resize', onResize);
      host.remove();
    },
    setBusy(busy: boolean) {
      if (busy) button.dataset.busy = 'true';
      else delete button.dataset.busy;
    },
    showStatus(message: string) {
      status.textContent = message;
      status.dataset.visible = 'true';
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        status.dataset.visible = 'false';
      }, 2200);
    },
  };
}
