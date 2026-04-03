import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { OrderPayment } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';
import { SAMPLE_UNMATCHED_PAYMENTS } from '../utils/sampleData';

async function fetchUnmatchedPayments(): Promise<OrderPayment[]> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('*, orders(id, order_number, customer_name, person_id)')
    .eq('status', 'unmatched')
    .order('amount', { ascending: false });

  if (error) throw error;
  const results = (data ?? []) as unknown as OrderPayment[];

  // Fallback to sample data when DB is empty (migration not applied or no data yet)
  if (results.length === 0) return SAMPLE_UNMATCHED_PAYMENTS;
  return results;
}

export function useUnmatchedPayments() {
  return useQuery({
    queryKey: orderPaymentsKeys.unmatched(),
    queryFn: fetchUnmatchedPayments,
  });
}
