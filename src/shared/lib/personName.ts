/** A surname that is blank or only punctuation ("-", ".", "–") is missing. */
export function cleanNamePart(value?: string | null): string {
  const t = (value ?? '').trim();
  return /^[\p{P}\s]*$/u.test(t) ? '' : t;
}

function looksLikePhone(raw: string): boolean {
  if (/[a-z@]/i.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Living-person display name. A missing surname is "{first} (no surname)",
 * never "Dean ." or "Dean -".
 * A phone stored in the first-name field is returned as typed so the caller can format it.
 */
export function displayPersonName(first?: string | null, last?: string | null): string | null {
  const f = cleanNamePart(first);
  const l = cleanNamePart(last);
  if (f && l) return `${f} ${l}`;
  if (f) return looksLikePhone(f) ? f : `${f} (no surname)`;
  if (l) return l;
  return null;
}

/** A stored full name that ends in a placeholder surname ("Dean .") uses the same rule. */
export function tidyStoredName(name?: string | null): string {
  const t = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const m = /^(.+?)\s+[\p{P}]+$/u.exec(t);
  if (m && m[1] && !/^[\p{P}\s]*$/u.test(m[1]) && !looksLikePhone(m[1])) return `${m[1]} (no surname)`;
  return t;
}
