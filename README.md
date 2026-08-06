<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <img src="assets/banner-light.svg" width="720"
         alt="br-faker — Brazilian fake data, in Alfred and in your browser">
  </picture>
</p>

# br-faker

Brazilian fake data — CPF, CNPJ (numeric **and** the new alphanumeric format), CNH, PIS, CEP, licence plate, voter ID, names, addresses and more — from two front-ends over one generator core.

| Package | What it is |
| --- | --- |
| [`packages/core`](packages/core) | The generators, the formatting, and `generatePerson()` |
| [`packages/alfred`](packages/alfred) | Alfred workflow: type `faker`, press Enter, it is on your clipboard |
| [`packages/extension`](packages/extension) | Chromium MV3 extension: fills a whole form with one shortcut |

Every generated document is checked against the upstream validators in the test suite — `isValidCpf`, `isValidCnpj`, `isValidCnh`, `isValidPis`, `isValidVoterId`, `isValidLicensePlate`, `isValidCep` — 200 samples each.

## The Alfred workflow

**[⬇ Download the latest release](https://github.com/adrianogl/br-faker/releases/latest/download/br-faker.alfredworkflow)** — then double-click it. Requires **Node.js 20+** and Alfred with the Powerpack.

```
faker cpf          →  768.706.350-30
faker cnpj         →  36.783.109/6055-04
faker cnpj-alpha   →  I6.OIO.U9D/34A0-16
faker endereco     →  Alameda Luiza, 477 - Martins do Norte/PI - 26971-564
```

**Enter** copies the formatted value. **Option + Enter** copies it unmasked (`36783109605504`) where that makes sense.

The packaged workflow bundles its dependencies into a single file, so it needs no `node_modules` beside it and no global install.

Alfred strips a workflow's category on install, on purpose, so you pick your own: right-click the workflow in the sidebar to set it.

### Generators

| Group | Keys |
| --- | --- |
| Documents | `cpf`, `cnpj`, `cnpj-alpha`, `cnh`, `pis`, `voter-id`, `license-plate`, `boleto`, `lawsuit` |
| Person | `name`, `first-name`, `last-name`, `email`, `mobile`, `landline`, `birthdate` |
| Address | `postal-code`, `address`, `street`, `city`, `state`, `state-code` |
| Company | `company`, `credit-card` |
| Internet | `username`, `password`, `url`, `domain`, `ip`, `uuid`, `text` |

The code is in English, but Portuguese aliases are first-class — `nome`, `endereco`, `celular`, `cep`, `placa`, `titulo`, `empresa`, `senha` all resolve. Type whichever comes to mind.

## The browser extension

**[⬇ Download the latest release](https://github.com/adrianogl/br-faker/releases/latest/download/br-faker-extension.zip)**, unzip it, then load it unpacked from `chrome://extensions` with developer mode on. Works in any Chromium browser — Chrome, Edge, Brave, Arc, Dia.

Press **⌘⇧Y** (Ctrl+Shift+Y elsewhere) and the form fills. The toolbar popup, the right-click menu and the optional floating button do the same thing.

### Which sites it may fill

The risk with a form filler is not privacy — it is hitting the shortcut on the wrong tab and pushing a fake CPF into a real signup. So filling is gated on an allowlist, and it ships covering local development only:

```
localhost   127.0.0.1   [::1]   *.localhost   *.local   *.test
```

Anywhere else, the popup says the site is out of scope and offers a one-click **Allow this site**. A leading `*.` matches subdomains but deliberately not the bare domain, so widening the scope stays an explicit act. Manage the list from the options page.

By default the extension asks for **no host permissions at all**. `activeTab` grants access to one tab, for one gesture, when you invoke it — nothing is injected into pages you have not asked about.

### The floating button

Off by default. Turn it on from the options page and a round button sits on top of the allowed sites: click it to fill, drag it out of the way of a field (its place is remembered per site), right-click it to map a field. It rests faded and only comes forward when pointed at, focused or working — it spends the day over someone's form, and a solid badge in the corner competes with the page it is there to help with.

Switching it on reaches the tabs you already have open, so there is no reload to guess at, and the options page reports back which hosts Chrome actually registered — or why it refused — instead of a bare "saved".

Being there *before* any gesture is the whole point, and that is the one thing `activeTab` cannot do — so switching it on asks for access to the sites on your allowlist, and nowhere else. Revoke the permission, empty the list or turn the switch off and the script that draws it is unregistered. Hosts Chrome cannot express as a match pattern — `[::1]` — are left out of the request; they keep filling through the shortcut and the popup.

### One coherent person, not a bag of random values

Filling a whole form needs more than independent values. faker's pt_BR locale invents city names that do not exist and pairs them with unrelated states (`Bryan do Descoberto / DF`), and an email unrelated to the name reads as obviously machine-made.

`generatePerson()` draws once and derives the rest: the city is a real municipality of the drawn state (from brazilian-utils' 5,570-municipality dataset), the email comes from the person's own name, and the CEP falls inside that state's range.

### How fields are matched

Detection reads every signal a control gives away and scores it in tiers, because no single one is reliable:

1. **`autocomplete`** — authoritative when present, usually absent
2. **`name`, `id`, `class`, `data-testid`, `formControlName`** — developer shorthand
3. **The visible `<label>`, `placeholder`, `aria-label`** — often the only human-readable clue
4. **`type`** — a weak last resort
5. **Mask length** with `inputmode="numeric"` — only when naming gave nothing away

Ambiguity is handled with ordered rules and explicit rejections: `sobrenome` contains `nome`, and `nome da empresa` is a company, so the specific patterns run first and the greedy ones carry a reject list. Every case above is covered by a test.

Filled fields are logged to the page console with the control that received each one, so a wrong guess is debuggable rather than mysterious.

### Why the value setting is not just `element.value = x`

Assigning `value` is not enough on a modern page. React tracks the value on its own node and its `onChange` never fires for a plain assignment, so the field *looks* filled while the app's state stays empty and validation fails on submit. Values go in through the **native prototype setter**, bypassing the framework's override, followed by bubbling `input` and `change` events — what a real keystroke produces.

Masked inputs get a second pass: after writing, the alphanumerics that landed are compared with what was asked for, and on a mismatch the raw digits are tried, which most mask libraries accept and format themselves.

## Development

```bash
npm install
npm test          # 217 tests
npm run verify    # typecheck + test + build
npm run workflow  # package the .alfredworkflow
npm run extension # package the extension and load it from packages/extension/dist
npm run art       # regenerate the icons and README banners
```

Releasing is a tag: `git tag v0.3.0 && git push origin v0.3.0`. GitHub Actions runs the checks, packages both artefacts, smoke-tests them and attaches them to the release.

### Layout

| Path | Purpose |
| --- | --- |
| `packages/core/src/generators.ts` | The registry — every generator, its aliases and its unmask transform |
| `packages/core/src/person.ts` | Coherent persona, real city/state pairs, state-aware CEP |
| `packages/core/src/format.ts` | Brazilian formatting (phone, CEP, street order) |
| `packages/core/src/phone.ts` | Area codes and Anatel-shaped phone numbers |
| `packages/alfred/src/alfred.ts` | Builds the Script Filter JSON Alfred renders |
| `packages/extension/src/fields.ts` | Field detection and scoring |
| `packages/extension/src/apply.ts` | Framework-safe value setting and visibility |
| `packages/extension/src/scope.ts` | The allowlist that decides which sites may be filled |
| `packages/extension/src/floating-button.ts` | The in-page button: shadow DOM, drag, remembered position |
| `scripts/artwork.mjs` | Emblem proportions and palette, shared by icon and banner |

The artwork is generated rather than committed as opaque binaries someone has to take on trust. `build-icon.mjs` rasterises the shapes into PNGs using signed distance fields and Node's built-in zlib; `build-banner.mjs` emits the same shapes as SVG. Changing the artwork is a code review, not a file swap.

## Notes on the upstream libraries

Generation leans on [`@faker-js/faker`](https://github.com/faker-js/faker), [`@brazilian-utils/brazilian-utils`](https://github.com/brazilian-utils/javascript) and [`cpf-cnpj-validator`](https://github.com/carvalhoviniciusluiz/cpf-cnpj-validator). Four things are handled here rather than delegated, each for a concrete reason:

**Phone formatting.** `formatPhone` from brazilian-utils drops digits — `11987654321` comes back as `11987-6543`, losing the trailing `21`. `format.ts` implements it instead, and a test asserts no digit is ever lost.

**Phone generation.** `generatePhone` alternates between landline and mobile with no way to ask for one, so `mobile` and `landline` are built from the area-code list following Anatel's numbering plan.

**Street order.** faker's `location.streetAddress()` returns US order (`1009 Avenida Ígor`) even under `pt_BR`, so addresses are composed as `Avenida Ígor, 1009`.

**Geography.** faker's pt_BR cities are synthetic and unrelated to the state, so `person.ts` takes real municipalities from brazilian-utils instead.

## License

MIT
