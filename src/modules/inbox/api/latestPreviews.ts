import { supabase } from '@/shared/lib/supabase';
import { previewFromMessages, type PreviewMessageRow } from '../utils/previewFromMessages';

/**
 * Latest message text per conversation, read from inbox_messages itself.
 * An embedded limit on inbox_conversations was not returning a body for
 * several threads, so this queries the message table directly.
 */
export async function fetchLatestMessagePreviews(conversationIds: string[]): Promise<Map<string, string>> {
  const want = [...new Set(conversationIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (want.length === 0) return out;
  const pageSize = 400;
  for (let start = 0; start < want.length; start += 80) {
    const ids = want.slice(start, start + 80);
    const pending = new Set(ids);
    for (let page = 0; page < 5 && pending.size > 0; page += 1) {
      const from = page * pageSize;
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('conversation_id, body_text, body_html, subject, sent_at')
        .in('conversation_id', ids)
        .order('sent_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as PreviewMessageRow[];
      for (const [id, text] of previewFromMessages(rows)) {
        if (pending.has(id) && !out.has(id)) {
          out.set(id, text);
          pending.delete(id);
        }
      }
      if (rows.length < pageSize) break;
    }
  }
  return out;
}
