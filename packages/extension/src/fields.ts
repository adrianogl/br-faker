import type { Person } from '@br-faker/core';

/**
 * Field detection.
 *
 * Generating valid documents is solved; deciding *which* input is the CPF is
 * where this extension earns its keep. Detection reads every signal a form
 * gives away and scores them, because no single one is reliable: `autocomplete`
 * is authoritative but usually absent, `name` and `id` are developer shorthand,
 * and the visible label is often the only human-readable clue.
 */

/** A key of Person that can be written into a form control. */
export type FieldKind = keyof Person;

export interface FieldSignals {
  /** Value of the autocomplete attribute, lowercased. */
  autocomplete: string;
  /** name, id and data attributes joined — developer-facing naming. */
  identifiers: string;
  /** Visible label, placeholder, aria-label and title — user-facing wording. */
  wording: string;
  type: string;
  maxLength: number;
  inputMode: string;
  /**
   * The placeholder exactly as written. Kept raw alongside the tokenised
   * `wording` because a mask is punctuation, and tokenising would erase it.
   */
  mask: string;
}

export interface Detection {
  kind: FieldKind;
  score: number;
}

/**
 * Autocomplete tokens map straight onto a field. When a form bothers to set
 * these, they beat every heuristic below, so they score highest.
 */
const AUTOCOMPLETE: Record<string, FieldKind> = {
  name: 'fullName',
  'given-name': 'firstName',
  'family-name': 'lastName',
  email: 'email',
  username: 'username',
  'new-password': 'password',
  'current-password': 'password',
  organization: 'company',
  'street-address': 'street',
  'address-line1': 'street',
  'address-level2': 'city',
  'address-level1': 'stateCode',
  'postal-code': 'postalCode',
  tel: 'mobile',
  'tel-national': 'mobile',
  bday: 'birthdate',
};

/**
 * Ordered rules. The first matching rule wins within a tier, so the more
 * specific pattern must come first: `sobrenome` contains `nome`, and
 * `nome da empresa` is a company, not a person.
 */
interface Rule {
  kind: FieldKind;
  /** Matched against identifiers and wording. */
  pattern: RegExp;
  /** If this matches, the rule is rejected — guards the greedy patterns. */
  reject?: RegExp;
}

const RULES: Rule[] = [
  // Documents first: their tokens are unambiguous.
  { kind: 'cpf', pattern: /\bcpf\b/ },
  { kind: 'cnpj', pattern: /\bcnpj\b/ },
  { kind: 'postalCode', pattern: /\bcep\b|postal.?code|zip.?code|\bzip\b/ },

  // Names, most specific first.
  { kind: 'company', pattern: /raz[aã]o.?social|nome.?fantasia|empresa|\bcompany\b|organiza/ },
  { kind: 'lastName', pattern: /sobrenome|last.?name|\bsurname\b|\bapelido\b/ },
  { kind: 'firstName', pattern: /primeiro.?nome|first.?name|\bnome\b/, reject: /sobrenome|completo|usu[aá]rio|username|empresa|social|fantasia|cart[aã]o|m[aã]e|pai/ },
  {
    kind: 'fullName',
    pattern: /nome.?completo|full.?name|\bnome\b|\bname\b/,
    reject: /sobrenome|usu[aá]rio|username|empresa|social|fantasia|arquivo|file|m[aã]e|pai/,
  },

  { kind: 'email', pattern: /e.?mail/ },
  { kind: 'username', pattern: /usu[aá]rio|username|\buser\b|\blogin\b|apelido/ },
  { kind: 'password', pattern: /senha|\bpassword\b|\bpwd\b/ },

  // Phones: mobile and landline are separate generators, so tell them apart.
  { kind: 'mobile', pattern: /celular|whats|\bmobile\b|\bcel\b/ },
  { kind: 'landline', pattern: /telefone.?fixo|\bfixo\b|land.?line/ },
  { kind: 'mobile', pattern: /telefone|\bphone\b|\btel\b|contato/ },

  // Address.
  { kind: 'street', pattern: /logradouro|endere[cç]o|\brua\b|\bstreet\b|\baddress\b/, reject: /n[uú]mero|complement|bairro|cidade|estado|email/ },
  { kind: 'city', pattern: /cidade|munic[ií]pio|\bcity\b|localidade/ },
  { kind: 'stateCode', pattern: /\buf\b|estado|\bstate\b/ },

  { kind: 'birthdate', pattern: /nascimento|\bbirth\w*\b|\bdob\b|anivers/ },
];

/** Type attributes that pin a field down on their own. */
const BY_TYPE: Record<string, FieldKind> = {
  email: 'email',
  password: 'password',
  tel: 'mobile',
};

/**
 * Placeholders that spell out a mask, reduced to their shape.
 *
 * Brazilian forms put the mask in the placeholder far more reliably than they
 * put the field's name anywhere readable — a component library can hide the
 * label in a React prop, but `XX.XXX.XXX/XXXX-00` still has to reach the DOM
 * for the user to see it. Punctuation carries the meaning, so only the filler
 * characters are normalised.
 */
const MASK_SHAPES: Record<string, FieldKind> = {
  '##.###.###/####-##': 'cnpj',
  '###.###.###-##': 'cpf',
  '#####-###': 'postalCode',
  '(##) #####-####': 'mobile',
  '(##) ####-####': 'landline',
  '##/##/####': 'birthdate',
};

const DATE_PLACEHOLDER = /^(dd|d)[/.-](mm|m)[/.-](aaaa|yyyy|aa|yy)$/i;

/** Reduce a mask to punctuation plus `#`, leaving its shape comparable. */
function maskShape(placeholder: string): string {
  return placeholder.trim().replace(/[0-9xX#_9]/g, '#');
}

function detectByMask(placeholder: string): FieldKind | null {
  const raw = placeholder.trim();
  if (!raw) return null;
  if (DATE_PLACEHOLDER.test(raw)) return 'birthdate';
  return MASK_SHAPES[maskShape(raw)] ?? null;
}

/**
 * Fold a raw attribute into a space-separated bag of words.
 *
 * Tokenising matters more than it looks. `_` is a regex word character, so
 * `\bcpf\b` never fires on `cpf_cliente` \u2014 a name shape that is everywhere in
 * real forms. Splitting separators and camelCase into spaces first makes the
 * word boundaries in the rules mean what they read like they mean, so
 * `cpf_cliente`, `cpfTitular`, `campo-cpf` and `txtCPF` all land on the same
 * rule as a bare `cpf`.
 */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // camelCase and PascalCase carry the same words a reader sees, so split
    // them before folding case throws the boundary away.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Collect every naming and wording clue attached to a control. */
export function readSignals(element: HTMLElement): FieldSignals {
  const input = element as HTMLInputElement;
  // `class` is deliberately absent. Utility CSS is presentation, not meaning,
  // and it is a minefield of accidental substrings: `disabled:opacity-50`
  // contains "city", which is enough to read a date field as a city.
  const identifiers = [
    input.getAttribute('name'),
    input.getAttribute('id'),
    input.getAttribute('data-testid'),
    input.getAttribute('data-test'),
    input.getAttribute('formcontrolname'),
    input.getAttribute('ng-reflect-name'),
  ]
    .filter(Boolean)
    .join(' ');

  const wording = [
    labelFor(input),
    input.getAttribute('placeholder'),
    input.getAttribute('aria-label'),
    input.getAttribute('title'),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    // Not tokenised: these are standard tokens, and splitting them would turn
    // `given-name` into words that match no key. A section prefix is allowed
    // by the spec ("shipping postal-code"), so the last token is the one that
    // names the field.
    autocomplete: (input.getAttribute('autocomplete') ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .pop() ?? '',
    identifiers: normalise(identifiers),
    wording: normalise(wording),
    mask: input.getAttribute('placeholder') ?? '',
    type: (input.getAttribute('type') ?? 'text').toLowerCase(),
    maxLength: Number(input.getAttribute('maxlength') ?? -1),
    inputMode: normalise(input.getAttribute('inputmode') ?? ''),
  };
}

/** The visible label: an explicit `for=`, a wrapping label, or aria-labelledby. */
function labelFor(input: HTMLElement): string {
  const id = input.getAttribute('id');
  const doc = input.ownerDocument;

  if (id) {
    // Compared attribute by attribute rather than built into a selector: ids in
    // the wild contain characters that need escaping, and CSS.escape is not
    // available everywhere this runs.
    for (const label of Array.from(doc.querySelectorAll('label[for]'))) {
      if (label.getAttribute('for') === id && label.textContent) return label.textContent;
    }
  }

  const wrapping = input.closest('label');
  if (wrapping?.textContent) return wrapping.textContent;

  const describedBy = input.getAttribute('aria-labelledby');
  if (describedBy) {
    const target = doc.getElementById(describedBy);
    if (target?.textContent) return target.textContent;
  }

  return siblingLabel(input);
}

/**
 * The label that sits beside the control rather than pointing at it.
 *
 * Component libraries in the shadcn/ui mould render
 * `<div><label>CNPJ</label><div><input/></div></div>` — a real `<label>`, with
 * no `for`, that never wraps the input. Nothing links the two, so the only
 * readable name for the field is invisible to the association rules above.
 *
 * Walking up while the ancestor still holds exactly one control is what keeps
 * this honest: the moment a container covers a second field, its labels could
 * belong to either, and guessing there would be worse than reading nothing.
 */
function siblingLabel(input: HTMLElement): string {
  let node = input.parentElement;

  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    if (node.querySelectorAll('input, textarea, select').length !== 1) break;

    // Document order puts the field's own label before any error message the
    // container renders afterwards.
    const label = node.querySelector('label');
    if (label?.textContent?.trim()) return label.textContent;
  }

  return '';
}

/**
 * Score a control against every field kind and return the best guess, or null
 * when nothing matches confidently.
 *
 * Scores are tiers rather than a tuned scale: an autocomplete token is worth
 * more than any name match, a name match more than a placeholder, and the
 * length hint only ever breaks a tie.
 */
export function detect(signals: FieldSignals): Detection | null {
  const fromAutocomplete = AUTOCOMPLETE[signals.autocomplete];
  if (fromAutocomplete) return { kind: fromAutocomplete, score: 100 };

  for (const rule of RULES) {
    const inIdentifiers = rule.pattern.test(signals.identifiers);
    const inWording = rule.pattern.test(signals.wording);
    if (!inIdentifiers && !inWording) continue;

    const haystack = `${signals.identifiers} ${signals.wording}`;
    if (rule.reject?.test(haystack)) continue;

    return { kind: rule.kind, score: inIdentifiers ? 60 : 40 };
  }

  // A mask shape is strong evidence — stronger than the input type, which only
  // ever narrows things down a little.
  const fromMask = detectByMask(signals.mask);
  if (fromMask) return { kind: fromMask, score: 50 };

  const fromType = BY_TYPE[signals.type];
  if (fromType) return { kind: fromType, score: 30 };

  // A digits-only field capped at exactly a document's masked length is a
  // last-resort hint, used only when naming gave nothing away.
  if (signals.inputMode === 'numeric' || signals.type === 'tel') {
    if (signals.maxLength === 14) return { kind: 'cpf', score: 15 };
    if (signals.maxLength === 18) return { kind: 'cnpj', score: 15 };
    if (signals.maxLength === 9) return { kind: 'postalCode', score: 15 };
  }

  return null;
}
