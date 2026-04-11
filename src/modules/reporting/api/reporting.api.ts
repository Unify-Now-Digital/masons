import { supabase } from '@/shared/lib/supabase';
import type { MonthlyRevenue, OrderStatusSummary, TopProduct } from '../types/reporting.types';

/**
 * Views `v_monthly_revenue`, `v_order_status_summary`, `v_top_products` may not expose
 * `organization_id`; callers pass `organizationId` for API consistency — queries unchanged.
 */
export async function fetchMonthlyRevenue(_organizationId: string) {
  const { data, error } = await supabase
    .from('v_monthly_revenue')
    .select('*')
    .limit(12);

  if (error) throw error;
  return data as MonthlyRevenue[];
}

export async function fetchOrderStatusSummary(_organizationId: string) {
  const { data, error } = await supabase
    .from('v_order_status_summary')
    .select('*')
    .single();

  if (error) throw error;
  return data as OrderStatusSummary;
}

export async function fetchTopProducts(_organizationId: string) {
  const { data, error } = await supabase
    .from('v_top_products')
    .select('*');

  if (error) throw error;
  return data as TopProduct[];
}
