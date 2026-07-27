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

describe('framework naming conventions', () => {
  it('reads Angular formControlName and test ids', () => {
    expect(kindOf('<input formcontrolname="cpf">')).toBe('cpf');
    expect(kindOf('<input data-testid="input-cep">')).toBe('postalCode');
  });
});
