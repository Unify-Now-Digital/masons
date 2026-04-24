/**
 * Contact-handle normalisation for fuzzy cross-referencing between
 * conversations, customers and cemeteries.
 *
 *  - Emails are lowercased and trimmed.
 *  - Phones are canonicalised to a digits-only UK-friendly form:
 *      · strip "+" and any non-digits
 *      · leading "0" (UK national) → "44" (UK country code)
 *    so `+44 7700 900999`, `07700 900999` and `447700900999` all
 *    collapse to the same token.
 *
 *  Good enough for matching intent. A proper E.164 library would do this
 *  per-country; for now we assume UK since that's the single market.
 */
export function normaliseHandle(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = raw.trim().toLowerCase();
  if (s.includes('@')) return s;
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return '44' + digits.slice(1);
  return digits;
}

/** Return the domain part of an email, or '' for non-emails. */
export function emailDomain(handle: string | null | undefined): string {
  if (!handle) return '';
  const s = handle.trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 0) return '';
  return s.slice(at + 1);
}
