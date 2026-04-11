import { supabase } from '@/shared/lib/supabase';
import type { PermitOrder, OrderComment, OrderCommentInsert } from '../types/permitTracker.types';

/**
 * Fetch all orders in active permit stages (form_sent, customer_completed, pending).
 * Joins cemetery data via cemetery_id.
 */
export async function fetchPermitOrders(organizationId: string): Promise<PermitOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, customer_name, customer_email, person_name,
      order_type, location, material,
      permit_status, permit_form_sent_at, permit_submitted_at,
      permit_approved_at, permit_correspondence_email,
      permit_cemetery_email, permit_gmail_thread_id,
      cemetery_id, created_at, updated_at,
      cemetery:cemeteries(id, name, primary_email, phone, address, avg_approval_days, notes, created_at, updated_at)
    `)
    .eq('organization_id', organizationId)
    .in('permit_status', ['form_sent', 'customer_completed', 'pending'])
    .order('permit_submitted_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    // Map person_name as deceased_name for display
    deceased_name: row.person_name as string | null,
    // Map material as memorial_type for display
    memorial_type: row.material as string | null,
    // cemetery comes as an object or null from the join
    cemetery: row.cemetery && typeof row.cemetery === 'object' && !Array.isArray(row.cemetery)
      ? row.cemetery
      : null,
  })) as PermitOrder[];
}

/**
 * Update permit-related fields on an order.
 */
export async function updatePermitOrder(
  id: string,
  updates: Partial<Pick<PermitOrder,
    'permit_status' | 'permit_form_sent_at' | 'permit_submitted_at' |
    'permit_approved_at' | 'permit_correspondence_email' |
    'permit_cemetery_email' | 'permit_gmail_thread_id' | 'cemetery_id'
  >>
) {
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Create a comment/note on an order.
 */
export async function createOrderComment(
  organizationId: string,
  comment: OrderCommentInsert,
): Promise<OrderComment> {
  const { data, error } = await supabase
    .from('order_comments')
    .insert({ ...comment, organization_id: organizationId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as OrderComment;
}

/**
 * Fetch comments for an order.
 */
export async function fetchOrderComments(
  organizationId: string,
  orderId: string,
): Promise<OrderComment[]> {
  const { data, error } = await supabase
    .from('order_comments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as OrderComment[];
}
