# Implementation Plan: Reporting & Analytics - Live Data Integration

**Branch:** `feature/reporting-live-data-integration`  
**Specification:** `specs/reporting-live-data-integration-plan.md`

---

## Overview

Upgrade the existing Reporting & Analytics page to use real Supabase data instead of dummy values. Keep the UI exactly as it is now, but replace all metrics, charts, product lists, and recent activity with real-time data fetched from Supabase SQL views and tables.

**Current State:**
- Module folder: `src/modules/reporting`
- Page: `ReportingPage.tsx` uses hardcoded dummy data
- Existing hooks: `useReporting.ts` with API-based hooks
- Existing views: `v_monthly_revenue`, `v_order_status_summary`, `v_top_products`

**Goal:**
Connect all reporting metrics to live Supabase data while maintaining the exact same UI/UX.

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create reporting hooks | Create/Update | `src/modules/reporting/hooks/useReporting.ts` | High | None |
| 2 | Create transform utilities | Create | `src/modules/reporting/utils/reportingTransform.ts` | High | None |
| 3 | Update ReportingPage with live data | Update | `src/modules/reporting/pages/ReportingPage.tsx` | High | Tasks 1-2 |
| 4 | Add date range filtering | Update | `src/modules/reporting/pages/ReportingPage.tsx` | High | Task 3 |
| 5 | Create SQL views/functions if needed | Create | `supabase/migrations/` | Medium | None |
| 6 | Validation & QA | Verify | - | High | Tasks 1-5 |

---

## Task 1: Create Reporting Hooks

**File:** `src/modules/reporting/hooks/useReporting.ts`  
**Action:** UPDATE

**Requirements:**
- Replace API-based hooks with direct Supabase queries
- Create hooks for KPIs, revenue chart, top products, and recent activity
- Support date range filtering via query params
- Handle loading and error states

**New Hooks:**

1. **`useReportingKPIs(dateRange)`**
   - Fetches: Monthly Revenue, Orders This Month, Avg. Days to Complete, Days Deposit to Install
   - Returns: Current values, previous period values, percentage changes

2. **`useRevenueChart(dateRange)`**
   - Fetches from: `v_monthly_revenue` view
   - Returns: Array of monthly revenue data points

3. **`useTopProducts(dateRange)`**
   - Fetches: Top 5 products by revenue from orders table
   - Returns: Product name, revenue, order count, percentage

4. **`useRecentActivity(limit)`**
   - Fetches: Unified recent activity from invoices, orders, payments
   - Returns: Array of activity items with type, timestamp, amount, description

**Query Key Structure:**
```typescript
export const reportingKeys = {
  kpis: (dateRange: string) => ['reporting', 'kpis', dateRange] as const,
  revenueChart: (dateRange: string) => ['reporting', 'revenue-chart', dateRange] as const,
  topProducts: (dateRange: string) => ['reporting', 'top-products', dateRange] as const,
  recentActivity: (limit: number) => ['reporting', 'recent-activity', limit] as const,
};
```

---

## Task 2: Create Transform Utilities

**File:** `src/modules/reporting/utils/reportingTransform.ts`  
**Action:** CREATE

**Requirements:**
- Currency formatting (GBP)
- Percentage change calculations
- Time formatting ("2 hours ago", "3 days ago")
- Date range calculations
- Chart data transformation

**Functions:**

1. **`formatCurrency(amount: number): string`**
   - Format as GBP: £12,345.67

2. **`calculatePercentageChange(current: number, previous: number): number`**
   - Calculate percentage change with proper sign

3. **`formatTimeAgo(timestamp: string): string`**
   - Relative time formatting

4. **`getDateRange(range: string): { fromDate: string, toDate: string }`**
   - Convert range string to date boundaries

5. **`transformRevenueChartData(data: MonthlyRevenue[]): ChartData`**
   - Transform DB data to chart format
   - Fill missing months with zero values

---

## Task 3: Update ReportingPage with Live Data

**File:** `src/modules/reporting/pages/ReportingPage.tsx`  
**Action:** UPDATE

**Key Changes:**

1. **Remove dummy data:**
   - Remove `metrics` object
   - Remove `topProducts` array
   - Remove `recentActivities` array

2. **Add hooks:**
   ```typescript
   const { data: kpisData, isLoading: kpisLoading } = useReportingKPIs(dateRange);
   const { data: revenueData, isLoading: revenueLoading } = useRevenueChart(dateRange);
   const { data: topProductsData, isLoading: productsLoading } = useTopProducts(dateRange);
   const { data: recentActivityData, isLoading: activityLoading } = useRecentActivity(10);
   ```

3. **Update KPI cards:**
   - Monthly Revenue: `kpisData?.monthlyRevenue`
   - Orders This Month: `kpisData?.ordersThisMonth`
   - Customer Satisfaction: Keep as placeholder (96%)
   - Avg. Days to Complete: `kpisData?.avgDaysToComplete`
   - Days Deposit to Install: `kpisData?.daysDepositToInstall`

4. **Update Revenue Analysis chart:**
   - Use `revenueData` from `useRevenueChart()`
   - Transform data for chart display
   - Show loading skeleton while fetching

5. **Update Top Products list:**
   - Use `topProductsData` from `useTopProducts()`
   - Map to existing UI structure

6. **Update Recent Activity:**
   - Use `recentActivityData` from `useRecentActivity()`
   - Format timestamps with `formatTimeAgo()`

7. **Add loading states:**
   - Skeleton loaders for KPIs
   - Loading overlay for charts
   - Skeleton for product list and activity

8. **Add error handling:**
   - Toast notifications on errors
   - Fallback empty states

---

## Task 4: Add Date Range Filtering

**File:** `src/modules/reporting/pages/ReportingPage.tsx`  
**Action:** UPDATE

**Requirements:**
- Update date range selector to match requirements
- Options: Last 30 days, Last 90 days, This Year, All Time
- Pass date range to all hooks
- Update query params in URL (optional enhancement)

**Date Range Options:**
- `30d` → Last 30 days
- `90d` → Last 90 days
- `1y` → This Year (Jan 1 to today)
- `all` → All Time

**Implementation:**
```typescript
const [dateRange, setDateRange] = useState("30d");

// Update Select component
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

---

## Task 5: Create SQL Views/Functions (if needed)

**File:** `supabase/migrations/YYYYMMDDHHmmss_reporting_live_data_views.sql`  
**Action:** CREATE (if needed)

**Potential New Views:**

1. **`v_recent_activity`** (if unified query is complex)
   ```sql
   create or replace view public.v_recent_activity as
   select 
     'invoice_paid' as type,
     i.updated_at as activity_date,
     i.amount,
     i.invoice_number as reference,
     i.customer_name
   from public.invoices i
   where i.status = 'paid'
   
   union all
   
   select 
     'order_completed' as type,
     o.updated_at as activity_date,
     o.value as amount,
     o.id::text as reference,
     o.customer_name
   from public.orders o
   where o.status = 'completed'
   
   union all
   
   select 
     'payment_received' as type,
     p.date as activity_date,
     p.amount,
     p.id::text as reference,
     i.customer_name
   from public.payments p
   join public.invoices i on p.invoice_id = i.id
   
   order by activity_date desc
   limit 50;
   ```

2. **`v_kpi_metrics`** (if complex calculations needed)
   - Monthly revenue from payments
   - Orders count
   - Average days calculations

**Note:** Use existing views where possible. Only create new views if queries are too complex for direct Supabase queries.

---

## Task 6: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors)
- Manual flows:
  - All KPI cards show real data
  - Revenue chart displays monthly data
  - Top products list shows real products
  - Recent activity shows real events
  - Date range filtering works
  - Loading states display correctly
  - Error states show toast notifications
  - No dummy data remains

---

## Database Schema Reference

### Existing Tables

**`public.orders`**
- `id` uuid PK
- `customer_name` text
- `order_type` text
- `value` numeric
- `deposit_date` date
- `installation_date` date
- `status` text
- `created_at` timestamp
- `updated_at` timestamp

**`public.invoices`**
- `id` uuid PK
- `invoice_number` text
- `customer_name` text
- `amount` numeric
- `status` text ('paid', 'pending', 'overdue')
- `issue_date` date
- `created_at` timestamp
- `updated_at` timestamp

**`public.payments`**
- `id` uuid PK
- `invoice_id` uuid FK → invoices.id
- `amount` numeric
- `date` date
- `method` text
- `created_at` timestamp

### Existing Views

**`public.v_monthly_revenue`**
- `month` timestamp
- `invoice_count` integer
- `paid_amount` numeric
- `outstanding_amount` numeric
- `total_amount` numeric

**`public.v_order_status_summary`**
- `total_orders` integer
- `ready_for_install` integer
- `overdue` integer
- `pending_approval` integer
- `avg_progress` numeric

**`public.v_top_products`**
- `product_name` text
- `order_count` integer
- `total_revenue` numeric

---

## KPI Calculations

### Monthly Revenue
```sql
select sum(amount) as monthly_revenue
from public.payments
where date >= :fromDate and date <= :toDate;
```

### Orders This Month
```sql
select count(*) as orders_count
from public.orders
where created_at >= :fromDate and created_at <= :toDate;
```

### Avg. Days to Complete
```sql
select avg(
  extract(day from (installation_date - deposit_date))
) as avg_days
from public.orders
where installation_date is not null
  and deposit_date is not null
  and installation_date >= :fromDate;
```

### Days Deposit to Install
```sql
select avg(
  extract(day from (installation_date - deposit_date))
) as avg_deposit_to_install
from public.orders
where installation_date is not null
  and deposit_date is not null
  and installation_date >= :fromDate;
```

---

## Recent Activity Query

**Unified Recent Activity:**
```sql
(
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
)
order by activity_date desc
limit 10;
```

---

## Target File Tree

```
src/modules/reporting/
├── hooks/
│   └── useReporting.ts (UPDATED)
├── pages/
│   └── ReportingPage.tsx (UPDATED)
├── utils/
│   └── reportingTransform.ts (NEW)
├── types/
│   └── reporting.types.ts (UPDATED)
└── index.ts

supabase/migrations/
└── YYYYMMDDHHmmss_reporting_live_data_views.sql (NEW, if needed)
```

---

## Validation Checklist

- [ ] All dummy data removed from ReportingPage
- [ ] `useReportingKPIs()` fetches real data from Supabase
- [ ] `useRevenueChart()` fetches from `v_monthly_revenue` view
- [ ] `useTopProducts()` fetches top 5 products by revenue
- [ ] `useRecentActivity()` fetches unified activity feed
- [ ] Date range filtering works (30d, 90d, 1y, all)
- [ ] Monthly Revenue KPI shows sum from payments table
- [ ] Orders This Month KPI shows count from orders table
- [ ] Avg. Days to Complete calculated from orders
- [ ] Days Deposit to Install calculated from orders
- [ ] Customer Satisfaction remains placeholder
- [ ] Revenue chart displays real monthly data
- [ ] Top Products list shows real products
- [ ] Recent Activity shows real events
- [ ] Loading states display correctly
- [ ] Error states show toast notifications
- [ ] Currency formatting works (GBP)
- [ ] Time formatting works ("2 hours ago")
- [ ] Percentage changes calculated correctly
- [ ] All imports use `@/` aliases
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No console errors

---

## Success Criteria

✅ Reporting & Analytics page displays live data from Supabase. All KPI cards show real metrics. Revenue chart displays monthly data from `v_monthly_revenue`. Top Products list shows real products from orders table. Recent Activity shows unified feed from invoices, orders, and payments. Date range filtering works correctly. Loading and error states are handled. All dummy data is removed. UI remains exactly the same.

---

## Implementation Notes

### Date Range Calculations

- **Last 30 days:** `fromDate = today - 30 days`, `toDate = today`
- **Last 90 days:** `fromDate = today - 90 days`, `toDate = today`
- **This Year:** `fromDate = Jan 1 of current year`, `toDate = today`
- **All Time:** `fromDate = null`, `toDate = null` (no date filtering)

### Percentage Change Calculation

For each KPI, calculate:
1. Current period value (based on date range)
2. Previous period value (same duration, shifted back)
3. Percentage change: `((current - previous) / previous) * 100`

### Chart Data Transformation

- Fetch monthly revenue data from `v_monthly_revenue`
- Fill missing months with zero values
- Transform to chart format: `{ month: string, revenue: number }`
- Sort by month ascending

### Error Handling

- Use `useToast()` for error notifications
- Show fallback empty states for charts
- Display "No data available" messages
- Log errors to console for debugging

### Performance

- Use `useMemo` for calculated values
- Cache date range calculations
- Debounce date range changes if needed
- Use TanStack Query caching effectively

---

*Specification created: Reporting & Analytics Live Data Integration*  
*Ready for implementation via `/plan` command*

