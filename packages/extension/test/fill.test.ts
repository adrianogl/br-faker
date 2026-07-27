import { describe, expect, it } from 'vitest';

import { generatePerson } from '@br-faker/core';

import { fillField, isFillable } from '../src/apply.js';
import { fillForm } from '../src/fill.js';

function render(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('fillField', () => {
  it('writes a value and reports success', () => {
    render('<input id="a">');
    const input = document.getElementById('a') as HTMLInputElement;
    expect(fillField(input, '123.456.789-09').filled).toBe(true);
    expect(input.value).toBe('123.456.789-09');
  });

  it('dispatches bubbling input and change events', () => {
    render('<form><input id="a"></form>');
    const input = document.getElementById('a') as HTMLInputElement;

    const seen: string[] = [];
    // Listening on the form proves the events bubble, which is what React and
    // Vue rely on to notice a change.
    document.querySelector('form')!.addEventListener('input', () => seen.push('input'));
    document.querySelector('form')!.addEventListener('change', () => seen.push('change'));

    fillField(input, 'x');
    expect(seen).toEqual(['input', 'change']);
  });

  it('goes through the native setter, so a framework-patched setter is bypassed', () => {
    render('<input id="a">');
    const input = document.getElementById('a') as HTMLInputElement;

    // Emulate React installing its own value setter on the instance.
    let patchedCalls = 0;
    Object.defineProperty(input, 'value', {
      get: () => input.getAttribute('data-value') ?? '',
      set: (v: string) => {
        patchedCalls++;
        input.setAttribute('data-value', v);
      },
      configurable: true,
    });

    fillField(input, 'hello');
    expect(patchedCalls, 'the instance setter should have been bypassed').toBe(0);
  });

  it('retries with the unmasked value when a mask rejects the formatted one', () => {
    render('<input id="a">');
    const input = document.getElementById('a') as HTMLInputElement;

    // A mask that refuses anything containing punctuation.
    input.addEventListener('input', () => {
      if (/[.\-/]/.test(input.value)) input.value = '';
    });

    const result = fillField(input, '123.456.789-09', '12345678909');
    expect(result.filled).toBe(true);
    expect(input.value).toBe('12345678909');
  });

  it('selects a matching option in a select', () => {
    render('<select id="s"><option value="">--</option><option value="SP">São Paulo</option></select>');
    const select = document.getElementById('s') as HTMLSelectElement;
    expect(fillField(select, 'SP').filled).toBe(true);
    expect(select.value).toBe('SP');
  });

  it('matches a select option by its visible text too', () => {
    render('<select id="s"><option value="35">São Paulo</option></select>');
    const select = document.getElementById('s') as HTMLSelectElement;
    expect(fillField(select, 'São Paulo').filled).toBe(true);
    expect(select.value).toBe('35');
  });
});

describe('isFillable', () => {
  it('accepts ordinary text controls', () => {
    render('<input id="a"><textarea id="b"></textarea><select id="c"></select>');
    for (const id of ['a', 'b', 'c']) {
      expect(isFillable(document.getElementById(id)!), id).toBe(true);
    }
  });

  it('rejects controls a user could not type into', () => {
    render(`
      <input id="h" type="hidden">
      <input id="s" type="submit">
      <input id="f" type="file">
      <input id="d" disabled>
      <input id="r" readonly>
    `);
    for (const id of ['h', 's', 'f', 'd', 'r']) {
      expect(isFillable(document.getElementById(id)!), id).toBe(false);
    }
  });
});

describe('fillForm', () => {
  const SIGNUP = `
    <form>
      <label>Nome completo <input name="nome_completo"></label>
      <label>E-mail <input type="email" name="email"></label>
      <label>CPF <input name="cpf"></label>
      <label>Celular <input name="celular"></label>
      <label>CEP <input name="cep"></label>
      <label>Cidade <input name="cidade"></label>
      <label>Quantidade <input name="quantidade"></label>
      <button type="submit">Enviar</button>
    </form>
  `;

  it('fills the fields it recognises and leaves the rest alone', () => {
    const root = render(SIGNUP);
    const report = fillForm(root, generatePerson());

    const kinds = report.filled.map((field) => field.kind).sort();
    expect(kinds).toEqual(['city', 'cpf', 'email', 'fullName', 'mobile', 'postalCode']);

    expect((document.querySelector('[name=quantidade]') as HTMLInputElement).value).toBe('');
    expect(report.skipped).toBe(1);
  });

  it('fills with one coherent person, not unrelated values', () => {
    const root = render(SIGNUP);
    const report = fillForm(root, generatePerson());

    const value = (name: string) =>
      (document.querySelector(`[name=${name}]`) as HTMLInputElement).value;

    expect(value('nome_completo')).toBe(report.person.fullName);
    expect(value('cidade')).toBe(report.person.city);
    // The email is derived from the name, so the surname appears in both.
    const surname = report.person.lastName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    expect(value('email')).toContain(surname);
  });

  it('produces a valid CPF in the CPF field', () => {
    const root = render(SIGNUP);
    fillForm(root, generatePerson());
    expect((document.querySelector('[name=cpf]') as HTMLInputElement).value).toMatch(
      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
    );
  });

  it('gives a date input the ISO value it requires', () => {
    const root = render('<input type="date" name="nascimento">');
    fillForm(root, generatePerson());
    expect((document.querySelector('[name=nascimento]') as HTMLInputElement).value).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('finds nothing in a form with no recognisable fields', () => {
    const root = render('<form><input name="quantidade"><input name="cupom"></form>');
    const report = fillForm(root, generatePerson());
    expect(report.filled).toHaveLength(0);
    expect(report.skipped).toBe(2);
  });
});
