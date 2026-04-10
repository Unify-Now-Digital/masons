import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { OrderPayment, OrderPaymentUpdate } from '../types/reconciliation.types';

export const orderPaymentsKeys = {
  all: ['order-payments'] as const,
  list: (filters?: Record<string, unknown>) => ['order-payments', 'list', filters] as const,
  unmatched: () => ['order-payments', 'unmatched'] as const,
  matched: (source?: string) => ['order-payments', 'matched', source] as const,
  detail: (id: string) => ['order-payments', id] as const,
  stats: () => ['order-payments', 'stats'] as const,
};

async function fetchOrderPayments(status?: string, source?: string): Promise<OrderPayment[]> {
  let query = supabase
    .from('order_payments')
    .select('*, orders(id, order_number, customer_name, person_id)')
    .order('received_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OrderPayment[];
}

async function updateOrderPayment(id: string, updates: OrderPaymentUpdate): Promise<OrderPayment> {
  const { data, error } = await supabase
    .from('order_payments')
    .update(updates)
    .eq('id', id)
    .select('*, orders(id, order_number, customer_name, person_id)')
    .single();

  if (error) throw error;
  return data as unknown as OrderPayment;
}

export function useOrderPaymentsList(status?: string, source?: string) {
  return useQuery({
    queryKey: orderPaymentsKeys.list({ status, source }),
    queryFn: () => fetchOrderPayments(status, source),
  });
}

export function useUpdateOrderPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: OrderPaymentUpdate }) =>
      updateOrderPayment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderPaymentsKeys.all });
    },
  });
}
