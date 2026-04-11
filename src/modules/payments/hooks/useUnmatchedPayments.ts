import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { OrderPayment } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';

async function fetchUnmatchedPayments(organizationId: string): Promise<OrderPayment[]> {
  try {
    const { data, error } = await supabase
      .from('order_payments')
      .select('*, orders(id, order_number, customer_name, person_id)')
      .eq('organization_id', organizationId)
      .eq('status', 'unmatched')
      .order('amount', { ascending: false });

    if (error) {
      console.warn('order_payments query failed (migration may not be applied):', error.message);
      return [];
    }

    return (data ?? []) as unknown as OrderPayment[];
  } catch {
    return [];
  }
}

export function useUnmatchedPayments() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? orderPaymentsKeys.unmatched(organizationId)
      : ['order-payments', 'unmatched', 'disabled'],
    queryFn: () => fetchUnmatchedPayments(organizationId!),
    enabled: !!organizationId,
  });
}
