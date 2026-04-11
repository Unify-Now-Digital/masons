import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { OrderPayment, OrderPaymentUpdate } from '../types/reconciliation.types';

export const orderPaymentsKeys = {
  all: ['order-payments'] as const,
  list: (organizationId: string, filters?: Record<string, unknown>) =>
    ['order-payments', 'list', organizationId, filters] as const,
  unmatched: (organizationId: string) => ['order-payments', 'unmatched', organizationId] as const,
  matched: (organizationId: string, source?: string) =>
    ['order-payments', 'matched', organizationId, source] as const,
  detail: (id: string) => ['order-payments', id] as const,
  stats: (organizationId: string) => ['order-payments', 'stats', organizationId] as const,
};

async function fetchOrderPayments(
  organizationId: string,
  status?: string,
  source?: string,
): Promise<OrderPayment[]> {
  let query = supabase
    .from('order_payments')
    .select('*, orders(id, order_number, customer_name, person_id)')
    .eq('organization_id', organizationId)
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
  const { organizationId } = useOrganization();
  const filters = { status, source };
  return useQuery({
    queryKey: organizationId
      ? orderPaymentsKeys.list(organizationId, filters)
      : ['order-payments', 'list', 'disabled', filters],
    queryFn: () => fetchOrderPayments(organizationId!, status, source),
    enabled: !!organizationId,
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
