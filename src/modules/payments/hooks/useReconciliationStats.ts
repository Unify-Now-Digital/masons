import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { ReconciliationStats } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';
import { SAMPLE_STATS } from '../utils/sampleData';

async function fetchReconciliationStats(): Promise<ReconciliationStats> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: monthPayments, error: monthErr } = await supabase
      .from('order_payments')
      .select('amount')
      .gte('received_at', monthStart);

    // If the table doesn't exist, return sample stats
    if (monthErr) {
      console.warn('order_payments stats query failed:', monthErr.message);
      return SAMPLE_STATS;
    }

    const receivedThisMonth = (monthPayments ?? []).reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0
    );

    const { count: matchedCount } = await supabase
      .from('order_payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'matched');

    const { count: unmatchedCount } = await supabase
      .from('order_payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unmatched');

    // Outstanding total from the view (may not exist)
    let outstandingTotal = 0;
    try {
      const { data: outstandingRows } = await supabase
        .from('orders_with_balance')
        .select('balance_due')
        .gt('balance_due', 0);

      outstandingTotal = (outstandingRows ?? []).reduce(
        (sum, o) => sum + Number(o.balance_due ?? 0),
        0
      );
    } catch {
      // View doesn't exist yet
    }

    const stats: ReconciliationStats = {
      received_this_month: receivedThisMonth,
      matched_count: matchedCount ?? 0,
      unmatched_count: unmatchedCount ?? 0,
      outstanding_total: outstandingTotal,
    };

    // If all zeros, return sample stats
    if (stats.received_this_month === 0 && stats.matched_count === 0 && stats.unmatched_count === 0) {
      return SAMPLE_STATS;
    }

    return stats;
  } catch {
    return SAMPLE_STATS;
  }
}

export function useReconciliationStats() {
  return useQuery({
    queryKey: orderPaymentsKeys.stats(),
    queryFn: fetchReconciliationStats,
    staleTime: 30 * 1000,
  });
}
