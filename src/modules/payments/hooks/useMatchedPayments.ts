import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { OrderPayment } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';

async function fetchMatchedPayments(
  organizationId: string,
  source?: string,
): Promise<OrderPayment[]> {
  try {
    let query = supabase
      .from('order_payments')
      .select('*, orders(id, order_number, customer_name, person_id)')
      .eq('organization_id', organizationId)
      .eq('status', 'matched')
      .order('received_at', { ascending: false });

    if (source) query = query.eq('source', source);

    const { data, error } = await query;
    if (error) {
      console.warn('order_payments query failed (migration may not be applied):', error.message);
      return [];
    }

    return (data ?? []) as unknown as OrderPayment[];
  } catch {
    return [];
  }
}

export function useMatchedPayments(source?: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? orderPaymentsKeys.matched(organizationId, source)
      : ['order-payments', 'matched', 'disabled', source],
    queryFn: () => fetchMatchedPayments(organizationId!, source),
    enabled: !!organizationId,
  });
}
