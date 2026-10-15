import { messagePreviewText } from './messagePreviewText';

export interface PreviewMessageRow {
  conversation_id: string;
  body_text?: string | null;
  body_html?: string | null;
  subject?: string | null;
  sent_at?: string | null;
}

/** Newest non-empty body per conversation. Later rows lose to an earlier one. */
export function previewFromMessages(rows: readonly PreviewMessageRow[]): Map<string, string> {
  const sorted = [...rows].sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''));
  const out = new Map<string, string>();
  for (const row of sorted) {
    if (!row.conversation_id || out.has(row.conversation_id)) continue;
    const plain = (row.body_text ?? '').trim();
    const html = (row.body_html ?? '').trim();
    const text = messagePreviewText(plain || html, row.subject);
    if (text && text !== 'No preview') out.set(row.conversation_id, text);
  }
  return out;
}
