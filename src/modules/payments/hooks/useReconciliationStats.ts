import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { ReconciliationStats } from '../types/reconciliation.types';
import { orderPaymentsKeys } from './useOrderPayments';
import { SAMPLE_STATS } from '../utils/sampleData';

async function fetchReconciliationStats(): Promise<ReconciliationStats> {
  // Get first day of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Received this month (all payments regardless of status)
  const { data: monthPayments, error: monthErr } = await supabase
    .from('order_payments')
    .select('amount')
    .gte('received_at', monthStart);

  if (monthErr) throw monthErr;

  const receivedThisMonth = (monthPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0
  );

  // Matched count
  const { count: matchedCount, error: matchedErr } = await supabase
    .from('order_payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'matched');

  if (matchedErr) throw matchedErr;

  // Unmatched count
  const { count: unmatchedCount, error: unmatchedErr } = await supabase
    .from('order_payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'unmatched');

  if (unmatchedErr) throw unmatchedErr;

  // Outstanding total (sum of balance_due from orders_with_balance view)
  const { data: outstandingRows, error: outErr } = await supabase
    .from('orders_with_balance')
    .select('balance_due')
    .gt('balance_due', 0);

  // If the view doesn't exist yet, fall back to sample stats
  if (outErr) {
    // Check if any order_payments exist at all
    const totalPayments = (matchedCount ?? 0) + (unmatchedCount ?? 0);
    if (totalPayments === 0) return SAMPLE_STATS;
  }

  const outstandingTotal = (outstandingRows ?? []).reduce(
    (sum, o) => sum + Number(o.balance_due ?? 0),
    0
  );

  const stats: ReconciliationStats = {
    received_this_month: receivedThisMonth,
    matched_count: matchedCount ?? 0,
    unmatched_count: unmatchedCount ?? 0,
    outstanding_total: outstandingTotal,
  };

  // If all zeros (migration not applied / no data), return sample stats
  if (stats.received_this_month === 0 && stats.matched_count === 0 && stats.unmatched_count === 0) {
    return SAMPLE_STATS;
  }

  return stats;
}

export function useReconciliationStats() {
  return useQuery({
    queryKey: orderPaymentsKeys.stats(),
    queryFn: fetchReconciliationStats,
    staleTime: 30 * 1000, // 30s
  });
}
