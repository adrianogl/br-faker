import en from '../_locales/en/messages.json';
import ptBR from '../_locales/pt_BR/messages.json';

/**
 * Message lookup, resolved here rather than by Chrome.
 *
 * `chrome.i18n` picks the catalogue from the browser's UI language and offers
 * no way to override it, so shipping an English catalogue means an
 * English-language browser gets English — no matter what `default_locale` says.
 * That makes "Portuguese by default" and "English available" contradictory
 * under Chrome's rules.
 *
 * Resolving it ourselves settles that: the catalogues are bundled, the language
 * is a setting that defaults to Portuguese, and `auto` is there for anyone who
 * wants the browser to decide after all. Chrome still resolves the `__MSG_*__`
 * strings in the manifest, which is why `_locales` remains on disk.
 */

export type Language = 'pt_BR' | 'en' | 'auto';

type Catalogue = Record<string, { message: string }>;

const CATALOGUES: Record<Exclude<Language, 'auto'>, Catalogue> = {
  pt_BR: ptBR as Catalogue,
  en: en as Catalogue,
};

export const DEFAULT_LANGUAGE: Language = 'pt_BR';

let current: Catalogue = CATALOGUES.pt_BR;

/** Which catalogue a preference resolves to, given the browser's language. */
export function resolveCatalogue(language: Language, uiLanguage: string): Catalogue {
  if (language === 'auto') {
    return uiLanguage.toLowerCase().startsWith('pt') ? CATALOGUES.pt_BR : CATALOGUES.en;
  }
  return CATALOGUES[language];
}

/**
 * Load the language preference before anything is rendered.
 *
 * Pages await this so no label is ever painted in one language and swapped for
 * another a frame later.
 */
export async function initI18n(): Promise<void> {
  const stored = (await chrome.storage.sync.get({ language: DEFAULT_LANGUAGE })) as {
    language: Language;
  };
  const uiLanguage = chrome.i18n?.getUILanguage?.() ?? 'pt-BR';
  current = resolveCatalogue(stored.language, uiLanguage);
}

/**
 * Look up a message, with `$1`-style substitutions.
 *
 * Falls back to the key, which is a visible failure rather than a blank label.
 */
export function t(key: string, ...substitutions: string[]): string {
  const entry = current[key];
  if (!entry) return key;

  return substitutions.reduce(
    (message, value, index) => message.replaceAll(`$${index + 1}`, value),
    interpolate(entry.message, substitutions),
  );
}

/**
 * Chrome's catalogues name their slots (`$COUNT$`) and map them to positional
 * arguments through a `placeholders` block. The same files are read here, so
 * the named form has to be understood too.
 */
function interpolate(message: string, substitutions: string[]): string {
  return message.replace(/\$([A-Za-z_]+)\$?/g, (match, name: string) => {
    const index = Number(name.replace(/\D/g, ''));
    if (index > 0) return substitutions[index - 1] ?? match;

    // Named placeholder: the catalogues use one per message, in order.
    return substitutions[0] ?? match;
  });
}

/**
 * Translate a document in place.
 *
 * Markup carries `data-i18n` attributes instead of text, so the pages stay
 * readable as HTML and no string is duplicated between markup and script.
 */
export function applyTranslations(root: ParentNode = document): void {
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n]'))) {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  }

  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]'))) {
    const key = element.dataset.i18nPlaceholder;
    if (key) element.setAttribute('placeholder', t(key));
  }

  const title = root.querySelector('title');
  if (title?.dataset.i18n) title.textContent = t(title.dataset.i18n);
}
