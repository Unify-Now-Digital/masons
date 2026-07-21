// Canonical grouping key for inbox conversations (grouped inbox view).
//
// IMPORTANT: normalizeHandle MUST stay in lockstep with the auto-link matching in
// supabase/functions/_shared/autoLinkConversation.ts — same email rule
// (lowercase + trim) and same phone rule (strip non-digits, compare on the last
// 10 digits, so 07700900123 and +447700900123 normalize identically). If either
// side changes, change both.

import type { InboxConversation } from '../types/inbox.types';

/**
 * Normalize a primary_handle for grouping.
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

/**
 * Grouping key for one conversation:
 * - linked        → 'p:<person_id>'
 * - unlinked      → 'h:<normalized handle>'
 * - degenerate    → 'c:<conversation id>' (person_id null and the handle
 *   normalizes to '' — e.g. a phone handle with no digits). Keyed by the
 *   conversation's own id so degenerate rows group alone instead of all
 *   merging into a single '' bucket.
 */
export function conversationGroupKey(
  conv: Pick<InboxConversation, 'person_id' | 'primary_handle'> & { id?: string },
): string {
  if (conv.person_id) return `p:${conv.person_id}`;
  const normalized = normalizeHandle(conv.primary_handle ?? '');
  if (normalized) return `h:${normalized}`;
  return `c:${conv.id ?? ''}`;
}
