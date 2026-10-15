import { supabase } from '@/shared/lib/supabase';
import type { Message, MessageInsert, MessageUpdate } from '../types/inbox.types';

export async function fetchMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Message[];
}

export async function fetchMessage(id: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Message;
}

export async function fetchThreadMessages(threadId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data as Message[];
}

/**
 * There is no `public.messages` table. Order threads live on `inbox_conversations.order_id`
 * and their bodies on `inbox_messages`. Map those rows onto the legacy Message shape the
 * order panel already reads (`from_name`, `content`, `created_at`).
 */
interface InboxMessageForOrder {
  id: string;
  conversation_id: string;
  channel: string;
  direction: string;
  from_handle: string | null;
  subject: string | null;
  body_text: string | null;
  created_at: string | null;
  sent_at: string | null;
}

function toLegacyOrderMessage(row: InboxMessageForOrder, orderId: string): Message {
  const channel = row.channel;
  const phone = channel === 'sms' || channel === 'whatsapp';
  return {
    id: row.id,
    order_id: orderId,
    company_id: null,
    thread_id: row.conversation_id,
    type: channel === 'email' ? 'email' : phone ? 'phone' : 'note',
    direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
    from_name: row.from_handle?.trim() || 'Unknown',
    from_email: channel === 'email' ? row.from_handle : null,
    from_phone: phone ? row.from_handle : null,
    subject: row.subject,
    content: row.body_text ?? '',
    is_read: true,
    priority: 'medium',
    created_at: row.created_at ?? row.sent_at ?? new Date(0).toISOString(),
    updated_at: row.sent_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

const IN_CHUNK = 100;

async function conversationIdsForOrders(orderIds: string[]): Promise<Map<string, string>> {
  const convoToOrder = new Map<string, string>();
  for (let i = 0; i < orderIds.length; i += IN_CHUNK) {
    const slice = orderIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('inbox_conversations')
      .select('id, order_id')
      .in('order_id', slice);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.order_id) convoToOrder.set(row.id as string, row.order_id as string);
    }
  }
  return convoToOrder;
}

/**
 * Fetch messages linked to an order via its inbox conversations.
 * @param orderId - UUID of the order
 * @returns Array of Message objects, newest first
 */
export async function fetchMessagesByOrder(orderId: string) {
  const convoToOrder = await conversationIdsForOrders([orderId]);
  const ids = [...convoToOrder.keys()];
  if (ids.length === 0) return [];

  const rows: InboxMessageForOrder[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const slice = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('inbox_messages')
      .select('id, conversation_id, channel, direction, from_handle, subject, body_text, created_at, sent_at')
      .in('conversation_id', slice)
      .order('sent_at', { ascending: false });
    if (error) throw error;
    rows.push(...((data ?? []) as InboxMessageForOrder[]));
  }
  rows.sort((a, b) => (b.sent_at ?? b.created_at ?? '').localeCompare(a.sent_at ?? a.created_at ?? ''));
  return rows.map((row) => toLegacyOrderMessage(row, orderId));
}

/**
 * Fetch all messages associated with a specific company
 * @param companyId - UUID of the company
 * @returns Array of Message objects ordered by creation date (newest first)
 */
export async function fetchMessagesByCompany(companyId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Message[];
}

/**
 * Fetch message counts for multiple orders in a single query
 * @param orderIds - Array of order UUIDs
 * @returns Map of orderId -> message count
 */
export async function fetchMessageCountsByOrders(orderIds: string[]): Promise<Record<string, number>> {
  if (orderIds.length === 0) {
    return {};
  }

  const counts: Record<string, number> = {};
  orderIds.forEach((id) => {
    counts[id] = 0;
  });

  const convoToOrder = await conversationIdsForOrders(orderIds);
  const convoIds = [...convoToOrder.keys()];
  for (let i = 0; i < convoIds.length; i += IN_CHUNK) {
    const slice = convoIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('inbox_messages')
      .select('conversation_id')
      .in('conversation_id', slice);
    if (error) throw error;
    for (const row of data ?? []) {
      const orderId = convoToOrder.get(row.conversation_id as string);
      if (orderId) counts[orderId] = (counts[orderId] ?? 0) + 1;
    }
  }

  return counts;
}

export async function createMessage(message: MessageInsert) {
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();
  
  if (error) throw error;
  return data as Message;
}

export async function updateMessage(id: string, updates: MessageUpdate) {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Message;
}

export async function markMessageAsRead(id: string) {
  return updateMessage(id, { is_read: true });
}

export async function deleteMessage(id: string) {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

