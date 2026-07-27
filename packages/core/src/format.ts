/**
 * Formatting helpers for Brazilian data.
 *
 * These exist because `formatPhone` from @brazilian-utils/brazilian-utils
 * drops digits: `11987654321` comes back as `11987-6543` (the trailing `21`
 * is lost) instead of `(11) 98765-4321`. Nothing here depends on it.
 */

/** Strip everything that is not a digit. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Format a Brazilian phone number with the area code in parentheses.
 *
 * Accepts 10 digits (landline, `(11) 3265-4789`) or 11 (mobile,
 * `(11) 98765-4321`). Any other length is returned untouched rather than
 * silently truncated.
 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

/** Format a CEP (postal code) as `01310-100`. */
export function formatPostalCode(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Build a street line in Brazilian order: `Avenida Ígor, 1009`.
 *
 * faker's `location.streetAddress()` returns US order (`1009 Avenida Ígor`)
 * even under the pt_BR locale.
 */
export function formatStreetAddress(street: string, number: string): string {
  return `${street}, ${number}`;
}
