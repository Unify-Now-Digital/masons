# Contract: Finance invoices list (Supabase client)

## Purpose

Return organization-scoped invoice rows with order breakdown fields for the Finance **Invoices** tab table and detail drawer. Read-only; no RPC.

## Interface

- **Type**: Supabase PostgREST `select` on view `invoices_with_breakdown`
- **Client**: `@/shared/lib/supabase` (authenticated anon key; RLS enforced on `invoices`)

## Function

```text
fetchFinanceInvoices(organizationId: string, filter: FinanceInvoiceStatusFilter): Promise<FinanceInvoiceRow[]>
```

## Request contract

### Required filters (every call)

| Filter | Operator | Value |
|--------|----------|-------|
| `organization_id` | `eq` | `organizationId` from `useOrganization()` |
| `deleted_at` | `is` | `null` |

### Optional status filter

| `filter` value | PostgREST predicate |
|----------------|---------------------|
| `all` | (none) |
| `unpaid` | `status.eq.pending` |
| `overdue` | `or=(status.eq.overdue,and(status.eq.pending,due_date.lt.{today}))` where `{today}` is `YYYY-MM-DD` local/org-consistent date |
| `paid` | `status.eq.paid` |

### Sort

| Column | Direction |
|--------|-----------|
| `due_date` | ascending |

### Select columns (minimum)

```text
id,
invoice_number,
customer_name,
issue_date,
due_date,
amount,
amount_paid,
amount_remaining,
status,
hosted_invoice_url,
stripe_invoice_status,
locked_at,
main_product_total,
additional_options_total,
permit_total_cost,
organization_id
```

## Response contract

- **Success**: `FinanceInvoiceRow[]` (zero or more rows), already sorted by `due_date` ascending.
- **Error**: Propagate Supabase `error`; UI shows retryable error state.

### Row shape (TypeScript logical)

```typescript
type FinanceInvoiceStatusFilter = 'all' | 'unpaid' | 'overdue' | 'paid';

interface FinanceInvoiceRow {
  id: string;
  organization_id: string;
  invoice_number: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  amount: number;
  amount_paid: number | null;
  amount_remaining: number | null;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  hosted_invoice_url: string | null;
  stripe_invoice_status: string | null;
  locked_at: string | null;
  main_product_total: number | null;
  additional_options_total: number | null;
  permit_total_cost: number | null;
}
```

## Display contract (frontend — not returned by API)

| UI element | Rule |
|------------|------|
| Tab label count | `Invoices (${rows.length})` for current filter result set |
| Issue / due dates | Compact `en-GB` e.g. `"12 May"` |
| Total | `formatGbpDecimal(amount)` |
| Paid | `—` if paid pence is 0/null; else `formatGbpPence(amount_paid)` |
| Remaining | `formatGbpPence(amount_remaining)`; red when overdue |
| Status pill | paid→green, pending→amber, overdue→red, draft/cancelled→neutral |
| Display status | pending + past due → treat as overdue for pill/color |
| Sent dot | visible when `hosted_invoice_url` is truthy |

## Authorization contract

1. Caller must be authenticated (existing app session).
2. RLS on `invoices` MUST restrict rows to permitted organizations.
3. Client MUST still pass `organization_id` filter (defense in depth + correct tab data).

## React Query contract

```typescript
useFinanceInvoices(filter: FinanceInvoiceStatusFilter, options?: { enabled?: boolean })

queryKey: ['finance', 'invoices', organizationId, filter]
enabled: !!organizationId && (options?.enabled ?? true)
```

## Error contract

| Condition | UI behavior |
|-----------|-------------|
| Network / Supabase error | Error message + retry button refetches query |
| Empty result set | Empty state copy per active filter |
| Loading | Skeleton or inline “Loading…” consistent with other Finance tabs |

## Non-goals

- Pagination cursors
- Realtime subscriptions
- Server-side full-text search
