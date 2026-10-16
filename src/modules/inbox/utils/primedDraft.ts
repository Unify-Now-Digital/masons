/**
 * Prepared-reply drafts for the Priority list. A draft is only ever placed in the
 * composer (empty composer only); nothing here sends. Keyed by conversation id,
 * with a short-lived fallback for the thread that opens right after a priority
 * row is chosen (the person's open thread may not be the job's conversation id).
 * The fallback is scoped to that person so it cannot land in the previous thread.
 */
const drafts = new Map<string, PrimedRecord>();
let latest: PrimedLatest | null = null;
const FALLBACK_MS = 15_000;
export const PRIME_DRAFT_EVENT = 'mason:prime-draft';

export type DraftBasis = 'template' | 'suggestion' | 'edited';

export interface PrimedMeta {
  basis?: DraftBasis;
  /** When this draft's context was written. A missing suggestion time counts as newest. */
  contextAt?: number | null;
  messageId?: string | null;
}

export interface PrimedRecord {
  text: string;
  basis: DraftBasis;
  contextAt: number | null;
  messageId: string | null;
}

export interface PrimedLatest {
  text: string;
  at: number;
  conversationId: string | null;
  /** Person (or other selection) the draft was primed for. Null for older callers. */
  scopeKey: string | null;
}

function finiteTime(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const TOPIC_STOP = new Set([
  'about', 'after', 'again', 'could', 'please', 'thank', 'thanks', 'there', 'their',
  'would', 'which', 'while', 'where', 'hello', 'kind', 'regards', 'happy',
]);

/** Significant words, for deciding whether two texts are about the same thing. */
export function topicWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/\p{L}{5,}/gu) ?? [];
  return new Set(words.filter((word) => !TOPIC_STOP.has(word)));
}

/** True when the texts share a significant word, or when one of them has none to compare. */
export function sharesTopic(draft: string, context: string): boolean {
  const left = topicWords(draft);
  const right = topicWords(context);
  if (left.size === 0 || right.size === 0) return true;
  for (const word of left) if (right.has(word)) return true;
  return false;
}

/**
 * The suggestion is the latest context when its time is missing or at least as
 * new as the template. Otherwise the template still stands.
 */
export function choosePreparedText(
  template: { text: string; contextAt: number | null } | null,
  suggestion: { text: string; contextAt: number | null } | null,
): string | null {
  const suggested = suggestion?.text.trim() ? suggestion.text : null;
  const templated = template?.text.trim() ? template.text : null;
  if (suggested) {
    if (!templated) return suggested;
    if (suggestion!.contextAt == null) return suggested;
    if (template!.contextAt == null || suggestion!.contextAt >= template!.contextAt) return suggested;
  }
  return templated;
}

export function primeDraft(
  conversationId: string | null,
  text: string,
  scopeKey?: string | null,
  meta?: PrimedMeta,
) {
  const record: PrimedRecord = {
    text,
    basis: meta?.basis ?? 'template',
    contextAt: finiteTime(meta?.contextAt),
    messageId: meta?.messageId ?? null,
  };
  if (conversationId) drafts.set(conversationId, record);
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
  return drafts.get(conversationId)?.text ?? null;
}

/** Basis and context time for the stored draft. Null when nothing is primed. */
export function primedRecord(conversationId: string | null | undefined): PrimedRecord | null {
  if (!conversationId) return null;
  return drafts.get(conversationId) ?? null;
}

function draftTexts(): Map<string, string> {
  return new Map([...drafts].map(([id, record]) => [id, record.text]));
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
  return primedDraftForThread(conversationIds, scopeKey, draftTexts(), latest);
}
