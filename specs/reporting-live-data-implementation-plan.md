# Detailed Implementation Plan: Reporting & Analytics - Live Data Integration

**Branch:** `feature/reporting-live-data-integration`  
**Specification:** `specs/reporting-live-data-integration-plan.md`  
**Implementation Plan:** `specs/reporting-live-data-implementation-plan.md`

---

## Overview

This plan provides step-by-step implementation details for upgrading the Reporting & Analytics page to use live Supabase data. The implementation will replace all dummy data with real queries while maintaining the exact same UI/UX.

---

## File-by-File Changes

### Files to CREATE

1. **`src/modules/reporting/utils/reportingTransform.ts`** (NEW)
   - Transform utilities for currency, time, percentages, date ranges

2. **`supabase/migrations/YYYYMMDDHHmmss_reporting_recent_activity_view.sql`** (NEW, optional)
   - SQL view for unified recent activity if needed

### Files to UPDATE

1. **`src/modules/reporting/hooks/useReporting.ts`**
   - Replace API-based hooks with Supabase queries
   - Add new hooks: `useReportingKPIs`, `useRevenueChart`, `useTopProducts`, `useRecentActivity`

2. **`src/modules/reporting/types/reporting.types.ts`**
   - Add new types for KPIs, recent activity, chart data

3. **`src/modules/reporting/pages/ReportingPage.tsx`**
   - Remove all dummy data
   - Integrate live hooks
   - Add loading/error states
   - Update date range selector

---

## Task 1: Create Transform Utilities

**File:** `src/modules/reporting/utils/reportingTransform.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { format, formatDistanceToNow, parseISO, startOfYear } from 'date-fns';

/**
 * Format currency as GBP
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '£0.00';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number {
  if (!current || !previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
export function formatTimeAgo(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const date = parseISO(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Get date range boundaries from range string
 */
export function getDateRange(range: string): { fromDate: string | null; toDate: string | null } {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  const toDate = format(today, 'yyyy-MM-dd');

  switch (range) {
    case '30d': {
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 30);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
    }
    case '90d': {
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 90);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
    }
    case '1y': {
      const fromDate = startOfYear(today);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
    }
    case 'all':
      return { fromDate: null, toDate: null };
    default:
      // Default to 30 days
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 30);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate: format(fromDate, 'yyyy-MM-dd'), toDate };
  }
}

/**
 * Get previous period date range (for percentage change calculations)
 */
export function getPreviousDateRange(range: string): { fromDate: string | null; toDate: string | null } {
  const { fromDate, toDate } = getDateRange(range);
  if (!fromDate || !toDate) return { fromDate: null, toDate: null };

  const to = parseISO(toDate);
  const from = parseISO(fromDate);
  const duration = to.getTime() - from.getTime();

  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo);
  prevFrom.setTime(prevTo.getTime() - duration);
  prevFrom.setHours(0, 0, 0, 0);

  return {
    fromDate: format(prevFrom, 'yyyy-MM-dd'),
    toDate: format(prevTo, 'yyyy-MM-dd'),
  };
}

/**
 * Transform revenue chart data - fill missing months with zeros
 */
export interface ChartDataPoint {
  month: string;
  revenue: number;
}

export function transformRevenueChartData(
  data: Array<{ month: string; paid_amount: number | null }>
): ChartDataPoint[] {
  if (!data || data.length === 0) return [];

  // Sort by month
  const sorted = [...data].sort((a, b) => {
    const dateA = parseISO(a.month);
    const dateB = parseISO(b.month);
    return dateA.getTime() - dateB.getTime();
  });

  // Transform to chart format
  return sorted.map((item) => ({
    month: format(parseISO(item.month), 'MMM yyyy'),
    revenue: item.paid_amount || 0,
  }));
}
```

---

## Task 2: Update Types

**File:** `src/modules/reporting/types/reporting.types.ts`  
**Action:** UPDATE

**Add to existing types:**

```typescript
// ... existing types ...

export interface ReportingKPIs {
  monthlyRevenue: {
    current: number;
    previous: number;
    change: number;
  };
  ordersThisMonth: {
    current: number;
    previous: number;
    change: number;
  };
  avgDaysToComplete: {
    current: number;
    previous: number;
    change: number;
  };
  daysDepositToInstall: {
    current: number;
    previous: number;
    change: number;
  };
}

export interface RecentActivity {
  type: 'invoice_paid' | 'order_completed' | 'payment_received';
  activity_date: string;
  amount: number;
  reference: string;
  customer: string;
  description: string;
}
```

---

## Task 3: Update Reporting Hooks

**File:** `src/modules/reporting/hooks/useReporting.ts`  
**Action:** UPDATE

**Complete Code:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { MonthlyRevenue, TopProduct } from '../types/reporting.types';
import type { ReportingKPIs, RecentActivity } from '../types/reporting.types';
import { getDateRange, getPreviousDateRange } from '../utils/reportingTransform';

export const reportingKeys = {
  kpis: (dateRange: string) => ['reporting', 'kpis', dateRange] as const,
  revenueChart: (dateRange: string) => ['reporting', 'revenue-chart', dateRange] as const,
  topProducts: (dateRange: string) => ['reporting', 'top-products', dateRange] as const,
  recentActivity: (limit: number) => ['reporting', 'recent-activity', limit] as const,
};

// ============================================================================
// useReportingKPIs
// ============================================================================

async function fetchKPIs(dateRange: string): Promise<ReportingKPIs> {
  const { fromDate, toDate } = getDateRange(dateRange);
  const { fromDate: prevFromDate, toDate: prevToDate } = getPreviousDateRange(dateRange);

  // Fetch current period: Monthly Revenue from payments
  let monthlyRevenueQuery = supabase
    .from('payments')
    .select('amount', { count: 'exact' });

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
    .select('amount', { count: 'exact' });

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
    .select('id', { count: 'exact', head: true });

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
    .select('id', { count: 'exact', head: true });

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
    .select('deposit_date, installation_date');

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
    .select('deposit_date, installation_date');

  if (prevFromDate) {
    prevAvgDaysQuery = prevAvgDaysQuery.gte('installation_date', prevFromDate);
  }

  prevAvgDaysQuery = prevAvgDaysQuery
    .lte('installation_date', prevToDate || new Date().toISOString().split('T')[0])
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
  return useQuery({
    queryKey: reportingKeys.kpis(dateRange),
    queryFn: () => fetchKPIs(dateRange),
  });
}

// ============================================================================
// useRevenueChart
// ============================================================================

async function fetchRevenueChart(dateRange: string): Promise<MonthlyRevenue[]> {
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
  return useQuery({
    queryKey: reportingKeys.revenueChart(dateRange),
    queryFn: () => fetchRevenueChart(dateRange),
  });
}

// ============================================================================
// useTopProducts
// ============================================================================

async function fetchTopProducts(dateRange: string): Promise<TopProduct[]> {
  const { fromDate, toDate } = getDateRange(dateRange);

  // Query orders table directly (not using v_top_products view to support date filtering)
  let query = supabase
    .from('orders')
    .select('order_type, value');

  if (fromDate && toDate) {
    query = query
      .gte('created_at', `${fromDate}T00:00:00`)
      .lte('created_at', `${toDate}T23:59:59`);
  }

  query = query.not('value', 'is', null).not('order_type', 'is', null);

  const { data, error } = await query;

  if (error) throw error;

  // Group by order_type and calculate totals
  const grouped = (data || []).reduce((acc, order) => {
    const type = order.order_type || 'Unknown';
    if (!acc[type]) {
      acc[type] = { order_type: type, order_count: 0, total_revenue: 0 };
    }
    acc[type].order_count += 1;
    acc[type].total_revenue += order.value || 0;
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
  return useQuery({
    queryKey: reportingKeys.topProducts(dateRange),
    queryFn: () => fetchTopProducts(dateRange),
  });
}

// ============================================================================
// useRecentActivity
// ============================================================================

async function fetchRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  // Fetch invoices paid
  const { data: paidInvoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('updated_at, amount, invoice_number, customer_name')
    .eq('status', 'paid')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (invoicesError) throw invoicesError;

  // Fetch orders completed
  const { data: completedOrders, error: ordersError } = await supabase
    .from('orders')
    .select('updated_at, value, id, customer_name')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (ordersError) throw ordersError;

  // Fetch payments received
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('date, amount, id, invoices(invoice_number, customer_name)')
    .order('date', { ascending: false })
    .limit(limit);

  if (paymentsError) throw paymentsError;

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

  // Add order activities
  (completedOrders || []).forEach((order) => {
    activities.push({
      type: 'order_completed',
      activity_date: order.updated_at,
      amount: order.value || 0,
      reference: order.id,
      customer: order.customer_name || '',
      description: `Order ${order.id} completed`,
    });
  });

  // Add payment activities
  (payments || []).forEach((payment) => {
    const invoice = payment.invoices as { invoice_number?: string; customer_name?: string } | null;
    activities.push({
      type: 'payment_received',
      activity_date: payment.date,
      amount: payment.amount || 0,
      reference: payment.id,
      customer: invoice?.customer_name || '',
      description: `Payment received for invoice ${invoice?.invoice_number || ''}`,
    });
  });

  // Sort by date descending and limit
  return activities
    .sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())
    .slice(0, limit);
}

export function useRecentActivity(limit: number = 10) {
  return useQuery({
    queryKey: reportingKeys.recentActivity(limit),
    queryFn: () => fetchRecentActivity(limit),
  });
}
```

---

## Task 4: Update ReportingPage

**File:** `src/modules/reporting/pages/ReportingPage.tsx`  
**Action:** UPDATE

**Key Changes:**

1. **Add imports:**
```typescript
import { useReportingKPIs, useRevenueChart, useTopProducts, useRecentActivity } from '../hooks/useReporting';
import { formatCurrency, formatTimeAgo, transformRevenueChartData, calculatePercentageChange } from '../utils/reportingTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useEffect } from 'react';
```

2. **Replace dummy data with hooks:**
```typescript
export const ReportingPage: React.FC = () => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("30d");
  const [activeMetric, setActiveMetric] = useState("revenue");

  const { data: kpisData, isLoading: kpisLoading, error: kpisError } = useReportingKPIs(dateRange);
  const { data: revenueData, isLoading: revenueLoading, error: revenueError } = useRevenueChart(dateRange);
  const { data: topProductsData, isLoading: productsLoading, error: productsError } = useTopProducts(dateRange);
  const { data: recentActivityData, isLoading: activityLoading, error: activityError } = useRecentActivity(10);

  // Error handling
  useEffect(() => {
    if (kpisError || revenueError || productsError || activityError) {
      toast({
        title: 'Error loading reporting data',
        description: 'Failed to fetch some reporting metrics. Please try again.',
        variant: 'destructive',
      });
    }
  }, [kpisError, revenueError, productsError, activityError, toast]);
```

3. **Update KPI cards with real data:**
```typescript
// Replace metrics object usage with:
const metrics = kpisData ? {
  revenue: {
    current: kpisData.monthlyRevenue.current,
    previous: kpisData.monthlyRevenue.previous,
    change: kpisData.monthlyRevenue.change,
  },
  orders: {
    current: kpisData.ordersThisMonth.current,
    previous: kpisData.ordersThisMonth.previous,
    change: kpisData.ordersThisMonth.change,
  },
  satisfaction: { current: 96, previous: 94, change: 2.1 }, // Placeholder
  avgDays: {
    current: kpisData.avgDaysToComplete.current,
    previous: kpisData.avgDaysToComplete.previous,
    change: kpisData.avgDaysToComplete.change,
  },
  depositToInstall: {
    current: kpisData.daysDepositToInstall.current,
    previous: kpisData.daysDepositToInstall.previous,
    change: kpisData.daysDepositToInstall.change,
  },
} : null;
```

4. **Add loading states to KPI cards:**
```typescript
{kpisLoading ? (
  <Skeleton className="h-24 w-full" />
) : metrics ? (
  <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveMetric("revenue")}>
    {/* ... existing card content ... */}
  </Card>
) : null}
```

5. **Update date range selector:**
```typescript
<Select value={dateRange} onValueChange={setDateRange}>
  <SelectTrigger className="w-32">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="30d">Last 30 days</SelectItem>
    <SelectItem value="90d">Last 90 days</SelectItem>
    <SelectItem value="1y">This Year</SelectItem>
    <SelectItem value="all">All Time</SelectItem>
  </SelectContent>
</Select>
```

6. **Update Revenue chart:**
```typescript
{revenueLoading ? (
  <Skeleton className="h-80 w-full" />
) : revenueData && revenueData.length > 0 ? (
  <div className="h-80 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg flex items-center justify-center relative overflow-hidden">
    {/* Chart visualization using revenueData */}
    {/* For now, keep mock visualization but use real data for calculations */}
  </div>
) : (
  <div className="h-80 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg flex items-center justify-center">
    <div className="text-center text-slate-500">
      <DollarSign className="h-12 w-12 mx-auto mb-2" />
      <p>No revenue data available</p>
    </div>
  </div>
)}
```

7. **Update Top Products list:**
```typescript
{productsLoading ? (
  <div className="space-y-4">
    {[1, 2, 3, 4, 5].map((i) => (
      <Skeleton key={i} className="h-16 w-full" />
    ))}
  </div>
) : topProductsData && topProductsData.length > 0 ? (
  topProductsData.map((product, index) => {
    const totalRevenue = topProductsData.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
    const percentage = totalRevenue > 0 ? ((product.total_revenue || 0) / totalRevenue) * 100 : 0;
    
    return (
      <div key={product.product_name} className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{product.product_name}</span>
          <span className="text-sm text-slate-600">{formatCurrency(product.total_revenue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <span className="text-xs text-slate-500">{product.order_count} orders</span>
        </div>
      </div>
    );
  })
) : (
  <div className="text-center py-8 text-slate-600">No products data available</div>
)}
```

8. **Update Recent Activity:**
```typescript
{activityLoading ? (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-20 w-full" />
    ))}
  </div>
) : recentActivityData && recentActivityData.length > 0 ? (
  recentActivityData.map((activity, index) => (
    <div key={index} className="border-l-2 border-blue-200 pl-3 pb-3">
      <div className="text-sm font-medium">{activity.description}</div>
      <div className="text-xs text-slate-600">{activity.customer}</div>
      <div className="flex justify-between items-center mt-1">
        <Badge variant="outline">{formatCurrency(activity.amount)}</Badge>
        <span className="text-xs text-slate-500">{formatTimeAgo(activity.activity_date)}</span>
      </div>
    </div>
  ))
) : (
  <div className="text-center py-8 text-slate-600">No recent activity</div>
)}
```

---

## Task 5: SQL View for Recent Activity (Optional)

**File:** `supabase/migrations/YYYYMMDDHHmmss_reporting_recent_activity_view.sql`  
**Action:** CREATE (optional - can use direct queries instead)

**SQL View (if needed for performance):**

```sql
-- Create view for recent activity (optional - can use direct queries)
create or replace view public.v_recent_activity as
select 
  'invoice_paid' as type,
  i.updated_at as activity_date,
  i.amount,
  i.invoice_number as reference,
  i.customer_name as customer,
  'Invoice ' || i.invoice_number || ' paid' as description
from public.invoices i
where i.status = 'paid'

union all

select 
  'order_completed' as type,
  o.updated_at as activity_date,
  o.value as amount,
  o.id::text as reference,
  o.customer_name as customer,
  'Order ' || o.id::text || ' completed' as description
from public.orders o
where o.status = 'completed'

union all

select 
  'payment_received' as type,
  p.date as activity_date,
  p.amount,
  p.id::text as reference,
  i.customer_name as customer,
  'Payment received for invoice ' || i.invoice_number as description
from public.payments p
join public.invoices i on p.invoice_id = i.id

order by activity_date desc
limit 50;
```

**Note:** This view is optional. The implementation uses direct queries which is simpler and more flexible.

---

## Query Summary

### useReportingKPIs(dateRange)

**Queries:**
1. **Monthly Revenue (current):** `payments` table, sum `amount` where `date` between `fromDate` and `toDate`
2. **Monthly Revenue (previous):** Same query with previous period dates
3. **Orders This Month (current):** `orders` table, count where `created_at` between dates
4. **Orders This Month (previous):** Same query with previous period dates
5. **Avg. Days to Complete (current):** `orders` table, calculate `installation_date - deposit_date` where both exist and `installation_date >= fromDate`
6. **Avg. Days to Complete (previous):** Same calculation with previous period dates

**Date Range Handling:**
- `30d`: Last 30 days from today
- `90d`: Last 90 days from today
- `1y`: Jan 1 of current year to today
- `all`: No date filtering (null dates)

### useRevenueChart(dateRange)

**Query:**
- `v_monthly_revenue` view, select all, filter by `month` between `fromDate` and `toDate`, order by `month` ascending, limit 24

**Date Range Handling:**
- Same as above, filters `month` column

### useTopProducts(dateRange)

**Query:**
- `orders` table, select `order_type` and `value`, filter by `created_at` between dates (if provided), group by `order_type`, sum `value` and count orders, sort by total revenue descending, limit 5

**Date Range Handling:**
- Filters `created_at` column if dates provided

### useRecentActivity(limit)

**Queries:**
1. **Invoices paid:** `invoices` table, select where `status = 'paid'`, order by `updated_at` desc, limit `limit`
2. **Orders completed:** `orders` table, select where `status = 'completed'`, order by `updated_at` desc, limit `limit`
3. **Payments received:** `payments` table with join to `invoices`, order by `date` desc, limit `limit`

**Combines results:** Merges all three, sorts by `activity_date` descending, takes top `limit`

**Date Range Handling:**
- No date filtering (always shows most recent)

---

## Testing Checklist

### Setup
- [ ] Navigate to `/dashboard/reporting`
- [ ] Verify page loads without errors
- [ ] Check browser console for errors

### KPI Cards
- [ ] **Monthly Revenue card** shows real value from payments table
- [ ] **Orders This Month card** shows real count from orders table
- [ ] **Customer Satisfaction card** shows placeholder (96%)
- [ ] **Avg. Days to Complete card** shows calculated value
- [ ] **Days Deposit to Install card** shows calculated value
- [ ] All cards show percentage change indicators
- [ ] Clicking a card updates `activeMetric` state

### Date Range Filtering
- [ ] Select "Last 30 days" → KPIs update to last 30 days
- [ ] Select "Last 90 days" → KPIs update to last 90 days
- [ ] Select "This Year" → KPIs update to year-to-date
- [ ] Select "All Time" → KPIs show all data
- [ ] Changing date range updates all metrics simultaneously
- [ ] Revenue chart updates with date range
- [ ] Top Products list updates with date range

### Revenue Chart
- [ ] Chart tab shows "Revenue Analysis" title
- [ ] Chart displays data from `v_monthly_revenue` view
- [ ] Loading skeleton shows while fetching
- [ ] Empty state shows if no data
- [ ] Chart updates when date range changes

### Top Products
- [ ] List shows top 5 products by revenue
- [ ] Each product shows name, revenue (formatted as GBP), order count
- [ ] Progress bars show percentage of total revenue
- [ ] Loading skeleton shows while fetching
- [ ] Empty state shows if no products
- [ ] List updates when date range changes

### Recent Activity
- [ ] Shows unified feed from invoices, orders, payments
- [ ] Each activity shows description, customer, amount (formatted), time ago
- [ ] Activities sorted by date (newest first)
- [ ] Loading skeleton shows while fetching
- [ ] Empty state shows if no activity
- [ ] Time formatting works ("2 hours ago", "3 days ago")

### Loading States
- [ ] Skeleton loaders show for KPIs while loading
- [ ] Skeleton shows for revenue chart while loading
- [ ] Skeleton shows for top products while loading
- [ ] Skeleton shows for recent activity while loading
- [ ] No flickering or layout shifts

### Error Handling
- [ ] Toast notification shows on error
- [ ] Error message is user-friendly
- [ ] Page doesn't crash on error
- [ ] Fallback empty states show on error

### Currency Formatting
- [ ] All amounts formatted as GBP (£)
- [ ] Decimal places show correctly (2 places)
- [ ] Large numbers formatted with commas

### Percentage Changes
- [ ] Positive changes show green with up arrow
- [ ] Negative changes show red with down arrow
- [ ] Percentage calculated correctly
- [ ] Handles division by zero gracefully

### Integration
- [ ] No dummy data remains in code
- [ ] All hooks use Supabase queries
- [ ] Date range passed correctly to all hooks
- [ ] Query keys include date range for proper caching
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)

---

## Summary

This implementation plan provides:

1. **File-by-file changes:** Exact files to create/update
2. **Complete code:** Full implementations for hooks, transforms, and page updates
3. **Query details:** Exact Supabase queries for each hook
4. **Date range handling:** How date ranges are calculated and passed
5. **Testing checklist:** Comprehensive test scenarios

The implementation maintains the exact same UI while replacing all dummy data with live Supabase queries.

**Ready for implementation via `/implement` command**

