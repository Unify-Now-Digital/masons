import { supabase } from '@/shared/lib/supabase';
import type { InboxMessage, InboxMessageInsert } from '../types/inbox.types';

export async function fetchMessagesByConversation(conversationId: string) {
  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  return (data || []) as InboxMessage[];
}

export async function createMessage(message: InboxMessageInsert) {
  const { data, error } = await supabase
    .from('inbox_messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data as InboxMessage;
}
