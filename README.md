# alfred-br-faker

Alfred workflow that generates Brazilian fake data — CPF, CNPJ (numeric **and** the new alphanumeric format), CNH, PIS, CEP, licence plate, voter ID, names, addresses and more.

Type `faker`, then what you need. The result is generated as you type, so you see the value before pressing Enter.

```
faker cpf          →  768.706.350-30
faker cnpj         →  36.783.109/6055-04
faker cnpj-alpha   →  I6.OIO.U9D/34A0-16
faker endereco     →  Alameda Luiza, 477 - Martins do Norte/PI - 26971-564
```

- **Enter** copies the formatted value.
- **Option + Enter** copies it unmasked (`36783109605504`) where that makes sense.

## Install

**[⬇ Download alfred-br-faker.alfredworkflow](https://github.com/adrianogl/alfred-br-faker/raw/main/alfred-br-faker.alfredworkflow)** — then double-click it. That is the whole installation.

Requires **Node.js 20+** and Alfred with the Powerpack. No `npm install`, no cloning: the workflow ships with its dependencies bundled into a single file, so nothing but Node has to exist on your machine.

<details>
<summary>Building it yourself instead</summary>

```bash
git clone https://github.com/adrianogl/alfred-br-faker.git
cd alfred-br-faker
npm install
npm run workflow
```

That regenerates `alfred-br-faker.alfredworkflow` at the repo root.

</details>

## Generators

| Group | Keys |
| --- | --- |
| Documents | `cpf`, `cnpj`, `cnpj-alpha`, `cnh`, `pis`, `voter-id`, `license-plate`, `boleto`, `lawsuit` |
| Person | `name`, `first-name`, `last-name`, `email`, `mobile`, `landline`, `birthdate` |
| Address | `postal-code`, `address`, `street`, `city`, `state`, `state-code` |
| Company | `company`, `credit-card` |
| Internet | `username`, `password`, `url`, `domain`, `ip`, `uuid`, `text` |

The code is in English, but Portuguese aliases are first-class — `nome`, `endereco`, `celular`, `cep`, `placa`, `titulo`, `empresa`, `senha` and friends all resolve. Type whichever comes to mind.

### The alphanumeric CNPJ

Brazil's tax authority is moving CNPJ to an alphanumeric format. Both are first-class here and neither is going away:

- `cnpj` → `36.783.109/6055-04` (numeric, what most systems still expect)
- `cnpj-alpha` → `I6.OIO.U9D/34A0-16` (the new format)

## Development

```bash
npm test          # 61 tests
npm run typecheck
npm run verify    # typecheck + test + build
npm run workflow  # build and package the .alfredworkflow
```

There is also a small CLI, used to exercise the generators without going through Alfred:

```bash
node dist/bin.js cpf
node dist/bin.js cnpj-alpha -n 5
node dist/bin.js mobile --raw
node dist/bin.js --list
```

### Layout

| Path | Purpose |
| --- | --- |
| `src/generators.ts` | The registry — every generator, its aliases and its unmask transform |
| `src/alfred.ts` | Builds the Script Filter JSON Alfred renders |
| `src/format.ts` | Brazilian formatting (phone, CEP, street order) |
| `src/phone.ts` | Area codes and Anatel-shaped phone numbers |
| `src/cli.ts` | Argument parsing and CLI output |
| `workflow/info.plist` | The Alfred workflow definition |

## Notes on the upstream libraries

Generation leans on [`@faker-js/faker`](https://github.com/faker-js/faker), [`@brazilian-utils/brazilian-utils`](https://github.com/brazilian-utils/javascript) and [`cpf-cnpj-validator`](https://github.com/carvalhoviniciusluiz/cpf-cnpj-validator). Three things are handled here rather than delegated, each for a concrete reason:

**Phone formatting.** `formatPhone` from brazilian-utils drops digits — `11987654321` comes back as `11987-6543`, losing the trailing `21`. `src/format.ts` implements it instead, and a test asserts no digit is ever lost.

**Phone generation.** `generatePhone` alternates between landline and mobile with no way to ask for one, so `mobile` and `landline` are built from the area-code list in `src/phone.ts` following Anatel's numbering plan.

**Street order.** faker's `location.streetAddress()` returns US order (`1009 Avenida Ígor`) even under `pt_BR`, so addresses are composed as `Avenida Ígor, 1009`.

Every generated document is checked against the upstream validators in the test suite — `isValidCpf`, `isValidCnpj`, `isValidCnh`, `isValidPis`, `isValidVoterId`, `isValidLicensePlate`, `isValidCep` and `isValidProcessoJuridico` — 200 samples each.

## License

MIT
