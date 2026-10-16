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
const PREVIEW_CHANNELS = new Set(['email', 'sms', 'whatsapp', 'web']);

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

function previewChannel(channel: string): InboxMessage['channel'] | null {
  if (channel === 'email' || channel === 'sms' || channel === 'whatsapp' || channel === 'web') return channel;
  return null;
}

/**
 * A conversation can store last_message_preview with no inbox_messages row
 * (GHL / web threads, and some linked phone threads). One synthetic message
 * per such conversation, so the open thread matches the list.
 */
export function withPreviewFallback(existing: InboxMessage[], previews: UnlinkedPreviewRow[]): InboxMessage[] {
  const covered = new Set(existing.map((message) => message.conversation_id));
  const extra: InboxMessage[] = [];
  for (const row of previews) {
    if (covered.has(row.id)) continue;
    const text = row.last_message_preview?.trim();
    const channel = row.channel ? previewChannel(row.channel) : null;
    if (!text || !channel || !PREVIEW_CHANNELS.has(channel)) continue;
    const at = row.last_message_at || new Date(0).toISOString();
    extra.push({
      id: `preview:${row.id}`,
      conversation_id: row.id,
      channel,
      direction: 'inbound',
      from_handle: row.primary_handle || '',
      to_handle: '',
      body_text: text,
      subject: row.subject,
      sent_at: at,
      status: 'delivered',
      message_type: 'message',
      created_at: at,
      updated_at: at,
    });
    covered.add(row.id);
  }
  return extra.length ? [...existing, ...extra] : existing;
}

/**
 * Direct inbox_messages selects miss SMS/WhatsApp rows whose organization_id is null.
 * The conversation preview still has the text. Merge the RPC rows, then fill any
 * conversation that still has a preview and no message row.
 */
export function mergeUnlinkedMessages(
  direct: InboxMessage[],
  fromRpc: InboxMessage[],
  previews: UnlinkedPreviewRow[],
): InboxMessage[] {
  const byId = new Map<string, InboxMessage>();
  for (const message of [...direct, ...fromRpc]) byId.set(message.id, message);
  return withPreviewFallback([...byId.values()], previews);
}
