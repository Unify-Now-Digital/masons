/**
 * Prepared-reply drafts for the Priority list. A draft is only ever placed in the
 * composer (empty composer only); nothing here sends. Keyed by conversation id,
 * with a short-lived fallback for the thread that opens right after a priority
 * row is chosen (the person's open thread may not be the job's conversation id).
 */
const drafts = new Map<string, string>();
let latest: { text: string; at: number } | null = null;
const FALLBACK_MS = 15_000;
export const PRIME_DRAFT_EVENT = 'mason:prime-draft';

export function primeDraft(conversationId: string | null, text: string) {
  if (conversationId) drafts.set(conversationId, text);
  latest = { text, at: Date.now() };
  window.dispatchEvent(new CustomEvent(PRIME_DRAFT_EVENT, { detail: { conversationId } }));
}
/** Non-destructive: the thread may remount; the composer only fills when empty. */
export function clearPrimedDraft(conversationId: string) { drafts.delete(conversationId); }
/** The draft stored for this conversation, with no short-lived fallback. */
export function peekPrimedDraft(conversationId: string | null | undefined): string | null {
  if (!conversationId) return null;
  return drafts.get(conversationId) ?? null;
}

export function takePrimedDraft(conversationIds: (string | null | undefined)[]): string | null {
  for (const id of conversationIds) {
    if (id && drafts.has(id)) return drafts.get(id)!;
  }
  if (latest && Date.now() - latest.at < FALLBACK_MS) return latest.text;
  return null;
}
