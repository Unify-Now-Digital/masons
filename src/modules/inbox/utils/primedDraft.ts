/**
 * Prepared-reply drafts for the Priority list. A draft is only ever placed in the
 * composer (empty composer only); nothing here sends. Keyed by conversation id.
 */
const drafts = new Map<string, string>();
export const PRIME_DRAFT_EVENT = 'mason:prime-draft';

export function primeDraft(conversationId: string, text: string) {
  drafts.set(conversationId, text);
  window.dispatchEvent(new CustomEvent(PRIME_DRAFT_EVENT, { detail: { conversationId } }));
}
export function takePrimedDraft(conversationIds: (string | null | undefined)[]): string | null {
  for (const id of conversationIds) {
    if (id && drafts.has(id)) { const t = drafts.get(id)!; drafts.delete(id); return t; }
  }
  return null;
}
