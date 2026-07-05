// Canonical phone normalization for matching handles across inbound webhook and outbound send.
// DUPLICATED byte-for-byte in supabase/functions/_shared/phoneNormalization.ts (edge functions
// cannot import from src/). If you change this, change that copy too.

/** Canonical form for matching phone numbers: strip prefix, keep only digits and leading +. */
export function normalizePhoneForMatch(handle: string): string {
  const s = (handle ?? '').trim().replace(/^whatsapp:/i, '').trim();
  if (!s) return '';
  const hadLeadingPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  return hadLeadingPlus ? `+${digits}` : digits;
}
