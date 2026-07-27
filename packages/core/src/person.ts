import { fakerPT_BR as faker } from '@faker-js/faker';
import * as bu from '@brazilian-utils/brazilian-utils';

import { formatPhone, formatPostalCode, formatStreetAddress } from './format.js';
import { generateLandline, generateMobile } from './phone.js';

/**
 * A single coherent fake person.
 *
 * Filling a whole form needs more than independent values. faker's pt_BR locale
 * invents city names that do not exist and pairs them with unrelated states
 * ("Bryan do Descoberto / DF"), and an email unrelated to the name reads as
 * obviously machine-made. Everything here is derived from one draw so the
 * record hangs together: the city is a real municipality of the drawn state,
 * the email comes from the name, and the postal code falls in that state's
 * range.
 */
/**
 * The two-letter state codes brazilian-utils recognises. Kept as the union
 * rather than `string` so callers can pass a person's state straight into
 * `getCities` without a cast.
 */
export type StateCode = ReturnType<typeof bu.getStates>[number]['code'];

export interface Person {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  cpf: string;
  cnpj: string;
  company: string;
  mobile: string;
  landline: string;
  birthdate: string;
  postalCode: string;
  street: string;
  city: string;
  stateCode: StateCode;
  stateName: string;
  username: string;
  password: string;
}

/**
 * Approximate CEP prefix ranges per state, as [first, last] of the leading five
 * digits. Correios allocates blocks geographically, and these cover the main
 * block of each state; a few states hold extra discontinuous blocks that are
 * not modelled. Good enough for a plausible fake address, not a substitute for
 * a real CEP database.
 */
const POSTAL_RANGES: Record<StateCode, [number, number]> = {
  SP: [1000, 19999],
  RJ: [20000, 28999],
  ES: [29000, 29999],
  MG: [30000, 39999],
  BA: [40000, 48999],
  SE: [49000, 49999],
  PE: [50000, 56999],
  AL: [57000, 57999],
  PB: [58000, 58999],
  RN: [59000, 59999],
  CE: [60000, 63999],
  PI: [64000, 64999],
  MA: [65000, 65999],
  PA: [66000, 68899],
  AP: [68900, 68999],
  AM: [69000, 69299],
  RR: [69300, 69389],
  AC: [69900, 69999],
  DF: [70000, 73699],
  GO: [73700, 76799],
  RO: [76800, 76999],
  TO: [77000, 77995],
  MT: [78000, 78899],
  MS: [79000, 79999],
  PR: [80000, 87999],
  SC: [88000, 89999],
  RS: [90000, 99999],
};

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('cannot pick from an empty list');
  return item;
}

/** Strip accents and punctuation so a name can become an email local part. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** A CEP inside the drawn state's range, rather than anywhere in Brazil. */
function postalCodeFor(stateCode: StateCode): string {
  const range = POSTAL_RANGES[stateCode];
  if (!range) return formatPostalCode(bu.generateCep());
  const prefix = String(randomInt(range[0], range[1])).padStart(5, '0');
  return formatPostalCode(`${prefix}${String(randomInt(0, 999)).padStart(3, '0')}`);
}

const EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'uol.com.br'];

export function generatePerson(): Person {
  const state = pick(bu.getStates());
  const cities = bu.getCities(state.code);
  // Every state has municipalities, but fall back rather than throw if the
  // upstream dataset ever returns nothing for one.
  const city = cities.length > 0 ? pick(cities) : faker.location.city();

  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  const email = `${slugify(firstName)}.${slugify(lastName)}${randomInt(1, 99)}@${pick(EMAIL_DOMAINS)}`;

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email,
    cpf: bu.formatCpf(bu.generateCpf()),
    cnpj: bu.formatCnpj(bu.generateCnpj()),
    company: faker.company.name(),
    mobile: formatPhone(generateMobile()),
    landline: formatPhone(generateLandline()),
    birthdate: faker.date.birthdate().toLocaleDateString('pt-BR'),
    postalCode: postalCodeFor(state.code),
    street: formatStreetAddress(faker.location.street(), faker.location.buildingNumber()),
    city,
    stateCode: state.code,
    stateName: state.name,
    username: slugify(`${firstName}${lastName}`).slice(0, 14) + randomInt(1, 99),
    password: faker.internet.password({ length: 16 }),
  };
}
