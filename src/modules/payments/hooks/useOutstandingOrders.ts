import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { OutstandingOrder } from '../types/reconciliation.types';

export const outstandingKeys = {
  all: ['outstanding-orders'] as const,
  list: (filter?: string) => ['outstanding-orders', 'list', filter] as const,
};

export type OutstandingFilter = 'all' | 'deposit_only' | 'final_sent' | 'overdue_21';

async function fetchOutstandingOrders(filter?: OutstandingFilter): Promise<OutstandingOrder[]> {
  // Use the view that computes balance_due
  let query = supabase
    .from('orders_with_balance')
    .select('id, order_number, customer_name, customer_email, customer_phone, person_id, sku, material, color, location, value, total_order_value, amount_paid, balance_due, final_invoice_sent_at, final_invoice_id, deposit_date, due_date, created_at')
    .gt('balance_due', 0)
    .order('balance_due', { ascending: false });

  if (filter === 'deposit_only') {
    query = query.gt('amount_paid', 0).is('final_invoice_sent_at', null);
  } else if (filter === 'final_sent') {
    query = query.not('final_invoice_sent_at', 'is', null);
  } else if (filter === 'overdue_21') {
    const twentyOneDaysAgo = new Date();
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
    query = query.not('final_invoice_sent_at', 'is', null)
      .lt('final_invoice_sent_at', twentyOneDaysAgo.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OutstandingOrder[];
}

export function useOutstandingOrders(filter?: OutstandingFilter) {
  return useQuery({
    queryKey: outstandingKeys.list(filter),
    queryFn: () => fetchOutstandingOrders(filter),
  });
}
