import { supabase } from '@/shared/lib/supabase';
import type { MonthlyRevenue, OrderStatusSummary, TopProduct } from '../types/reporting.types';

export async function fetchMonthlyRevenue() {
  const { data, error } = await supabase
    .from('v_monthly_revenue')
    .select('*')
    .limit(12);
  
  if (error) throw error;
  return data as MonthlyRevenue[];
}

export async function fetchOrderStatusSummary() {
  const { data, error } = await supabase
    .from('v_order_status_summary')
    .select('*')
    .single();
  
  if (error) throw error;
  return data as OrderStatusSummary;
}

export async function fetchTopProducts() {
  const { data, error } = await supabase
    .from('v_top_products')
    .select('*');
  
  if (error) throw error;
  return data as TopProduct[];
}

