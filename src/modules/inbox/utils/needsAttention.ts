import { normalizeHandle } from './conversationGroupKey';
import { isOwnHandle, type OwnHandles } from './ownHandles';
import type { InboxConversation } from '../types/inbox.types';

/** FR-014 (C3c amendment): the panel's item-count choices, user-chosen. */
export const NEEDS_ATTENTION_PAGE_SIZES = [5, 10, 25] as const;
export type NeedsAttentionPageSize = (typeof NEEDS_ATTENTION_PAGE_SIZES)[number];
export const NEEDS_ATTENTION_DEFAULT_PAGE_SIZE: NeedsAttentionPageSize = 10;
/** FR-013: the shell bubble counts scored conversations at or above this. */
export const NEEDS_ATTENTION_HIGH_PRIORITY = 70;

/** A conversation the ranker has scored — `ai_priority` is a number, never null. */
export type ScoredConversation = InboxConversation & { ai_priority: number };

export interface NeedsAttentionOptions {
  /**
   * The org's own handles (useOwnHandles). The panel's query already drops
   * unlinked own-handle rows server-side; this re-check catches what an ilike
   * cannot — padded or differently formatted handles.
   */
  ownHandles: OwnHandles;
  /**
   * Normalized muted handles for the org (`useMutedSenders().mutedHandles`).
   * Hidden is not a column on the conversation — it lives in `inbox_muted_senders`
   * keyed by normalized handle — so the caller has to supply it.
   */
  mutedHandles: ReadonlySet<string>;
}

/**
 * Hidden, mirroring the customers view exactly (useCustomerThreads.ts:138): muting
 * is handle-keyed, so only an UNLINKED conversation can be hidden. One linked to a
 * person never is, whatever its handle.
 */
function isHiddenConversation(
  conversation: InboxConversation,
  mutedHandles: ReadonlySet<string>,
): boolean {
  if (conversation.person_id) return false;
  const handle = normalizeHandle(conversation.primary_handle ?? '');
  return handle !== '' && mutedHandles.has(handle);
}

/**
 * Threads carrying one of the org's own handles AND linked to nobody: sync
 * artefacts and internal forwards rather than customers waiting on us (F-036).
 * LINKED ones are kept (C3b; ruling 2026-10-13) and de-duplicated by person.
 */
function isUnlinkedOwnHandle(
  conversation: InboxConversation,
  ownHandles: OwnHandles,
): boolean {
  if (conversation.person_id) return false;
  return isOwnHandle(conversation.primary_handle, ownHandles);
}

/**
 * Sort key: never a string comparison on a timestamp. A null or unparseable
 * timestamp falls back to the epoch, so it sorts last and the comparator's
 * subtraction stays finite — two such rows must not produce NaN.
 */
function lastMessageMs(conversation: InboxConversation): number {
  const parsed = Date.parse(conversation.last_message_at ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Scored, visible conversations in panel order — UNSLICED. The shell's bubble count
 * reads this and filters to `NEEDS_ATTENTION_HIGH_PRIORITY`, so the count and the
 * list can never disagree about what qualifies.
 *
 * Returns a new array: `filter` runs before `sort`, so the query cache is never
 * sorted in place. One row per linked person: the sort puts each person's
 * highest-priority (then newest) conversation first, and only that one is kept.
 */
export function selectNeedsAttentionAll(
  conversations: readonly InboxConversation[],
  { ownHandles, mutedHandles }: NeedsAttentionOptions,
): ScoredConversation[] {
  const sorted = conversations
    .filter(
      (conversation): conversation is ScoredConversation =>
        typeof conversation.ai_priority === 'number' &&
        !isHiddenConversation(conversation, mutedHandles) &&
        !isUnlinkedOwnHandle(conversation, ownHandles),
    )
    .sort((a, b) => b.ai_priority - a.ai_priority || lastMessageMs(b) - lastMessageMs(a));
  const seenPeople = new Set<string>();
  return sorted.filter((conversation) => {
    if (!conversation.person_id) return true;
    if (seenPeople.has(conversation.person_id)) return false;
    seenPeople.add(conversation.person_id);
    return true;
  });
}

/** The panel's list: the above, capped at `limit` (FR-014, C3c amendment). */
export function selectNeedsAttention(
  conversations: readonly InboxConversation[],
  options: NeedsAttentionOptions,
  limit: number = NEEDS_ATTENTION_DEFAULT_PAGE_SIZE,
): ScoredConversation[] {
  return selectNeedsAttentionAll(conversations, options).slice(0, limit);
}
