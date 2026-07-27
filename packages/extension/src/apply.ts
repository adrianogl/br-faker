/**
 * Writing values into form controls.
 *
 * Assigning `element.value` is not enough on a modern page. React tracks the
 * value on its own node and its onChange never fires for a plain assignment, so
 * the field looks filled but the app's state stays empty and validation fails
 * on submit. The fix is to call the *native* value setter from the prototype —
 * bypassing React's override — and then dispatch bubbling input and change
 * events, which is what a real keystroke produces.
 */

export type Fillable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Digits and letters only, for comparing what we asked for with what stuck. */
function canonical(value: string): string {
  return value.replace(/[^0-9a-z]/gi, '').toLowerCase();
}

function nativeSetter(element: HTMLInputElement | HTMLTextAreaElement) {
  const prototype =
    element instanceof element.ownerDocument.defaultView!.HTMLTextAreaElement
      ? element.ownerDocument.defaultView!.HTMLTextAreaElement.prototype
      : element.ownerDocument.defaultView!.HTMLInputElement.prototype;

  return Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
}

function notify(element: Fillable): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function write(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = nativeSetter(element);
  if (setter) setter.call(element, value);
  else element.value = value;
  notify(element);
}

/** Pick the option whose value or text matches, for `<select>` fields. */
function selectOption(element: HTMLSelectElement, value: string): boolean {
  const wanted = canonical(value);

  for (const option of Array.from(element.options)) {
    if (canonical(option.value) === wanted || canonical(option.textContent ?? '') === wanted) {
      element.value = option.value;
      notify(element);
      return true;
    }
  }

  return false;
}

export interface FillResult {
  filled: boolean;
  /** Which of the candidate values the control actually accepted. */
  used?: string;
}

/**
 * Fill one control, trying the formatted value first and the unmasked one as a
 * second attempt.
 *
 * Masked inputs are the reason for the retry. A field driven by a mask library
 * may reformat, truncate or reject what it is handed; after writing we compare
 * the alphanumerics that landed with what we asked for, and if they disagree we
 * try the raw digits, which most masks accept and format themselves.
 */
export function fillField(element: Fillable, formatted: string, raw?: string): FillResult {
  element.focus();

  if (element instanceof element.ownerDocument.defaultView!.HTMLSelectElement) {
    const select = element as HTMLSelectElement;
    const filled = selectOption(select, formatted) || (raw ? selectOption(select, raw) : false);
    element.blur();
    return filled ? { filled: true, used: select.value } : { filled: false };
  }

  const input = element as HTMLInputElement | HTMLTextAreaElement;
  const candidates = raw && raw !== formatted ? [formatted, raw] : [formatted];

  for (const candidate of candidates) {
    write(input, candidate);
    if (canonical(input.value) === canonical(candidate)) {
      input.blur();
      return { filled: true, used: input.value };
    }
  }

  // Nothing matched cleanly. Whatever the last attempt left behind is still
  // better than an empty field, so report it rather than silently claiming
  // success.
  const landed = input.value;
  input.blur();
  return landed ? { filled: true, used: landed } : { filled: false };
}

/**
 * Why a control cannot be typed into, or `null` when it can.
 *
 * Returns the reason rather than a bare boolean so the console can account for
 * every control on the page. A field that is silently dropped is the worst
 * possible outcome when something does not fill: it appears in neither the
 * filled nor the unrecognised list, and there is nothing to debug from.
 */
export function fillabilityProblem(element: Element): string | null {
  const view = element.ownerDocument.defaultView;
  if (!view) return 'detached from any window';

  const isControl =
    element instanceof view.HTMLInputElement ||
    element instanceof view.HTMLTextAreaElement ||
    element instanceof view.HTMLSelectElement;
  if (!isControl) return 'not a form control';

  const control = element as Fillable;
  if (control.disabled) return 'disabled';
  if ((control as HTMLInputElement).readOnly) return 'readonly';

  if (control instanceof view.HTMLInputElement) {
    const untypable = ['hidden', 'submit', 'button', 'reset', 'file', 'image', 'range', 'color'];
    if (untypable.includes(control.type)) return `type="${control.type}"`;
  }

  const hiddenBy = hiddenReason(control);
  if (hiddenBy) return hiddenBy;

  return null;
}

/** Controls a user could type into: visible, enabled and not already set. */
export function isFillable(element: Element): element is Fillable {
  return fillabilityProblem(element) === null;
}

/**
 * Visibility by computed style, walking ancestors.
 *
 * Deliberately not `offsetParent` or `getBoundingClientRect`: both depend on
 * layout, which makes the check untestable outside a real browser and reports
 * position:fixed elements as hidden. Style covers what actually matters for a
 * form — a field inside a collapsed accordion or an inactive tab panel — and
 * behaves the same under jsdom as it does in Chrome. `display: none` does not
 * inherit into a child's computed style, so the ancestors have to be walked.
 */
function hiddenReason(element: Element): string | null {
  const view = element.ownerDocument.defaultView;
  if (!view) return 'detached from any window';

  for (let node: Element | null = element; node; node = node.parentElement) {
    const where = node === element ? 'itself' : `<${node.tagName.toLowerCase()}> ancestor`;

    if (node.hasAttribute('hidden')) return `hidden attribute on ${where}`;

    const style = view.getComputedStyle(node);
    if (style.display === 'none') return `display:none on ${where}`;
    if (style.visibility === 'hidden') return `visibility:hidden on ${where}`;
  }

  return null;
}
