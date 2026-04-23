import { supabase } from '@/shared/lib/supabase';
import type { InboxConversation, InboxConversationInsert, InboxConversationUpdate, ConversationFilters } from '../types/inbox.types';
import { deleteConversationsRpc } from './conversationsDelete.rpc';

/** Payload to create a new conversation (e.g. from New Conversation modal). */
export interface CreateConversationPayload {
  channel: 'email' | 'sms' | 'whatsapp';
  primary_handle: string;
  subject?: string | null;
  person_id?: string | null;
}

export async function fetchConversations(organizationId: string, filters?: ConversationFilters) {
  let query = supabase
    .from('inbox_conversations')
    .select('*')
    .eq('organization_id', organizationId);

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else {
    // Default: open conversations only
    query = query.eq('status', 'open');
  }

  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }

  if (filters?.unread_only) {
    query = query.gt('unread_count', 0);
  }

  if (filters?.person_id != null && filters.person_id !== '') {
    query = query.eq('person_id', filters.person_id);
  } else if (filters?.unlinked_only) {
    query = query.is('person_id', null);
  }

  if (filters?.primary_handle_exact != null && filters.primary_handle_exact.trim() !== '') {
    query = query.eq('primary_handle', filters.primary_handle_exact.trim());
  }

  // Search: ILIKE over primary_handle, subject, last_message_preview
  if (filters?.search && filters.search.trim()) {
    const searchTerm = filters.search.trim();
    query = query.or(`primary_handle.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%,last_message_preview.ilike.%${searchTerm}%`);
  }

  // Sort: last_message_at DESC NULLS LAST, fallback created_at DESC
  query = query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as InboxConversation[];
}

export async function fetchConversation(id: string) {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as InboxConversation;
}

export async function createConversation(payload: CreateConversationPayload): Promise<InboxConversation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to create a conversation');

  const row: InboxConversationInsert & { user_id: string } = {
    channel: payload.channel,
    primary_handle: payload.primary_handle.trim(),
    subject: payload.subject?.trim() || null,
    status: 'open',
    unread_count: 0,
    last_message_at: null,
    last_message_preview: null,
    person_id: payload.person_id ?? null,
    link_state: payload.person_id ? 'linked' : 'unlinked',
    link_meta: {},
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from('inbox_conversations')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data as InboxConversation;
}

export async function updateConversation(id: string, updates: InboxConversationUpdate) {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as InboxConversation;
}

export async function markConversationsAsRead(ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({ unread_count: 0 })
    .in('id', ids)
    .select('*');

  if (error) throw error;
  return (data || []) as InboxConversation[];
}

export async function markConversationsAsUnread(ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('inbox_conversations')
    // For a count-only model, represent "unread" as at least 1 unread message
    .update({ unread_count: 1 })
    .in('id', ids)
    .select('*');

  if (error) throw error;
  return (data || []) as InboxConversation[];
}

export async function archiveConversations(ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({ status: 'archived' })
    .in('id', ids)
    .select();

  if (error) throw error;
  return (data || []) as InboxConversation[];
}

export async function deleteConversations(ids: string[]) {
  return deleteConversationsRpc(ids);
}

export async function linkConversation(conversationId: string, personId: string): Promise<InboxConversation> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({
      person_id: personId,
      link_state: 'linked',
      link_meta: {},
    })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) throw error;
  return data as InboxConversation;
}

export async function unlinkConversation(conversationId: string): Promise<InboxConversation> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({
      person_id: null,
      link_state: 'unlinked',
      link_meta: {},
    })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    console.error('[unlinkConversation] failed to unlink conversation', conversationId, error);
    throw error;
  }
  return data as InboxConversation;
}

export async function linkConversations(
  conversationIds: string[],
  personId: string
): Promise<InboxConversation[]> {
  if (conversationIds.length === 0) return [];

  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({
      person_id: personId,
      link_state: 'linked',
      link_meta: {},
    })
    .in('id', conversationIds)
    .select();

  if (error) throw error;
  return (data || []) as InboxConversation[];
}

export async function unlinkConversations(conversationIds: string[]): Promise<InboxConversation[]> {
  if (conversationIds.length === 0) return [];

  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({
      person_id: null,
      link_state: 'unlinked',
      link_meta: {},
    })
    .in('id', conversationIds)
    .select();

  if (error) throw error;
  return (data || []) as InboxConversation[];
}
