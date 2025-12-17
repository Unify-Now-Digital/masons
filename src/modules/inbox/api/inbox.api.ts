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
 * Fetch all messages associated with a specific order
 * @param orderId - UUID of the order
 * @returns Array of Message objects ordered by creation date (newest first)
 */
export async function fetchMessagesByOrder(orderId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Message[];
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

  const { data, error } = await supabase
    .from('messages')
    .select('order_id')
    .in('order_id', orderIds)
    .not('order_id', 'is', null);
  
  if (error) throw error;
  
  // Aggregate counts by order_id
  const counts: Record<string, number> = {};
  
  // Initialize all order IDs with 0
  orderIds.forEach(id => {
    counts[id] = 0;
  });
  
  // Count messages per order
  if (data) {
    data.forEach(message => {
      if (message.order_id) {
        counts[message.order_id] = (counts[message.order_id] || 0) + 1;
      }
    });
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

