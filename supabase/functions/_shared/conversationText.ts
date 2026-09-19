/**
 * Shared conversation-text helpers for the inbox AI edge functions (plan FR-018).
 *
 * Every function defined here is a COPY from `inbox-ai-thread-summary/index.ts`, which is
 * NOT modified this cycle — migrating it onto this module is a backlog line.
 * Keep the copies behaviourally identical to their sources:
 *   sortMessagesLikeUnifiedTimeline index.ts:59-74
 *   fetchConversationMessages       index.ts:323-331 (+ the :462-464 sort, folded in)
 * MsgRow, TranscriptOptions, stripHtml and buildTaggedTranscript moved to the
 * import-free conversationTranscript.ts (D-9) and are re-exported below, so
 * imports from this module are unchanged.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import type { MsgRow } from './conversationTranscript.ts';

export type { MsgRow, TranscriptOptions } from './conversationTranscript.ts';
export { buildTaggedTranscript, stripHtml } from './conversationTranscript.ts';

/**
 * Same ordering as usePersonUnifiedTimeline in useInboxMessages.ts.
 * Copy of index.ts:59-74. Oldest first; de-duplicates by id.
 */
export function sortMessagesLikeUnifiedTimeline(rows: MsgRow[]): MsgRow[] {
  const byId = new Map<string, MsgRow>();
  for (const m of rows) {
    byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aSent = new Date(a.sent_at ?? a.created_at).getTime();
    const bSent = new Date(b.sent_at ?? b.created_at).getTime();
    if (aSent !== bSent) return aSent - bSent;
    const aCreated = new Date(a.created_at).getTime();
    const bCreated = new Date(b.created_at).getTime();
    if (aCreated !== bCreated) return aCreated - bCreated;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Messages for one conversation, normalised to timeline order (oldest first).
 * Select + single .order() copied from index.ts:325-331 — chained .order() with
 * nullsFirst on the nullable sent_at can break PostgREST on some deployments, so
 * the final order comes from sortMessagesLikeUnifiedTimeline (index.ts:462-464).
 * Returns the error instead of throwing so a caller scoring a batch can fail one
 * conversation and continue.
 */
export async function fetchConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ messages: MsgRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from('inbox_messages')
    .select(
      'id, conversation_id, created_at, sent_at, channel, direction, body_text, from_handle, to_handle',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) return { messages: [], error };
  return { messages: sortMessagesLikeUnifiedTimeline((data ?? []) as MsgRow[]), error: null };
}
