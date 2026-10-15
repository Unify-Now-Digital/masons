import { supabase } from '@/shared/lib/supabase';
import { messagePreviewText } from '../utils/messagePreviewText';

interface PreviewMessage {
  body_text?: string | null;
  subject?: string | null;
}

/**
 * Latest message text per conversation, for rows whose stored preview is empty.
 * The embedded limit is one message per conversation (newest first).
 */
export async function fetchLatestMessagePreviews(conversationIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (conversationIds.length === 0) return out;
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('id, inbox_messages(body_text, subject, sent_at)')
    .in('id', conversationIds)
    .order('sent_at', { ascending: false, referencedTable: 'inbox_messages' })
    .limit(1, { referencedTable: 'inbox_messages' });
  if (error) throw error;
  for (const row of (data ?? []) as { id: string; inbox_messages?: PreviewMessage[] | PreviewMessage | null }[]) {
    const embedded = row.inbox_messages;
    const message = Array.isArray(embedded) ? embedded[0] : embedded;
    const text = messagePreviewText(message?.body_text, message?.subject);
    if (text) out.set(row.id, text);
  }
  return out;
}
