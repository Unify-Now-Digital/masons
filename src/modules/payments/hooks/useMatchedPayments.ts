import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { OrderPayment } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';
import { SAMPLE_MATCHED_PAYMENTS } from '../utils/sampleData';

async function fetchMatchedPayments(source?: string): Promise<OrderPayment[]> {
  let query = supabase
    .from('order_payments')
    .select('*, orders(id, order_number, customer_name, person_id)')
    .eq('status', 'matched')
    .order('received_at', { ascending: false });

  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) throw error;
  const results = (data ?? []) as unknown as OrderPayment[];

  // Fallback to sample data when DB is empty
  if (results.length === 0) {
    const samples = source
      ? SAMPLE_MATCHED_PAYMENTS.filter((p) => p.source === source)
      : SAMPLE_MATCHED_PAYMENTS;
    return samples;
  }
  return results;
}

export function useMatchedPayments(source?: string) {
  return useQuery({
    queryKey: orderPaymentsKeys.matched(source),
    queryFn: () => fetchMatchedPayments(source),
  });
}
