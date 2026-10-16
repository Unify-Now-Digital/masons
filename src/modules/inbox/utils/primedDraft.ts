/**
 * Prepared-reply drafts for the Priority list. A draft is only ever placed in the
 * composer (empty composer only); nothing here sends. Keyed by conversation id,
 * with a short-lived fallback for the thread that opens right after a priority
 * row is chosen (the person's open thread may not be the job's conversation id).
 * The fallback is scoped to that person so it cannot land in the previous thread.
 */
const drafts = new Map<string, string>();
let latest: PrimedLatest | null = null;
const FALLBACK_MS = 15_000;
export const PRIME_DRAFT_EVENT = 'mason:prime-draft';

export interface PrimedLatest {
  text: string;
  at: number;
  conversationId: string | null;
  /** Person (or other selection) the draft was primed for. Null for older callers. */
  scopeKey: string | null;
}

export function primeDraft(conversationId: string | null, text: string, scopeKey?: string | null) {
  if (conversationId) drafts.set(conversationId, text);
  latest = { text, at: Date.now(), conversationId, scopeKey: scopeKey ?? null };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRIME_DRAFT_EVENT, { detail: { conversationId, scopeKey: scopeKey ?? null } }));
  }
}
/** Non-destructive: the thread may remount; the composer only fills when empty. */
export function clearPrimedDraft(conversationId: string) { drafts.delete(conversationId); }
/** The draft stored for this conversation, with no short-lived fallback. */
export function peekPrimedDraft(conversationId: string | null | undefined): string | null {
  if (!conversationId) return null;
  return drafts.get(conversationId) ?? null;
}

/**
 * Draft text for the thread on screen. A primed reply is returned only when it
 * belongs to one of this thread's conversations, or to the same person while the
 * channel map is still settling. It is never applied to a different person.
 */
export function primedDraftForThread(
  conversationIds: readonly (string | null | undefined)[],
  scopeKey: string | null | undefined,
  byId: ReadonlyMap<string, string>,
  pending: PrimedLatest | null,
  now = Date.now(),
): string | null {
  for (const id of conversationIds) {
    if (id && byId.has(id)) return byId.get(id)!;
  }
  if (!pending || now - pending.at >= FALLBACK_MS) return null;
  if (pending.scopeKey) {
    return scopeKey && scopeKey === pending.scopeKey ? pending.text : null;
  }
  const known = conversationIds.filter((id): id is string => !!id);
  if (pending.conversationId && known.length > 0 && !known.includes(pending.conversationId)) return null;
  return pending.text;
}

export function takePrimedDraft(
  conversationIds: (string | null | undefined)[],
  scopeKey?: string | null,
): string | null {
  return primedDraftForThread(conversationIds, scopeKey, drafts, latest);
}
