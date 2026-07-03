import { supabase } from '@/shared/lib/supabase';
import type { InboxMessage, InboxMessageInsert } from '../types/inbox.types';

export async function fetchMessagesByConversation(conversationId: string) {
  // Messages are ORG-scoped (feature 016): fetch by conversation only. Do NOT add `.eq('user_id', …)`
  // — org members share email threads and RLS enforces org membership (FR-018).
  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  return (data || []) as InboxMessage[];
}

/** Client-only: fetch messages for multiple conversations, sorted by sent_at ascending. */
export async function fetchMessagesByConversationIds(conversationIds: string[]): Promise<InboxMessage[]> {
  if (conversationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  const list = (data || []) as InboxMessage[];
  list.sort((a, b) => new Date(a.sent_at || a.created_at).getTime() - new Date(b.sent_at || b.created_at).getTime());
  return list;
}

export async function createMessage(message: InboxMessageInsert) {
  const { data: parent, error: parentErr } = await supabase
    .from('inbox_conversations')
    .select('organization_id')
    .eq('id', message.conversation_id)
    .single();

  if (parentErr || !parent?.organization_id) {
    throw new Error('Cannot send message: conversation organisation not found');
  }

  const { data, error } = await supabase
    .from('inbox_messages')
    .insert({ ...message, organization_id: parent.organization_id })
    .select()
    .single();

  if (error) throw error;
  return data as InboxMessage;
}
