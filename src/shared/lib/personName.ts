/** A name part with no letters or digits (".", "-", "•", whitespace) is missing. */
export function cleanNamePart(value?: string | null): string {
  const t = (value ?? '').trim();
  return hasLetterOrDigit(t) ? t : '';
}

function hasLetterOrDigit(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

function looksLikePhone(raw: string): boolean {
  if (/[a-z@]/i.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Living-person display name. A surname with no letters or digits is missing,
 * so the label is "{first} (no surname)", never "Dean ." or "Dean -".
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

/** A stored full name whose last word has no letters or digits ("Dean .", "Dean •") uses the same rule. */
export function tidyStoredName(name?: string | null): string {
  const t = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const parts = t.split(' ');
  let end = parts.length;
  while (end > 0 && !hasLetterOrDigit(parts[end - 1] ?? '')) end -= 1;
  if (end === 0) return '';
  if (end < parts.length) {
    const head = parts.slice(0, end).join(' ');
    if (!looksLikePhone(head)) return `${head} (no surname)`;
  }
  return t;
}
