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
  /** name, id, class and data attributes joined — developer-facing naming. */
  identifiers: string;
  /** Visible label, placeholder, aria-label and title — user-facing wording. */
  wording: string;
  type: string;
  maxLength: number;
  inputMode: string;
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
  { kind: 'company', pattern: /raz[aã]o.?social|nome.?fantasia|empresa|company|organiz/ },
  { kind: 'lastName', pattern: /sobrenome|last.?name|surname|\bapelido\b/ },
  { kind: 'firstName', pattern: /primeiro.?nome|first.?name|\bnome\b/, reject: /sobrenome|completo|usu[aá]rio|username|empresa|social|fantasia|cart[aã]o|m[aã]e|pai/ },
  {
    kind: 'fullName',
    pattern: /nome.?completo|full.?name|\bnome\b|\bname\b/,
    reject: /sobrenome|usu[aá]rio|username|empresa|social|fantasia|arquivo|file|m[aã]e|pai/,
  },

  { kind: 'email', pattern: /e-?mail/ },
  { kind: 'username', pattern: /usu[aá]rio|username|\buser\b|\blogin\b|apelido/ },
  { kind: 'password', pattern: /senha|password|\bpwd\b/ },

  // Phones: mobile and landline are separate generators, so tell them apart.
  { kind: 'mobile', pattern: /celular|whats|mobile|\bcel\b/ },
  { kind: 'landline', pattern: /telefone.?fixo|\bfixo\b|land.?line/ },
  { kind: 'mobile', pattern: /telefone|phone|\btel\b|contato/ },

  // Address.
  { kind: 'street', pattern: /logradouro|endere[cç]o|\brua\b|street|address/, reject: /n[uú]mero|complement|bairro|cidade|estado|email/ },
  { kind: 'city', pattern: /cidade|munic[ií]pio|city|localidade/ },
  { kind: 'stateCode', pattern: /\buf\b|estado|state/ },

  { kind: 'birthdate', pattern: /nascimento|birth|\bdob\b|anivers/ },
];

/** Type attributes that pin a field down on their own. */
const BY_TYPE: Record<string, FieldKind> = {
  email: 'email',
  password: 'password',
  tel: 'mobile',
};

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Collect every naming and wording clue attached to a control. */
export function readSignals(element: HTMLElement): FieldSignals {
  const input = element as HTMLInputElement;
  const identifiers = [
    input.getAttribute('name'),
    input.getAttribute('id'),
    input.getAttribute('class'),
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
    autocomplete: normalise(input.getAttribute('autocomplete') ?? ''),
    identifiers: normalise(identifiers),
    wording: normalise(wording),
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
