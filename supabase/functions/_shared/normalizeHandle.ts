// Canonical handle normalization for edge functions (Deno twin).
//
// IMPORTANT: this MUST stay in lockstep with normalizeHandle in
// src/modules/inbox/utils/conversationGroupKey.ts — same email rule
// (lowercase + trim) and same phone rule (strip non-digits, keep the last
// 10 digits, so 07700900123 and +447700900123 normalize identically). The
// frontend copy stays in its own bundle; exactly two copies exist. If
// either side changes, change both.
// (twilio-sms-webhook/index.ts declares a same-named LOCAL function that is
// intentionally different — trim + 'whatsapp:'-prefix strip, feeding the
// STORED primary_handle — not a third copy of this rule; see the D1 ruling
// in specs/customer-creation-on-ingest/tasks.md.)

/**
 * Normalize a primary_handle / muted-sender handle.
 * - Email (contains '@'): lowercased, trimmed.
 * - Otherwise treated as a phone number: all non-digits stripped, last 10 digits kept.
 * - Empty/whitespace input returns '' — the caller decides the fallback.
 */
export function normalizeHandle(handle: string): string {
  const trimmed = handle.trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, '').slice(-10);
}
