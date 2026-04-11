import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { OutstandingOrder } from '../types/reconciliation.types';

export const outstandingKeys = {
  all: ['outstanding-orders'] as const,
  list: (organizationId: string, filter?: string) =>
    ['outstanding-orders', 'list', organizationId, filter] as const,
};

export type OutstandingFilter = 'all' | 'deposit_only' | 'final_sent' | 'overdue_21';

async function fetchOutstandingOrders(
  organizationId: string,
  filter?: OutstandingFilter,
): Promise<OutstandingOrder[]> {
  try {
    let query = supabase
      .from('orders_with_balance')
      .select('id, order_number, customer_name, customer_email, customer_phone, person_id, sku, material, color, location, value, total_order_value, amount_paid, balance_due, final_invoice_sent_at, final_invoice_id, deposit_date, due_date, created_at')
      .eq('organization_id', organizationId)
      .gt('balance_due', 0)
      .order('balance_due', { ascending: false });

    if (filter === 'deposit_only') {
      query = query.gt('amount_paid', 0).is('final_invoice_sent_at', null);
    } else if (filter === 'final_sent') {
      query = query.not('final_invoice_sent_at', 'is', null);
    } else if (filter === 'overdue_21') {
      const twentyOneDaysAgo = new Date();
      twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
      query = query.not('final_invoice_sent_at', 'is', null)
        .lt('final_invoice_sent_at', twentyOneDaysAgo.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.warn('orders_with_balance query failed (migration may not be applied):', error.message);
      return [];
    }

    if (!data?.length) return [];
    return data as unknown as OutstandingOrder[];
  } catch {
    return [];
  }
}

export function useOutstandingOrders(filter?: OutstandingFilter) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? outstandingKeys.list(organizationId, filter)
      : ['outstanding-orders', 'list', 'disabled', filter],
    queryFn: () => fetchOutstandingOrders(organizationId!, filter),
    enabled: !!organizationId,
  });
}
