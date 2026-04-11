import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { MonthlyRevenue, TopProduct } from '../types/reporting.types';
import type { ReportingKPIs, RecentActivity } from '../types/reporting.types';
import { getDateRange, getPreviousDateRange } from '../utils/reportingTransform';
import { getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import type { Order } from '@/modules/orders/types/orders.types';
import { normalizeOrder } from '@/modules/orders/utils/numberParsing';

export const reportingKeys = {
  kpis: (dateRange: string, organizationId: string) =>
    ['reporting', 'kpis', dateRange, organizationId] as const,
  revenueChart: (dateRange: string, organizationId: string) =>
    ['reporting', 'revenue-chart', dateRange, organizationId] as const,
  topProducts: (dateRange: string, organizationId: string) =>
    ['reporting', 'top-products', dateRange, organizationId] as const,
  recentActivity: (limit: number, organizationId: string) =>
    ['reporting', 'recent-activity', limit, organizationId] as const,
};

// ============================================================================
// useReportingKPIs
// ============================================================================

async function fetchKPIs(dateRange: string, organizationId: string): Promise<ReportingKPIs> {
  const { fromDate, toDate } = getDateRange(dateRange);
  const { fromDate: prevFromDate, toDate: prevToDate } = getPreviousDateRange(dateRange);

  // Fetch current period: Monthly Revenue from payments
  let monthlyRevenueQuery = supabase
    .from('payments')
    .select('amount', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (fromDate && toDate) {
    monthlyRevenueQuery = monthlyRevenueQuery
      .gte('date', fromDate)
      .lte('date', toDate);
  }

  const { data: currentPayments, error: paymentsError } = await monthlyRevenueQuery;

  if (paymentsError) throw paymentsError;

  const monthlyRevenueCurrent = currentPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  // Fetch previous period: Monthly Revenue
  let prevMonthlyRevenueQuery = supabase
    .from('payments')
    .select('amount', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (prevFromDate && prevToDate) {
    prevMonthlyRevenueQuery = prevMonthlyRevenueQuery
      .gte('date', prevFromDate)
      .lte('date', prevToDate);
  }

  const { data: prevPayments, error: prevPaymentsError } = await prevMonthlyRevenueQuery;

  if (prevPaymentsError) throw prevPaymentsError;

  const monthlyRevenuePrevious = prevPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  // Fetch current period: Orders This Month
  let ordersQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (fromDate && toDate) {
    ordersQuery = ordersQuery
      .gte('created_at', `${fromDate}T00:00:00`)
      .lte('created_at', `${toDate}T23:59:59`);
  }

  const { count: ordersCurrent, error: ordersError } = await ordersQuery;

  if (ordersError) throw ordersError;

  // Fetch previous period: Orders
  let prevOrdersQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (prevFromDate && prevToDate) {
    prevOrdersQuery = prevOrdersQuery
      .gte('created_at', `${prevFromDate}T00:00:00`)
      .lte('created_at', `${prevToDate}T23:59:59`);
  }

  const { count: ordersPrevious, error: prevOrdersError } = await prevOrdersQuery;

  if (prevOrdersError) throw prevOrdersError;

  // Fetch current period: Avg. Days to Complete
  let avgDaysQuery = supabase
    .from('orders')
    .select('deposit_date, installation_date')
    .eq('organization_id', organizationId);

  if (fromDate) {
    avgDaysQuery = avgDaysQuery.gte('installation_date', fromDate);
  }

  avgDaysQuery = avgDaysQuery
    .not('deposit_date', 'is', null)
    .not('installation_date', 'is', null);

  const { data: ordersWithDates, error: avgDaysError } = await avgDaysQuery;

  if (avgDaysError) throw avgDaysError;

  const avgDaysCurrent = ordersWithDates && ordersWithDates.length > 0
    ? ordersWithDates.reduce((sum, o) => {
        if (!o.deposit_date || !o.installation_date) return sum;
        const days = Math.floor(
          (new Date(o.installation_date).getTime() - new Date(o.deposit_date).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0) / ordersWithDates.length
    : 0;

  // Fetch previous period: Avg. Days to Complete
  let prevAvgDaysQuery = supabase
    .from('orders')
    .select('deposit_date, installation_date')
    .eq('organization_id', organizationId);

  if (prevFromDate) {
    prevAvgDaysQuery = prevAvgDaysQuery.gte('installation_date', prevFromDate);
  }

  if (prevToDate) {
    prevAvgDaysQuery = prevAvgDaysQuery.lte('installation_date', prevToDate);
  }

  prevAvgDaysQuery = prevAvgDaysQuery
    .not('deposit_date', 'is', null)
    .not('installation_date', 'is', null);

  const { data: prevOrdersWithDates, error: prevAvgDaysError } = await prevAvgDaysQuery;

  if (prevAvgDaysError) throw prevAvgDaysError;

  const avgDaysPrevious = prevOrdersWithDates && prevOrdersWithDates.length > 0
    ? prevOrdersWithDates.reduce((sum, o) => {
        if (!o.deposit_date || !o.installation_date) return sum;
        const days = Math.floor(
          (new Date(o.installation_date).getTime() - new Date(o.deposit_date).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0) / prevOrdersWithDates.length
    : 0;

  // Calculate percentage changes
  const calculateChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  return {
    monthlyRevenue: {
      current: monthlyRevenueCurrent,
      previous: monthlyRevenuePrevious,
      change: calculateChange(monthlyRevenueCurrent, monthlyRevenuePrevious),
    },
    ordersThisMonth: {
      current: ordersCurrent || 0,
      previous: ordersPrevious || 0,
      change: calculateChange(ordersCurrent || 0, ordersPrevious || 0),
    },
    avgDaysToComplete: {
      current: Math.round(avgDaysCurrent),
      previous: Math.round(avgDaysPrevious),
      change: calculateChange(avgDaysCurrent, avgDaysPrevious),
    },
    daysDepositToInstall: {
      current: Math.round(avgDaysCurrent), // Same calculation for now
      previous: Math.round(avgDaysPrevious),
      change: calculateChange(avgDaysCurrent, avgDaysPrevious),
    },
  };
}

export function useReportingKPIs(dateRange: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? reportingKeys.kpis(dateRange, organizationId)
      : ['reporting', 'kpis', 'disabled', dateRange],
    queryFn: () => fetchKPIs(dateRange, organizationId!),
    enabled: !!organizationId,
  });
}

// ============================================================================
// useRevenueChart
// ============================================================================

async function fetchRevenueChart(
  dateRange: string,
  _organizationId: string,
): Promise<MonthlyRevenue[]> {
  const { fromDate, toDate } = getDateRange(dateRange);

  let query = supabase
    .from('v_monthly_revenue')
    .select('*')
    .order('month', { ascending: true });

  if (fromDate && toDate) {
    query = query
      .gte('month', `${fromDate}T00:00:00`)
      .lte('month', `${toDate}T23:59:59`);
  }

  const { data, error } = await query.limit(24); // Last 24 months max

  if (error) throw error;
  return data as MonthlyRevenue[];
}

export function useRevenueChart(dateRange: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? reportingKeys.revenueChart(dateRange, organizationId)
      : ['reporting', 'revenue-chart', 'disabled', dateRange],
    queryFn: () => fetchRevenueChart(dateRange, organizationId!),
    enabled: !!organizationId,
  });
}

// ============================================================================
// useTopProducts
// ============================================================================

async function fetchTopProducts(dateRange: string, organizationId: string): Promise<TopProduct[]> {
  const { fromDate, toDate } = getDateRange(dateRange);

  // Query orders_with_options_total view to include additional options in totals
  let query = supabase
    .from('orders_with_options_total')
    .select('order_type, value, permit_cost, additional_options_total')
    .eq('organization_id', organizationId);

  if (fromDate && toDate) {
    query = query
      .gte('created_at', `${fromDate}T00:00:00`)
      .lte('created_at', `${toDate}T23:59:59`);
  }

  query = query.not('value', 'is', null).not('order_type', 'is', null);

  const { data, error } = await query;

  if (error) throw error;

  // Group by order_type and calculate totals (includes base value + permit cost + additional options)
  const grouped = (data || []).reduce((acc, order) => {
    const normalizedOrder = normalizeOrder(order as unknown as Order);
    const type = normalizedOrder.order_type || 'Unknown';
    if (!acc[type]) {
      acc[type] = { order_type: type, order_count: 0, total_revenue: 0 };
    }
    acc[type].order_count += 1;
    // Use shared utility to calculate total (base + permit + additional options)
    const orderTotal = getOrderTotal(normalizedOrder);
    acc[type].total_revenue += orderTotal;
    return acc;
  }, {} as Record<string, { order_type: string; order_count: number; total_revenue: number }>);

  // Convert to array, sort by revenue, take top 5
  const topProducts = Object.values(grouped)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 5)
    .map((item) => ({
      product_name: item.order_type,
      order_count: item.order_count,
      total_revenue: item.total_revenue,
    }));

  return topProducts as TopProduct[];
}

export function useTopProducts(dateRange: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? reportingKeys.topProducts(dateRange, organizationId)
      : ['reporting', 'top-products', 'disabled', dateRange],
    queryFn: () => fetchTopProducts(dateRange, organizationId!),
    enabled: !!organizationId,
  });
}

// ============================================================================
// useRecentActivity
// ============================================================================

async function fetchRecentActivity(limit: number = 10, organizationId?: string): Promise<RecentActivity[]> {
  if (!organizationId) return [];

  // Fetch invoices paid
  const { data: paidInvoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('updated_at, amount, invoice_number, customer_name')
    .eq('organization_id', organizationId)
    .eq('status', 'paid')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (invoicesError) throw invoicesError;

  // Fetch orders completed (orders with installation_date set)
  // Use orders_with_options_total view to include additional options in totals
  const { data: completedOrders, error: ordersError } = await supabase
    .from('orders_with_options_total')
    .select('updated_at, value, permit_cost, additional_options_total, id, customer_name')
    .eq('organization_id', organizationId)
    .not('installation_date', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (ordersError) throw ordersError;

  // Fetch payments received (without join - fetch separately)
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('date, amount, id, invoice_id')
    .eq('organization_id', organizationId)
    .order('date', { ascending: false })
    .limit(limit);

  if (paymentsError) throw paymentsError;

  // Fetch invoice details for payments
  const invoiceIds = (payments || [])
    .map((p) => p.invoice_id)
    .filter((id): id is string => !!id);

  let invoiceMap: Record<string, { invoice_number?: string; customer_name?: string }> = {};

  if (invoiceIds.length > 0) {
    const { data: invoices, error: invoicesForPaymentsError } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name')
      .eq('organization_id', organizationId)
      .in('id', invoiceIds);

    if (invoicesForPaymentsError) throw invoicesForPaymentsError;

    invoiceMap = (invoices || []).reduce((acc, inv) => {
      acc[inv.id] = {
        invoice_number: inv.invoice_number || undefined,
        customer_name: inv.customer_name || undefined,
      };
      return acc;
    }, {} as Record<string, { invoice_number?: string; customer_name?: string }>);
  }

  // Transform and combine
  const activities: RecentActivity[] = [];

  // Add invoice activities
  (paidInvoices || []).forEach((invoice) => {
    activities.push({
      type: 'invoice_paid',
      activity_date: invoice.updated_at,
      amount: invoice.amount || 0,
      reference: invoice.invoice_number || '',
      customer: invoice.customer_name || '',
      description: `Invoice ${invoice.invoice_number || ''} paid`,
    });
  });

  // Add order activities (amount includes base value + permit cost + additional options)
  (completedOrders || []).forEach((order) => {
    const normalizedOrder = normalizeOrder(order as unknown as Order);
    const orderTotal = getOrderTotal(normalizedOrder);
    activities.push({
      type: 'order_completed',
      activity_date: normalizedOrder.updated_at,
      amount: orderTotal,
      reference: normalizedOrder.id,
      customer: normalizedOrder.customer_name || '',
      description: `Order ${normalizedOrder.id} completed`,
    });
  });

  // Add payment activities
  (payments || []).forEach((payment) => {
    const invoice = payment.invoice_id ? invoiceMap[payment.invoice_id] : null;
    activities.push({
      type: 'payment_received',
      activity_date: payment.date,
      amount: payment.amount || 0,
      reference: payment.id,
      customer: invoice?.customer_name || '',
      description: `Payment received for invoice ${invoice?.invoice_number || payment.invoice_id || ''}`,
    });
  });

  // Sort by date descending and limit
  return activities
    .sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())
    .slice(0, limit);
}

export function useRecentActivity(limit: number = 10) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? reportingKeys.recentActivity(limit, organizationId)
      : ['reporting', 'recent-activity', 'disabled', limit],
    queryFn: () => fetchRecentActivity(limit, organizationId),
    enabled: !!organizationId,
  });
}
