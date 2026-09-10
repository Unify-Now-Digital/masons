import { normalizeHandle } from './conversationGroupKey';
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
   * The org's own connected mailbox (`gmail_connections.email_address`), or null
   * when there is no connection row or no address on it. Null disables the
   * org-mailbox exclusion rather than excluding everything.
   */
  orgMailbox: string | null;
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
 * Threads carrying the org's own mailbox as their handle AND linked to nobody.
 * They are sync artefacts rather than customers waiting on us — see the C4
 * findings on gmail-sync-now (:308 direction test, :527/:563 SENT create).
 * The LINKED ones are deliberately kept: on SM today each is a real person with a
 * single thread, so the exclusion is unlinked-only.
 */
function isUnlinkedOrgMailbox(
  conversation: InboxConversation,
  orgMailbox: string | null,
): boolean {
  if (conversation.person_id) return false;
  const mailbox = (orgMailbox ?? '').trim().toLowerCase();
  if (!mailbox) return false;
  return (conversation.primary_handle ?? '').trim().toLowerCase() === mailbox;
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
 * sorted in place.
 */
export function selectNeedsAttentionAll(
  conversations: readonly InboxConversation[],
  { orgMailbox, mutedHandles }: NeedsAttentionOptions,
): ScoredConversation[] {
  return conversations
    .filter(
      (conversation): conversation is ScoredConversation =>
        typeof conversation.ai_priority === 'number' &&
        !isHiddenConversation(conversation, mutedHandles) &&
        !isUnlinkedOrgMailbox(conversation, orgMailbox),
    )
    .sort((a, b) => b.ai_priority - a.ai_priority || lastMessageMs(b) - lastMessageMs(a));
}

/** The panel's list: the above, capped at `limit` (FR-014, C3c amendment). */
export function selectNeedsAttention(
  conversations: readonly InboxConversation[],
  options: NeedsAttentionOptions,
  limit: number = NEEDS_ATTENTION_DEFAULT_PAGE_SIZE,
): ScoredConversation[] {
  return selectNeedsAttentionAll(conversations, options).slice(0, limit);
}
