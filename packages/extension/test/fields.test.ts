import { describe, expect, it } from 'vitest';

import { type FieldKind, detect, readSignals } from '../src/fields.js';

/** Build a form from HTML and detect the field kind of its only control. */
function kindOf(html: string): FieldKind | null {
  document.body.innerHTML = html;
  const input = document.querySelector('input, select, textarea');
  if (!input) throw new Error('fixture has no control');
  return detect(readSignals(input as HTMLElement))?.kind ?? null;
}

describe('autocomplete wins over everything', () => {
  it('reads the standard tokens', () => {
    expect(kindOf('<input autocomplete="given-name" name="xyz">')).toBe('firstName');
    expect(kindOf('<input autocomplete="postal-code" name="xyz">')).toBe('postalCode');
    expect(kindOf('<input autocomplete="organization" name="nome">')).toBe('company');
  });
});

describe('documents', () => {
  it('finds cpf and cnpj by name', () => {
    expect(kindOf('<input name="cpf">')).toBe('cpf');
    expect(kindOf('<input name="cnpj">')).toBe('cnpj');
    expect(kindOf('<input name="documento" placeholder="CPF">')).toBe('cpf');
  });

  it('finds cep by any of its spellings', () => {
    expect(kindOf('<input name="cep">')).toBe('postalCode');
    expect(kindOf('<input name="zipcode">')).toBe('postalCode');
    expect(kindOf('<input id="x"><label for="x">CEP</label>')).toBe('postalCode');
  });

  it('falls back to the mask length only when naming says nothing', () => {
    expect(kindOf('<input name="doc1" inputmode="numeric" maxlength="14">')).toBe('cpf');
    expect(kindOf('<input name="doc2" inputmode="numeric" maxlength="18">')).toBe('cnpj');
  });
});

describe('names are the ambiguous case', () => {
  it('separates first name, last name and full name', () => {
    expect(kindOf('<input name="sobrenome">')).toBe('lastName');
    expect(kindOf('<input name="primeiro_nome">')).toBe('firstName');
    expect(kindOf('<input name="nome_completo">')).toBe('fullName');
  });

  it('does not mistake a username for a person name', () => {
    expect(kindOf('<input name="nome_de_usuario">')).toBe('username');
    expect(kindOf('<input name="username">')).toBe('username');
  });

  it('does not mistake a company name for a person name', () => {
    expect(kindOf('<input name="nome_da_empresa">')).toBe('company');
    expect(kindOf('<input name="razao_social">')).toBe('company');
  });

  it('reads a label when the control has no useful name', () => {
    expect(kindOf('<label>Nome completo <input name="f1"></label>')).toBe('fullName');
  });

  it('handles accents in labels', () => {
    expect(kindOf('<label>Endereço <input name="f2"></label>')).toBe('street');
  });
});

describe('phones', () => {
  it('tells mobile from landline', () => {
    expect(kindOf('<input name="celular">')).toBe('mobile');
    expect(kindOf('<input name="whatsapp">')).toBe('mobile');
    expect(kindOf('<input name="telefone_fixo">')).toBe('landline');
  });

  it('treats a bare telephone field as mobile', () => {
    expect(kindOf('<input name="telefone">')).toBe('mobile');
  });
});

describe('type attribute as a last resort', () => {
  it('uses it when nothing else matches', () => {
    expect(kindOf('<input type="email" name="q1">')).toBe('email');
    expect(kindOf('<input type="password" name="q2">')).toBe('password');
  });
});

describe('non-matches', () => {
  it('returns null for a field it cannot place', () => {
    expect(kindOf('<input name="quantidade">')).toBeNull();
    expect(kindOf('<input name="cupom_desconto">')).toBeNull();
  });
});

describe('field names are rarely a bare word', () => {
  // `_` is a regex word character, so `\bcpf\b` silently failed to match
  // `cpf_cliente` until identifiers were tokenised. These are the shapes real
  // Brazilian forms use.
  it('finds the token inside snake_case', () => {
    expect(kindOf('<input name="cpf_cliente">')).toBe('cpf');
    expect(kindOf('<input name="campo_cpf">')).toBe('cpf');
    expect(kindOf('<input name="cnpj_empresa_matriz">')).toBe('cnpj');
  });

  it('finds the token inside kebab-case', () => {
    expect(kindOf('<input name="cpf-titular">')).toBe('cpf');
    expect(kindOf('<input id="input-cep">')).toBe('postalCode');
  });

  it('splits camelCase and PascalCase', () => {
    expect(kindOf('<input name="cpfTitular">')).toBe('cpf');
    expect(kindOf('<input name="txtCPF">')).toBe('cpf');
    expect(kindOf('<input name="CepEntrega">')).toBe('postalCode');
  });

  it('still separates the ambiguous names once tokenised', () => {
    // Tokenising makes `\bnome\b` match inside `nome_de_usuario`, so the
    // reject lists are what keep these apart now.
    expect(kindOf('<input name="nome_de_usuario">')).toBe('username');
    expect(kindOf('<input name="nome_da_empresa">')).toBe('company');
    expect(kindOf('<input name="nome_completo">')).toBe('fullName');
    expect(kindOf('<input name="nome_do_titular">')).toBe('firstName');
  });

  it('reads a hyphenated e-mail label', () => {
    expect(kindOf('<label>E-mail <input name="q"></label>')).toBe('email');
  });
});

describe('autocomplete is a standard token, not free text', () => {
  it('survives tokenisation of the other attributes', () => {
    expect(kindOf('<input autocomplete="family-name" name="x">')).toBe('lastName');
  });

  it('accepts the section prefix the spec allows', () => {
    expect(kindOf('<input autocomplete="shipping postal-code" name="x">')).toBe('postalCode');
  });
});

describe('framework naming conventions', () => {
  it('reads Angular formControlName and test ids', () => {
    expect(kindOf('<input formcontrolname="cpf">')).toBe('cpf');
    expect(kindOf('<input data-testid="input-cep">')).toBe('postalCode');
  });
});

describe('labels that sit beside the control, not linked to it', () => {
  // The shadcn/ui shape: a real <label> with no `for`, rendered as a sibling of
  // the wrapper that holds the input. Nothing associates them, so the field's
  // only readable name used to be invisible.
  const formItem = (label: string, input: string) =>
    `<div class="flex flex-col gap-1.5">
       <label class="text-sm font-semibold">${label}<span> (Obrigatório)</span></label>
       <div>${input}</div>
     </div>`;

  it('reads the sibling label', () => {
    expect(kindOf(formItem('CNPJ', '<input name="documento">'))).toBe('cnpj');
    expect(kindOf(formItem('Cidade', '<input name="f1">'))).toBe('city');
    expect(kindOf(formItem('Nome completo', '<input name="f2">'))).toBe('fullName');
  });

  it('refuses to guess when the container holds more than one control', () => {
    document.body.innerHTML = `
      <div>
        <label>CNPJ</label>
        <div><input name="a"><input name="b"></div>
      </div>`;
    const first = document.querySelector('input')!;
    // Two controls under one label: it could belong to either, so reading
    // nothing beats attaching it to the wrong one.
    expect(detect(readSignals(first))).toBeNull();
  });

  it('prefers an explicitly associated label over a sibling', () => {
    document.body.innerHTML = `
      <div>
        <label>Cidade</label>
        <div><label for="real">CPF</label><input id="real"></div>
      </div>`;
    expect(detect(readSignals(document.getElementById('real')!))?.kind).toBe('cpf');
  });
});

describe('mask shapes in the placeholder', () => {
  // A component library can hide the label in a prop, but the mask still has to
  // reach the DOM for the user to see it.
  it('recognises the Brazilian document masks', () => {
    expect(kindOf('<input name="a" placeholder="XX.XXX.XXX/XXXX-00">')).toBe('cnpj');
    expect(kindOf('<input name="b" placeholder="000.000.000-00">')).toBe('cpf');
    expect(kindOf('<input name="c" placeholder="00000-000">')).toBe('postalCode');
    expect(kindOf('<input name="d" placeholder="(00) 00000-0000">')).toBe('mobile');
    expect(kindOf('<input name="e" placeholder="(00) 0000-0000">')).toBe('landline');
  });

  it('recognises date placeholders in both spellings', () => {
    expect(kindOf('<input name="f" placeholder="dd/mm/aaaa">')).toBe('birthdate');
    expect(kindOf('<input name="g" placeholder="dd/mm/yyyy">')).toBe('birthdate');
  });

  it('does not read an ordinary placeholder as a mask', () => {
    expect(kindOf('<input name="h" placeholder="Digite aqui">')).toBeNull();
    expect(kindOf('<input name="i" placeholder="0">')).toBeNull();
  });

  it('lets a named field outrank the mask', () => {
    // The name is the stronger signal when both are present.
    expect(kindOf('<input name="cpf" placeholder="000.000.000-00">')).toBe('cpf');
  });
});

describe('utility CSS must not be mistaken for meaning', () => {
  // A date field on a real app was filled with a city. The culprit was
  // `disabled:opacity-50` in the design system's class list: "opacity" contains
  // "city", the city rule had no word boundary, and city is checked before
  // birthdate. The value then hit the field's mask, which strips non-digits,
  // so the field came out empty and the failure looked like "nothing filled".
  const TAILWIND =
    'flex w-full min-w-0 text-sm border border-input bg-transparent rounded-sm px-3 py-1 ' +
    'transition-[color,box-shadow] focus-visible:ring-2 outline-none ' +
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50';

  it('does not read "opacity" as a city', () => {
    expect(kindOf(`<input name="data_nascimento" class="${TAILWIND}">`)).toBe('birthdate');
  });

  it('ignores the class attribute entirely', () => {
    // Even a class that names a field outright must not drive detection: it
    // describes how the control looks, not what it holds.
    expect(kindOf('<input name="quantidade" class="cpf-input">')).toBeNull();
  });

  it('keeps loose English words from matching inside longer ones', () => {
    for (const [attr, expected] of [
      ['data-testid="translate-toggle"', null],
      ['data-testid="opacity-control"', null],
      ['data-testid="statement-ref"', null],
    ] as const) {
      expect(kindOf(`<input ${attr}>`), attr).toBe(expected);
    }
  });

  it('still matches those words when they stand alone', () => {
    expect(kindOf('<input name="city">')).toBe('city');
    expect(kindOf('<input name="state">')).toBe('stateCode');
    expect(kindOf('<input name="address">')).toBe('street');
  });
});
