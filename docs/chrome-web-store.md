# Chrome Web Store submission

Everything the listing form asks for, written out. Copy from here into the
dashboard rather than improvising at submission time.

## Package

Upload `br-faker-extension.zip`, produced by `npm run extension` and attached to
every tagged release. Verified against the store's hard limits:

| Requirement | State |
| --- | --- |
| Manifest V3 | yes |
| Name ≤ 45 chars | 8 |
| Description ≤ 132 chars | 127 (pt-BR), 108 (en) |
| 128×128 icon | present |
| No remotely hosted code | none — no `importScripts`, `eval`, `new Function`, `fetch`, `XHR` or dynamic `import` |
| Host permissions | none requested |

The version in `manifest.json` is taken from the root `package.json` at build
time. The store rejects a re-upload of a version it already has, so bump it
before packaging a new submission.

## Single purpose

> Fill web forms with valid Brazilian test data.

The store requires one narrow purpose, and everything in the extension serves
this one: the generators, the field detection, the manual mappings and the
picker.

## Category and language

- Category: **Developer Tools**
- Primary language: **Portuguese (Brazil)**

## Listing copy

### Portuguese (pt-BR)

**Descrição curta** (a mesma do manifesto, 127 caracteres)

> Preenche formulários com dados falsos brasileiros válidos: CPF, CNPJ, CEP, telefone, nome e endereço, como uma pessoa coerente.

**Descrição completa**

> Testar formulário brasileiro dá trabalho: você precisa de um CPF que passe no
> dígito verificador, de um CNPJ que o backend aceite, de um CEP plausível — e
> quase sempre acaba copiando valor por valor de algum gerador online.
>
> O BR Faker preenche o formulário inteiro com um atalho.
>
> **Uma pessoa coerente, não valores soltos**
> O nome, o e-mail, a cidade e o CEP pertencem à mesma pessoa. A cidade é um
> município real do estado sorteado, entre os 5.570 do país, e o CEP cai na
> faixa daquele estado. O e-mail deriva do próprio nome.
>
> **Documentos que passam na validação**
> CPF, CNPJ (numérico e o novo alfanumérico da Receita), CNH, PIS, CEP, título
> de eleitor e placa — todos com dígito verificador correto. Nenhum deles
> corresponde a pessoa ou empresa real.
>
> **Só onde você mandar**
> A extensão não pede nenhuma permissão de host. Por padrão ela só age em
> ambiente local — localhost, 127.0.0.1, *.local, *.test — porque o risco de um
> preenchedor de formulário não é privacidade, é apertar o atalho na aba errada
> e mandar um CPF falso para um cadastro de verdade. Liberar outro site é um
> clique deliberado.
>
> **Quando a detecção não acerta**
> Formulário que esconde o rótulo dentro de componente não dá o que ler. Clique
> em "mapear um campo", clique no campo e escolha o tipo: o mapeamento fica
> gravado para aquela URL e vence a detecção automática.
>
> Nada é coletado, nada é enviado, nenhum servidor é contatado. Código aberto
> sob licença MIT: https://github.com/adrianogl/br-faker

### English

**Short description** (108 characters)

> Fills forms with valid Brazilian fake data: CPF, CNPJ, CEP, phone, name and address, as one coherent person.

**Full description**

> Testing a Brazilian form is tedious: you need a CPF that passes its check
> digits, a CNPJ the backend accepts, a plausible CEP — and you usually end up
> copying values one at a time from some online generator.
>
> BR Faker fills the whole form with one shortcut.
>
> **One coherent person, not a bag of values**
> The name, email, city and postal code belong to the same person. The city is a
> real municipality of the drawn state, out of the country's 5,570, and the
> postal code falls inside that state's range. The email derives from the name.
>
> **Documents that pass validation**
> CPF, CNPJ (numeric and the new alphanumeric format), CNH, PIS, CEP, voter
> registration and licence plates — every one with correct check digits, and
> none corresponding to a real person or company.
>
> **Only where you say**
> The extension requests no host permissions. By default it acts only on local
> development origins, because the risk with a form filler is not privacy — it
> is hitting the shortcut on the wrong tab and pushing a fake document into a
> real signup. Allowing another site is a deliberate click.
>
> **When detection gets it wrong**
> A form that hides its labels inside components gives nothing to read. Click
> "map a field", click the field, pick the type: the mapping is stored for that
> URL and beats automatic detection.
>
> Nothing is collected, nothing is transmitted, no server is contacted. Open
> source under MIT: https://github.com/adrianogl/br-faker

## Permission justifications

The dashboard asks for one per permission. Keep these short and literal —
reviewers reject vague answers.

| Permission | Justification |
| --- | --- |
| `activeTab` | Grants access to the single tab the user explicitly invokes the extension on, through the keyboard shortcut, the toolbar button or the context menu. It is what lets the extension work without any standing host permission. |
| `scripting` | Injects the form-filling script, and the field-picking script, into that one tab at the moment of that gesture. Nothing is injected automatically or in the background. |
| `storage` | Stores the user's own settings: the list of sites they allow filling on, the manual field mappings they create, and their interface language. No browsing data of any kind. |
| `contextMenus` | Adds a single right-click entry, "fill this form with fake data", as an alternative to the keyboard shortcut. |

## Data usage disclosures

Tick **no** for every collection category, and certify:

- Not being sold to third parties
- Not being used or transferred for purposes unrelated to the item's single purpose
- Not being used or transferred to determine creditworthiness or for lending

Privacy policy URL: https://github.com/adrianogl/br-faker/blob/main/PRIVACY.md

## Promotional tiles

Generated by `npm run promo` into `assets/store/`:

| File | Size | Where it appears |
| --- | --- | --- |
| `promo-small.png` | 440×280 | The listing card in search and category pages |
| `promo-marquee.png` | 1400×560 | Only used if the store features the extension |

These are drawn from the same emblem geometry as the icon and the README
banner, so the three cannot drift apart. The documents printed on the marquee
are real generator output, checked against the official validators — putting an
invalid CPF on a promotional image would be a poor advertisement for a tool
whose whole claim is that its documents pass validation.

The store accepts PNG and JPEG only, and these carry text, so the pipeline is
SVG for layout and macOS Quick Look for rasterising: `npm run promo` needs
`qlmanage` and `sips`, and therefore a Mac. The PNGs are committed so the
listing can be updated from any machine.

## Screenshots

Not generated. The store requires screenshots to show the extension as it
really is, and a drawing of an interface is not a picture of one — these have to
be captured from the running extension.

At least one is required, at 1280×800 or 640×400 (1280×800 looks better).
Capture these in a Chromium browser with the extension loaded:

1. **The popup over a form** — shows the site scope and the fill button
2. **A filled form** — the payoff, with CPF, CNPJ and address visible
3. **The picker mid-selection** — a field highlighted with the type menu open
4. **The options page** — allowed sites and field mappings

A local form for these lives in the repo discussion; any signup form on
`localhost` works, since that origin is allowed out of the box.

## What happens after upload

Review usually takes a few days. Extensions that request no host permissions and
load no remote code tend to clear quickly, which is most of why the extension is
built the way it is.
