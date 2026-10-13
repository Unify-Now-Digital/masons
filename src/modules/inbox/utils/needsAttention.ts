import { normalizeHandle } from './conversationGroupKey';
import { isOwnHandle, type OwnHandles } from './ownHandles';
import type { InboxConversation } from '../types/inbox.types';

/** FR-014 (C3c amendment): the panel's item-count choices, user-chosen. */
export const NEEDS_ATTENTION_PAGE_SIZES = [5, 10, 25] as const;
export type NeedsAttentionPageSize = (typeof NEEDS_ATTENTION_PAGE_SIZES)[number];
export const NEEDS_ATTENTION_DEFAULT_PAGE_SIZE: NeedsAttentionPageSize = 10;
/** FR-013: the shell bubble counts scored conversations at or above this. */
export const NEEDS_ATTENTION_HIGH_PRIORITY = 70;

/**
 * A panel row: the conversation plus its linked person's email/phone, embedded
 * by fetchNeedsAttentionConversations (null when unlinked or not visible).
 */
export type NeedsAttentionConversation = InboxConversation & {
  person?: { email: string | null; phone: string | null } | null;
};

/** A conversation the ranker has scored — `ai_priority` is a number, never null. */
export type ScoredConversation = NeedsAttentionConversation & { ai_priority: number };

export interface NeedsAttentionOptions {
  /**
   * The org's own handles (useOwnHandles). The panel's query already drops
   * unlinked own-handle rows server-side; linked rows are judged here by their
   * person. The re-check also catches what an ilike cannot — padded or
   * differently formatted handles.
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
 * Threads carrying one of the org's own handles that are not a customer's:
 * unlinked (sync artefacts, internal forwards — F-036), or linked to a person
 * who is ours too (a people row for an agency/org mailbox). An own-handle row
 * linked to a real customer is kept (C1d ruling) and de-duplicated by person.
 */
function isOwnHandleNotCustomer(
  conversation: NeedsAttentionConversation,
  ownHandles: OwnHandles,
): boolean {
  if (!isOwnHandle(conversation.primary_handle, ownHandles)) return false;
  if (!conversation.person_id) return true;
  const person = conversation.person;
  return !!person && (isOwnHandle(person.email, ownHandles) || isOwnHandle(person.phone, ownHandles));
}

/**
 * Dismissed in the panel with nothing newer since. ai_dismissed_at holds the
 * row's last_message_at at dismissal (20261013140000), so any newer message
 * makes last_message_at the later of the two and the row returns. Compared via
 * Date.parse, never as strings. A dismissal on a row with no parseable
 * last_message_at stays hidden until a message lands.
 */
function isDismissed(conversation: NeedsAttentionConversation): boolean {
  const dismissedMs = Date.parse(conversation.ai_dismissed_at ?? '');
  if (Number.isNaN(dismissedMs)) return false;
  const lastMs = Date.parse(conversation.last_message_at ?? '');
  if (Number.isNaN(lastMs)) return true;
  return dismissedMs >= lastMs;
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
  conversations: readonly NeedsAttentionConversation[],
  { ownHandles, mutedHandles }: NeedsAttentionOptions,
): ScoredConversation[] {
  const sorted = conversations
    .filter(
      (conversation): conversation is ScoredConversation =>
        typeof conversation.ai_priority === 'number' &&
        !isDismissed(conversation) &&
        !isHiddenConversation(conversation, mutedHandles) &&
        !isOwnHandleNotCustomer(conversation, ownHandles),
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
  conversations: readonly NeedsAttentionConversation[],
  options: NeedsAttentionOptions,
  limit: number = NEEDS_ATTENTION_DEFAULT_PAGE_SIZE,
): ScoredConversation[] {
  return selectNeedsAttentionAll(conversations, options).slice(0, limit);
}
