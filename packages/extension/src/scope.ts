/**
 * Which sites may be filled.
 *
 * The danger with a form filler is not privacy — `activeTab` already means the
 * extension can only touch a page the user explicitly invoked it on. The danger
 * is *hitting the shortcut on the wrong tab* and pushing a fake CPF into a real
 * signup. So filling is gated on an allowlist that defaults to local
 * development origins, and anywhere else has to be allowed deliberately.
 */

/** Origins where a form is almost certainly a test form. */
export const DEFAULT_ALLOWLIST = [
  'localhost',
  '127.0.0.1',
  '[::1]',
  '*.localhost',
  '*.local',
  '*.test',
  '*.localhost.dev',
];

export interface ScopeSettings {
  allowlist: string[];
  /** Turning this off allows every site — deliberate, and never the default. */
  enforce: boolean;
}

export const DEFAULT_SETTINGS: ScopeSettings = {
  allowlist: DEFAULT_ALLOWLIST,
  enforce: true,
};

/**
 * Match a hostname against one allowlist entry.
 *
 * Supports a leading `*.` wildcard, which matches subdomains but deliberately
 * not the bare domain: `*.example.com` covers `app.example.com` and leaves
 * `example.com` out, so widening the scope stays an explicit act.
 */
export function matchesPattern(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase();
  const rule = pattern.trim().toLowerCase();
  if (!rule) return false;

  if (rule.startsWith('*.')) {
    const suffix = rule.slice(1); // ".example.com"
    return host.endsWith(suffix);
  }

  return host === rule;
}

export function isAllowed(url: string, settings: ScopeSettings): boolean {
  if (!settings.enforce) return true;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  return settings.allowlist.some((pattern) => matchesPattern(hostname, pattern));
}

/** The hostname to offer when the user wants to allow the current page. */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
