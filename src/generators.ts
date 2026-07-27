import { fakerPT_BR as faker } from '@faker-js/faker';
import * as bu from '@brazilian-utils/brazilian-utils';
import { cnpj as alphanumericCnpj } from 'cpf-cnpj-validator';

import { formatPostalCode, formatStreetAddress, onlyDigits } from './format.js';
import { generateLandlineFormatted, generateMobileFormatted } from './phone.js';

export type GroupId = 'documents' | 'person' | 'address' | 'company' | 'internet';

export interface Generator {
  /** Key typed in Alfred and on the CLI. */
  id: string;
  /** Short description shown in `--list` and as the Alfred subtitle. */
  label: string;
  group: GroupId;
  /**
   * Alternative keys. Portuguese aliases are kept on purpose: the code is in
   * English, but the person typing into Alfred is looking for `endereco`.
   */
  aliases?: string[];
  /** Formatted value, ready to paste. */
  generate: () => string;
  /**
   * Turn a formatted value into its unmasked form.
   *
   * A transform rather than a second generator: Alfred shows the formatted
   * value in the title and offers the unmasked one under Option, and those two
   * have to be the same number. Absent where it makes no sense — a name has no
   * "unformatted" variant.
   */
  unmask?: (formatted: string) => string;
}

export const GROUP_LABELS: Record<GroupId, string> = {
  documents: 'Documents',
  person: 'Person',
  address: 'Address',
  company: 'Company',
  internet: 'Internet',
};

/** Keep letters and digits — the alphanumeric CNPJ is not digits-only. */
function onlyAlphanumeric(value: string): string {
  return value.replace(/[^0-9a-z]/gi, '');
}

/** `31/12/1990` -> `1990-12-31`. */
function toIsoDate(value: string): string {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

/**
 * `generateProcessoJuridico` is typed as `string | null`. With no arguments it
 * never returned null across 5,000 samples, but the contract allows it — better
 * to fail loudly than to let a `null` reach the clipboard as "null".
 */
function generateLawsuitNumber(): string {
  const value = bu.generateProcessoJuridico();
  if (value === null) throw new Error('brazilian-utils returned no lawsuit number');
  return value;
}

const generators: Generator[] = [
  // ----------------------------------------------------------------- documents
  {
    id: 'cpf',
    label: 'CPF (individual taxpayer registry)',
    group: 'documents',
    generate: () => bu.formatCpf(bu.generateCpf()),
    unmask: onlyDigits,
  },
  {
    id: 'cnpj',
    label: 'CNPJ, numeric (classic format)',
    group: 'documents',
    generate: () => bu.formatCnpj(bu.generateCnpj()),
    unmask: onlyDigits,
  },
  {
    id: 'cnpj-alpha',
    label: 'CNPJ, alphanumeric (new format)',
    group: 'documents',
    aliases: ['cnpja', 'cnpj-alfa', 'cnpj-alfanumerico'],
    generate: () => alphanumericCnpj.format(alphanumericCnpj.generate()),
    unmask: onlyAlphanumeric,
  },
  {
    id: 'cnh',
    label: "CNH (driver's licence)",
    group: 'documents',
    generate: () => bu.formatCnh(bu.generateCnh()),
    unmask: onlyDigits,
  },
  {
    id: 'pis',
    label: 'PIS/PASEP',
    group: 'documents',
    aliases: ['pasep'],
    generate: () => bu.formatPis(bu.generatePis()),
    unmask: onlyDigits,
  },
  {
    id: 'voter-id',
    label: 'Voter registration number',
    group: 'documents',
    aliases: ['titulo', 'titulo-eleitor'],
    generate: () => bu.formatVoterId(bu.generateVoterId()),
    unmask: onlyDigits,
  },
  {
    id: 'license-plate',
    label: 'Vehicle licence plate',
    group: 'documents',
    aliases: ['placa'],
    generate: () => bu.generateLicensePlate(),
  },
  {
    id: 'boleto',
    label: 'Boleto payment line',
    group: 'documents',
    generate: () => bu.formatBoleto(bu.generateBoleto()),
    unmask: onlyDigits,
  },
  {
    id: 'lawsuit',
    label: 'Lawsuit case number',
    group: 'documents',
    aliases: ['processo'],
    generate: () => bu.formatProcessoJuridico(generateLawsuitNumber()),
    unmask: onlyDigits,
  },

  // -------------------------------------------------------------------- person
  {
    id: 'name',
    label: 'Full name',
    group: 'person',
    aliases: ['nome'],
    generate: () => faker.person.fullName(),
  },
  {
    id: 'first-name',
    label: 'First name',
    group: 'person',
    aliases: ['primeiro-nome'],
    generate: () => faker.person.firstName(),
  },
  {
    id: 'last-name',
    label: 'Last name',
    group: 'person',
    aliases: ['sobrenome'],
    generate: () => faker.person.lastName(),
  },
  {
    id: 'email',
    label: 'Email address',
    group: 'person',
    generate: () => faker.internet.email().toLowerCase(),
  },
  {
    id: 'mobile',
    label: 'Mobile number with area code',
    group: 'person',
    aliases: ['celular'],
    generate: () => generateMobileFormatted(),
    unmask: onlyDigits,
  },
  {
    id: 'landline',
    label: 'Landline number with area code',
    group: 'person',
    aliases: ['telefone', 'fixo'],
    generate: () => generateLandlineFormatted(),
    unmask: onlyDigits,
  },
  {
    id: 'birthdate',
    label: 'Date of birth',
    group: 'person',
    aliases: ['nascimento'],
    generate: () => faker.date.birthdate().toLocaleDateString('pt-BR'),
    unmask: toIsoDate,
  },

  // ------------------------------------------------------------------- address
  {
    id: 'postal-code',
    label: 'CEP (postal code)',
    group: 'address',
    aliases: ['cep'],
    generate: () => formatPostalCode(bu.generateCep()),
    unmask: onlyDigits,
  },
  {
    id: 'address',
    label: 'Full address',
    group: 'address',
    aliases: ['endereco'],
    generate: () => {
      const street = formatStreetAddress(faker.location.street(), faker.location.buildingNumber());
      const city = faker.location.city();
      const state = faker.location.state({ abbreviated: true });
      return `${street} - ${city}/${state} - ${formatPostalCode(bu.generateCep())}`;
    },
  },
  {
    id: 'street',
    label: 'Street with number',
    group: 'address',
    aliases: ['rua', 'logradouro'],
    generate: () => formatStreetAddress(faker.location.street(), faker.location.buildingNumber()),
  },
  {
    id: 'city',
    label: 'City',
    group: 'address',
    aliases: ['cidade'],
    generate: () => faker.location.city(),
  },
  {
    id: 'state',
    label: 'State name',
    group: 'address',
    aliases: ['estado'],
    generate: () => faker.location.state(),
  },
  {
    id: 'state-code',
    label: 'State code (UF)',
    group: 'address',
    aliases: ['uf'],
    generate: () => faker.location.state({ abbreviated: true }),
  },

  // ------------------------------------------------------------------- company
  {
    id: 'company',
    label: 'Company name',
    group: 'company',
    aliases: ['empresa'],
    generate: () => faker.company.name(),
  },
  {
    id: 'credit-card',
    label: 'Credit card number',
    group: 'company',
    aliases: ['cartao'],
    generate: () => faker.finance.creditCardNumber(),
    unmask: onlyDigits,
  },

  // ------------------------------------------------------------------ internet
  {
    id: 'username',
    label: 'Username',
    group: 'internet',
    aliases: ['usuario'],
    generate: () => faker.internet.username().toLowerCase(),
  },
  {
    id: 'password',
    label: 'Password',
    group: 'internet',
    aliases: ['senha'],
    generate: () => faker.internet.password({ length: 16 }),
  },
  {
    id: 'url',
    label: 'URL',
    group: 'internet',
    generate: () => faker.internet.url(),
  },
  {
    id: 'domain',
    label: 'Domain name',
    group: 'internet',
    aliases: ['dominio'],
    generate: () => faker.internet.domainName(),
  },
  {
    id: 'ip',
    label: 'IPv4 address',
    group: 'internet',
    aliases: ['ipv4'],
    generate: () => faker.internet.ipv4(),
  },
  {
    id: 'uuid',
    label: 'UUID v4',
    group: 'internet',
    generate: () => faker.string.uuid(),
  },
  {
    id: 'text',
    label: 'Paragraph of filler text',
    group: 'internet',
    aliases: ['texto', 'lorem'],
    generate: () => faker.lorem.paragraph(),
  },
];

export const GENERATORS: readonly Generator[] = generators;

const byKey = new Map<string, Generator>();
for (const generator of generators) {
  byKey.set(generator.id, generator);
  for (const alias of generator.aliases ?? []) byKey.set(alias, generator);
}

/** Look up by id or alias. Returns `undefined` when nothing matches. */
export function findGenerator(key: string): Generator | undefined {
  return byKey.get(key.trim().toLowerCase());
}

/** Every accepted id and alias, sorted — used in CLI error messages. */
export function allKeys(): string[] {
  return [...byKey.keys()].sort();
}

/**
 * Produce `count` values from a generator.
 * With `raw`, apply the unmask transform when the generator defines one.
 */
export function generate(generator: Generator, count = 1, raw = false): string[] {
  return Array.from({ length: count }, () => {
    const formatted = generator.generate();
    return raw && generator.unmask ? generator.unmask(formatted) : formatted;
  });
}
