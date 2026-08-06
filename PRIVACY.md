# Privacy policy — BR Faker

_Last updated: 5 August 2026_

## The short version

BR Faker collects nothing, transmits nothing, and contacts no server. Everything
it does happens inside your browser.

## What the extension stores

Four settings, and only because you set them:

| Setting | What it is |
| --- | --- |
| Allowed sites | The hostnames you permit it to fill, plus whether that list is enforced |
| Field mappings | The URL, CSS selector and field type of any mapping you create |
| Language | Your interface language preference |
| Floating button | Whether it is on, and where you dragged it on each site |

The button's position stays on the machine, in `chrome.storage.local`; the rest
live in `chrome.storage.sync`, which means Chrome may sync them between
your own signed-in browsers. That transfer is between you and Google under
[Google's privacy policy](https://policies.google.com/privacy); the extension is
not a party to it and cannot read it anywhere else.

Nothing else is stored. There is no analytics, no telemetry, no crash reporting,
no identifier of any kind.

## What the extension reads

When you explicitly invoke it — keyboard shortcut, toolbar button or right-click
menu — it reads the form controls of the current page in order to decide what to
type into them: attribute names, labels, placeholders and similar markup.

That reading happens in the page, in the moment, and the result is never stored
or sent anywhere. Out of the box the extension holds no host permissions, so it
has no access to any site until you ask it to act on the tab in front of you.

The floating button is the one exception, and it is off until you turn it on.
Because it has to be on the page before you do anything, it asks — with Chrome's
own prompt — for access to the sites on your allowlist, and only those. What it
draws is a button; it reads the form only when you click it, exactly as the
shortcut does. Turning the switch off, emptying the list, or revoking the
permission in Chrome's settings unregisters the script that draws it.

## What the extension writes

Fake data. Names, documents, addresses and phone numbers generated locally by
[@faker-js/faker](https://github.com/faker-js/faker),
[@brazilian-utils/brazilian-utils](https://github.com/brazilian-utils/javascript)
and [cpf-cnpj-validator](https://github.com/carvalhoviniciusluiz/cpf-cnpj-validator).
The documents are structurally valid — the check digits are correct — but they
describe no real person or company.

## Network activity

None. Every generator and every message catalogue is bundled into the extension
package, and no code is loaded from anywhere at runtime.

## Contact

Open an issue at https://github.com/adrianogl/br-faker/issues.
