import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BUTTON_SIZE,
  DEFAULT_POSITION,
  FLOATING_DEFAULTS,
  FLOATING_HOST_ID,
  type Position,
  clampPosition,
  createFloatingButton,
  positionFor,
  statusSide,
  withPosition,
} from '../src/floating-button.js';

function mount(overrides: Partial<Parameters<typeof createFloatingButton>[1]> = {}) {
  const calls = { fill: 0, pick: 0, moved: [] as Position[] };

  const button = createFloatingButton(document, {
    label: 'Preencher',
    position: DEFAULT_POSITION,
    onFill: () => calls.fill++,
    onPick: () => calls.pick++,
    onMove: (position) => calls.moved.push(position),
    ...overrides,
  });

  const host = document.getElementById(FLOATING_HOST_ID)!;
  const element = host.shadowRoot!.querySelector('button')!;
  return { button, element, host, calls };
}

function pointer(element: Element, type: string, x: number, y: number): void {
  element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

afterEach(() => {
  document.getElementById(FLOATING_HOST_ID)?.remove();
  document.body.innerHTML = '';
});

describe('the button stays reachable', () => {
  it('keeps a position that fits inside the viewport', () => {
    expect(clampPosition({ right: 24, bottom: 24 }, { width: 800, height: 600 })).toEqual({
      right: 24,
      bottom: 24,
    });
  });

  it('pulls a drag that left the viewport back to the edge', () => {
    // Dragged past the top-left: without this the button lands off-screen and
    // there is no way to get it back.
    expect(clampPosition({ right: 5000, bottom: -80 }, { width: 800, height: 600 })).toEqual({
      right: 800 - BUTTON_SIZE,
      bottom: 0,
    });
  });

  it('survives a viewport smaller than the button', () => {
    expect(clampPosition({ right: 24, bottom: 24 }, { width: 20, height: 20 })).toEqual({
      right: 0,
      bottom: 0,
    });
  });
});

describe('where the message opens', () => {
  it('opens to the left, where the corner has room', () => {
    expect(statusSide(DEFAULT_POSITION, { width: 1280, height: 800 })).toBe('left');
  });

  it('flips when the button was dragged to the left edge', () => {
    // Otherwise the message runs off the viewport and cannot be read.
    expect(statusSide({ right: 1200, bottom: 24 }, { width: 1280, height: 800 })).toBe('right');
  });

  it('flips on a window too narrow for the message beside the button', () => {
    expect(statusSide(DEFAULT_POSITION, { width: 260, height: 600 })).toBe('right');
  });
});

describe('the saved position', () => {
  it('falls back to the default corner for an unknown host', () => {
    expect(positionFor({}, 'localhost')).toEqual(DEFAULT_POSITION);
  });

  it('returns what was stored for that host', () => {
    const store = withPosition({}, 'localhost', { right: 100, bottom: 200 });
    expect(positionFor(store, 'localhost')).toEqual({ right: 100, bottom: 200 });
    expect(positionFor(store, 'outro.test')).toEqual(DEFAULT_POSITION);
  });

  it('keeps the other hosts when one moves', () => {
    const store = withPosition(withPosition({}, 'a.test', { right: 1, bottom: 2 }), 'b.test', {
      right: 3,
      bottom: 4,
    });

    expect(Object.keys(store).sort()).toEqual(['a.test', 'b.test']);
  });

  it('ignores a stored entry that is not a pair of numbers', () => {
    const corrupt = { localhost: { right: Number.NaN, bottom: 10 } };
    expect(positionFor(corrupt, 'localhost')).toEqual(DEFAULT_POSITION);
  });
});

describe('clicking versus dragging', () => {
  it('fills on a click that did not move', () => {
    const { element, calls } = mount();

    pointer(element, 'pointerdown', 500, 500);
    pointer(element, 'pointerup', 500, 500);

    expect(calls.fill).toBe(1);
    expect(calls.moved).toEqual([]);
  });

  it('treats a wobble under the threshold as a click', () => {
    const { element, calls } = mount();

    pointer(element, 'pointerdown', 500, 500);
    pointer(element, 'pointermove', 502, 501);
    pointer(element, 'pointerup', 502, 501);

    expect(calls.fill).toBe(1);
  });

  it('moves instead of filling once the drag is real', () => {
    const { element, calls } = mount();

    pointer(element, 'pointerdown', 500, 500);
    pointer(element, 'pointermove', 460, 400);
    pointer(element, 'pointerup', 460, 400);

    expect(calls.fill).toBe(0);
    // Dragging left and up increases the distance from the right and bottom
    // edges, which is how the position is stored.
    expect(calls.moved).toEqual([{ right: 64, bottom: 124 }]);
  });

  it('reports the position it actually painted, not the raw drag', () => {
    const { element, calls } = mount();

    pointer(element, 'pointerdown', 500, 500);
    pointer(element, 'pointermove', -5000, -5000);
    pointer(element, 'pointerup', -5000, -5000);

    const [moved] = calls.moved;
    expect(moved).toEqual(clampPosition(moved!, { width: window.innerWidth, height: window.innerHeight }));
  });

  it('does not fill again when a second click follows a drag', () => {
    const { element, calls } = mount();

    pointer(element, 'pointerdown', 500, 500);
    pointer(element, 'pointermove', 400, 400);
    pointer(element, 'pointerup', 400, 400);
    pointer(element, 'pointerdown', 400, 400);
    pointer(element, 'pointerup', 400, 400);

    expect(calls.fill).toBe(1);
  });

  it('ignores a pointerup that never had a pointerdown', () => {
    const { element, calls } = mount();

    pointer(element, 'pointerup', 500, 500);
    expect(calls.fill).toBe(0);
  });
});

describe('the button on someone else’s page', () => {
  it('keeps its own clicks away from the page underneath', () => {
    const { element } = mount();

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it('opens the picker on right-click without showing the page menu', () => {
    const { element, calls } = mount();

    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(menu);

    expect(calls.pick).toBe(1);
    expect(menu.defaultPrevented).toBe(true);
  });

  it('draws everything inside a shadow root, out of reach of the page CSS', () => {
    const { host } = mount();

    expect(host.shadowRoot).not.toBeNull();
    expect(host.querySelector('button')).toBeNull();
  });

  it('replaces itself rather than stacking a second button', () => {
    mount();
    mount();

    expect(document.querySelectorAll(`#${FLOATING_HOST_ID}`)).toHaveLength(1);
  });

  it('leaves nothing behind when destroyed', () => {
    const { button } = mount();
    button.destroy();

    expect(document.getElementById(FLOATING_HOST_ID)).toBeNull();
  });
});

describe('feedback', () => {
  it('fills the keyboard path too', () => {
    const { element, calls } = mount();

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(calls.fill).toBe(2);
  });

  it('shows a message and hides it again', () => {
    vi.useFakeTimers();
    const { button, host } = mount();
    const status = host.shadowRoot!.querySelector('.status') as HTMLElement;

    button.showStatus('8 campo(s) preenchido(s).');
    expect(status.textContent).toBe('8 campo(s) preenchido(s).');
    expect(status.dataset.visible).toBe('true');

    vi.advanceTimersByTime(2500);
    expect(status.dataset.visible).toBe('false');
    vi.useRealTimers();
  });

  it('marks itself busy while a fill is running', () => {
    const { button, element } = mount();

    button.setBusy(true);
    expect(element.dataset.busy).toBe('true');
    button.setBusy(false);
    expect(element.dataset.busy).toBeUndefined();
  });

  it('carries the label as the accessible name', () => {
    const { element } = mount({ label: 'Preencher o formulário' });

    expect(element.getAttribute('aria-label')).toBe('Preencher o formulário');
    expect(element.title).toBe('Preencher o formulário');
  });
});

describe('turning it on is a deliberate act', () => {
  it('ships off, because switching it on asks for host access', () => {
    expect(FLOATING_DEFAULTS.floatingButton).toBe(false);
  });
});
