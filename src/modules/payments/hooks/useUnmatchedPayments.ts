import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { OrderPayment } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';

async function fetchUnmatchedPayments(): Promise<OrderPayment[]> {
  const { data, error } = await supabase
    .from('order_payments')
    .select('*, orders(id, order_number, customer_name, person_id)')
    .eq('status', 'unmatched')
    .order('amount', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as OrderPayment[];
}

export function useUnmatchedPayments() {
  return useQuery({
    queryKey: orderPaymentsKeys.unmatched(),
    queryFn: fetchUnmatchedPayments,
  });
}
