import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { OrderPayment } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';

async function fetchMatchedPayments(source?: string): Promise<OrderPayment[]> {
  let query = supabase
    .from('order_payments')
    .select('*, orders(id, order_number, customer_name, person_id)')
    .eq('status', 'matched')
    .order('received_at', { ascending: false });

  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OrderPayment[];
}

export function useMatchedPayments(source?: string) {
  return useQuery({
    queryKey: orderPaymentsKeys.matched(source),
    queryFn: () => fetchMatchedPayments(source),
  });
}
