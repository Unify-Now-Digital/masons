/** D-17: the server rejects more than 10 ids with a 400, so the client caps. */
export const MAX_PREFILL_CONVERSATIONS = 10;
/** D-13 / D-15: when capped, the oldest two survive (the first-contact web enquiry carries Location). */
const OLDEST_KEPT = 2;

function byCreatedThenId(a: { id: string; created_at: string }, b: { id: string; created_at: string }): number {
  return (
    Date.parse(a.created_at) - Date.parse(b.created_at) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Conversation ids to send to inbox-ai-extract-order: sorted by `created_at` ascending with
 * `id` as tie-break (D-15), then all of them, or the oldest 2 plus the newest 8 when there
 * are more than 10.
 */
export function pickPrefillConversationIds(
  rows: ReadonlyArray<{ id: string; created_at: string }>,
): string[] {
  const ids = [...rows].sort(byCreatedThenId).map((r) => r.id);
  if (ids.length <= MAX_PREFILL_CONVERSATIONS) return ids;
  return [...ids.slice(0, OLDEST_KEPT), ...ids.slice(-(MAX_PREFILL_CONVERSATIONS - OLDEST_KEPT))];
}
