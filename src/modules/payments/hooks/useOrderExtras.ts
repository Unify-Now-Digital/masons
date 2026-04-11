import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { OrderExtra, OrderExtraUpdate } from '../types/reconciliation.types';

export const orderExtrasKeys = {
  all: ['order-extras'] as const,
  list: (organizationId: string, status?: string) =>
    ['order-extras', 'list', organizationId, status] as const,
  byOrder: (orderId: string) => ['order-extras', 'order', orderId] as const,
};

async function fetchOrderExtras(
  organizationId: string,
  status?: string,
): Promise<OrderExtra[]> {
  try {
    let query = supabase
      .from('order_extras')
      .select('*, orders(id, order_number, customer_name, person_id)')
      .eq('organization_id', organizationId)
      .order('confidence', { ascending: true })
      .order('detected_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('order_extras query failed (migration may not be applied):', error.message);
      return [];
    }

    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    const results = (data ?? []) as unknown as OrderExtra[];
    results.sort((a, b) => (confidenceOrder[a.confidence] ?? 1) - (confidenceOrder[b.confidence] ?? 1));
    return results;
  } catch {
    return [];
  }
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
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? orderExtrasKeys.list(organizationId, status)
      : ['order-extras', 'list', 'disabled', status],
    queryFn: () => fetchOrderExtras(organizationId!, status),
    enabled: !!organizationId,
  });
}

export function useUpdateOrderExtra() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: OrderExtraUpdate }) =>
      updateOrderExtra(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderExtrasKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: orderExtrasKeys.list(organizationId) });
      }
    },
  });
}

export function useDismissExtra() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: async ({ extraId, dismissedBy }: { extraId: string; dismissedBy: string }) => {
      if (!organizationId) throw new Error('No organization selected');
      if (!dismissedBy?.trim()) {
        throw new Error('dismissedBy is required for audit trail');
      }

      // Double-write protection: verify current status before updating
      const { data: current, error: fetchErr } = await supabase
        .from('order_extras')
        .select('status')
        .eq('id', extraId)
        .eq('organization_id', organizationId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'pending') {
        throw new Error(`Cannot dismiss: item already ${current.status}`);
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('order_extras')
        .update({
          status: 'dismissed',
          actioned_by: dismissedBy,
          actioned_at: now,
        })
        .eq('id', extraId)
        .eq('organization_id', organizationId)
        .eq('status', 'pending'); // Optimistic lock: only update if still pending

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderExtrasKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: orderExtrasKeys.list(organizationId) });
      }
    },
  });
}

export function useAddExtraToInvoice() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

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
      if (!organizationId) throw new Error('No organization selected');
      if (!actionedBy?.trim()) {
        throw new Error('actionedBy is required for audit trail');
      }
      if (!amount || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }

      // Double-write protection: verify current status before updating.
      // This prevents a race where two clicks both attempt to add the same extra.
      const { data: current, error: fetchErr } = await supabase
        .from('order_extras')
        .select('status')
        .eq('id', extraId)
        .eq('organization_id', organizationId)
        .single();

      if (fetchErr) throw fetchErr;
      if (current.status !== 'pending') {
        throw new Error(
          current.status === 'added_to_invoice'
            ? 'This item has already been added to the invoice.'
            : `Cannot add to invoice: item is ${current.status}`
        );
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('order_extras')
        .update({
          status: 'added_to_invoice',
          suggested_amount: amount,
          actioned_by: actionedBy,
          actioned_at: now,
        })
        .eq('id', extraId)
        .eq('organization_id', organizationId)
        .eq('status', 'pending') // Optimistic lock: only update if still pending
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error('This item has already been processed by another user.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderExtrasKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: orderExtrasKeys.list(organizationId) });
      }
    },
  });
}
