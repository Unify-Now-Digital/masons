import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { OrderExtra, OrderExtraUpdate } from '../types/reconciliation.types';

export const orderExtrasKeys = {
  all: ['order-extras'] as const,
  list: (status?: string) => ['order-extras', 'list', status] as const,
  byOrder: (orderId: string) => ['order-extras', 'order', orderId] as const,
};

async function fetchOrderExtras(status?: string): Promise<OrderExtra[]> {
  let query = supabase
    .from('order_extras')
    .select('*, orders(id, order_number, customer_name, person_id)')
    .order('confidence', { ascending: true }) // high first (alphabetical: high < low < medium, so we sort custom)
    .order('detected_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Sort by confidence priority: high > medium > low
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  const results = (data ?? []) as unknown as OrderExtra[];
  results.sort((a, b) => (confidenceOrder[a.confidence] ?? 1) - (confidenceOrder[b.confidence] ?? 1));

  return results;
}

async function updateOrderExtra(id: string, updates: OrderExtraUpdate): Promise<OrderExtra> {
  const { data, error } = await supabase
    .from('order_extras')
    .update(updates)
    .eq('id', id)
    .select('*, orders(id, order_number, customer_name, person_id)')
    .single();

  if (error) throw error;
  return data as unknown as OrderExtra;
}

export function useOrderExtrasList(status?: string) {
  return useQuery({
    queryKey: orderExtrasKeys.list(status),
    queryFn: () => fetchOrderExtras(status),
  });
}

export function useUpdateOrderExtra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: OrderExtraUpdate }) =>
      updateOrderExtra(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderExtrasKeys.all });
    },
  });
}

export function useDismissExtra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ extraId, dismissedBy }: { extraId: string; dismissedBy: string }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('order_extras')
        .update({
          status: 'dismissed',
          actioned_by: dismissedBy,
          actioned_at: now,
        })
        .eq('id', extraId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderExtrasKeys.all });
    },
  });
}

export function useAddExtraToInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      extraId,
      amount,
      actionedBy,
    }: {
      extraId: string;
      amount: number;
      actionedBy: string;
    }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('order_extras')
        .update({
          status: 'added_to_invoice',
          suggested_amount: amount,
          actioned_by: actionedBy,
          actioned_at: now,
        })
        .eq('id', extraId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderExtrasKeys.all });
    },
  });
}
