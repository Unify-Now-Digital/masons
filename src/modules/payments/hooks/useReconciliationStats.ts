import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { ReconciliationStats } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';

const EMPTY_STATS: ReconciliationStats = {
  received_this_month: 0,
  matched_count: 0,
  unmatched_count: 0,
  outstanding_total: 0,
};

async function fetchReconciliationStats(organizationId: string): Promise<ReconciliationStats> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: monthPayments, error: monthErr } = await supabase
      .from('order_payments')
      .select('amount')
      .eq('organization_id', organizationId)
      .gte('received_at', monthStart);

    if (monthErr) {
      console.warn('order_payments stats query failed:', monthErr.message);
      return EMPTY_STATS;
    }

    const receivedThisMonth = (monthPayments ?? []).reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0
    );

    const { count: matchedCount } = await supabase
      .from('order_payments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'matched');

    const { count: unmatchedCount } = await supabase
      .from('order_payments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'unmatched');

    // Outstanding total from the view (may not exist)
    let outstandingTotal = 0;
    try {
      const { data: outstandingRows } = await supabase
        .from('orders_with_balance')
        .select('balance_due')
        .eq('organization_id', organizationId)
        .gt('balance_due', 0);

      outstandingTotal = (outstandingRows ?? []).reduce(
        (sum, o) => sum + Number(o.balance_due ?? 0),
        0
      );
    } catch {
      // View doesn't exist yet
    }

    return {
      received_this_month: receivedThisMonth,
      matched_count: matchedCount ?? 0,
      unmatched_count: unmatchedCount ?? 0,
      outstanding_total: outstandingTotal,
    };
  } catch {
    return EMPTY_STATS;
  }
}

export function useReconciliationStats() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? orderPaymentsKeys.stats(organizationId)
      : ['order-payments', 'stats', 'disabled'],
    queryFn: () => fetchReconciliationStats(organizationId!),
    enabled: !!organizationId,
    staleTime: 30 * 1000,
  });
}
