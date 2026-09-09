/**
 * Shared conversation-text helpers for the inbox AI edge functions (plan FR-018).
 *
 * Every export here is a COPY from `inbox-ai-thread-summary/index.ts`, which is
 * NOT modified this cycle — migrating it onto this module is a backlog line.
 * Keep the copies behaviourally identical to their sources:
 *   MsgRow                          index.ts:33-43
 *   stripHtml                       index.ts:15-23
 *   sortMessagesLikeUnifiedTimeline index.ts:59-74
 *   fetchConversationMessages       index.ts:323-331 (+ the :462-464 sort, folded in)
 *   buildTaggedTranscript           index.ts:529-532 (window) + :534-539 (line format)
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

/** Copy of index.ts:33-43. */
export interface MsgRow {
  id: string;
  conversation_id: string;
  sent_at: string | null;
  created_at: string;
  channel: string;
  direction: string;
  body_text: string | null;
  from_handle: string;
  to_handle: string;
}

export interface TranscriptOptions {
  /** Newest N messages kept for the prompt. */
  maxMessages: number;
  /** Hard cap on the joined transcript length, in characters. */
  charCap: number;
}

/** Copy of index.ts:15-23. */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

/**
 * Tagged transcript, oldest to newest within the window.
 * Window = newest `maxMessages` (index.ts:529-532); line format identical to
 * index.ts:534-539. Oldest whole lines are then dropped until the joined text
 * fits `charCap`; a lone line still over the cap is truncated rather than
 * dropped, so a non-empty thread never yields an empty transcript.
 */
export function buildTaggedTranscript(messages: MsgRow[], options: TranscriptOptions): string {
  const { maxMessages, charCap } = options;
  const forPrompt = messages.length > maxMessages ? messages.slice(-maxMessages) : messages;

  const lines = forPrompt.map((m) => {
    const raw = m.body_text ?? '';
    const text =
      m.channel === 'email' ? stripHtml(raw) || '(No message body)' : raw.trim() || '(No message body)';
    const ts = m.sent_at ?? m.created_at;
    return `[${m.channel}] [${m.direction}] ${ts} from=${m.from_handle} to=${m.to_handle}: ${text}`;
  });

  while (lines.length > 1 && lines.join('\n').length > charCap) {
    lines.shift();
  }

  const joined = lines.join('\n');
  return joined.length > charCap ? joined.slice(0, charCap) : joined;
}
