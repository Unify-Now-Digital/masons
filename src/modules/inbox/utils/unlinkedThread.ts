import type { InboxMessage } from '../types/inbox.types';

export interface UnlinkedPreviewRow {
  id: string;
  channel: string | null;
  primary_handle: string | null;
  person_id: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  subject: string | null;
}

const THREAD_CHANNELS = new Set(['email', 'sms', 'whatsapp']);

/** Handles the security-definer RPC can see when a direct message select is hidden by RLS. */
export function unlinkedHandleKeys(
  rows: UnlinkedPreviewRow[],
): { channel: 'email' | 'sms' | 'whatsapp'; handle: string }[] {
  const seen = new Set<string>();
  const out: { channel: 'email' | 'sms' | 'whatsapp'; handle: string }[] = [];
  for (const row of rows) {
    if (row.person_id || !row.channel || !row.primary_handle?.trim()) continue;
    if (!THREAD_CHANNELS.has(row.channel)) continue;
    const key = `${row.channel}:${row.primary_handle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ channel: row.channel as 'email' | 'sms' | 'whatsapp', handle: row.primary_handle });
  }
  return out;
}

/**
 * Direct inbox_messages selects miss SMS/WhatsApp rows whose organization_id is null.
 * The conversation preview still has the text. Merge the RPC rows, and if both are
 * empty keep the stored preview so the thread matches the list.
 */
export function mergeUnlinkedMessages(
  direct: InboxMessage[],
  fromRpc: InboxMessage[],
  previews: UnlinkedPreviewRow[],
): InboxMessage[] {
  const byId = new Map<string, InboxMessage>();
  for (const message of [...direct, ...fromRpc]) byId.set(message.id, message);
  if (byId.size > 0) return [...byId.values()];
  const preview = previews.find((row) => (
    !!row.last_message_preview?.trim() && !!row.channel && THREAD_CHANNELS.has(row.channel)
  ));
  if (!preview?.channel) return [];
  const at = preview.last_message_at || new Date(0).toISOString();
  return [{
    id: `preview:${preview.id}`,
    conversation_id: preview.id,
    channel: preview.channel as 'email' | 'sms' | 'whatsapp',
    direction: 'inbound',
    from_handle: preview.primary_handle || '',
    to_handle: '',
    body_text: preview.last_message_preview!.trim(),
    subject: preview.subject,
    sent_at: at,
    status: 'delivered',
    message_type: 'message',
    created_at: at,
    updated_at: at,
  }];
}
