# Contract: Finance hub triage (Supabase client + shared helpers)

## Purpose

Return organization-scoped **outstanding** invoice rows and derived hub aggregates for the Finance **Hub** landing tab. Read-only. Aggregations and horizon bucketing run client-side on the fetched set using `invoiceRemaining.ts` helpers.

## Interfaces

### Fetch

```text
fetchFinanceHubInvoices(organizationId: string): Promise<FinanceInvoiceRow[]>
```

Returns **owed** pending invoices only (server candidates filtered client-side by `isHubEligibleInvoice` then `isInvoiceOwed`).

### React Query

```text
useFinanceHub(options?: { enabled?: boolean })
```

```typescript
queryKey: ['finance', 'hub', organizationId]
enabled: !!organizationId && (options?.enabled ?? true)
```

Returns `{ data: FinanceHubSummary | undefined, ... }` where summary is computed in the hook or a pure `buildFinanceHubSummary(rows)` function.

---

## Request contract (fetch)

### Source

- View: `invoices_with_breakdown`
- Client: `@/shared/lib/supabase`

### Required filters

| Filter | Operator | Value |
|--------|----------|-------|
| `organization_id` | `eq` | Active org from `useOrganization()` |
| `deleted_at` | `is` | `null` |
| `status` | `eq` | `'pending'` |
| `amount` | `gte` | `5` (GBP; test/seed floor — **never** `is_test`) |
| owed prefilter | `or` | `amount_remaining.gt.0,amount_remaining.is.null` |

### Select columns

Same minimum set as `contracts/finance-invoices-list.md` (008).

### Sort

Server: `.order('due_date', { ascending: true })` (nullable/unreliable dates sort last in client attention list).

### Post-fetch client filter

```typescript
rows.filter(isHubEligibleInvoice).filter(isInvoiceOwed)
```

---

## Shared helper contract (`invoiceRemaining.ts`)

### Input shape

```typescript
interface InvoiceRemainingInput {
  amount: number;
  amount_paid?: number | null;
  amount_remaining?: number | null;
}
```

### Functions

| Function | Returns | Contract |
|----------|---------|----------|
| `invoiceRemainingPence(row)` | `number` | Non-negative pence; see research R1 |
| `isInvoiceOwed(row)` | `boolean` | `invoiceRemainingPence(row) > 0` |
| `formatInvoiceRemaining(row)` | `string` | GBP display via `formatGbpPence`; used by hub list, table col ~572, drawer ~694 |
| `isReliableDueDate(dueDate)` | `boolean` | `false` if missing OR `dueDate >= '2100-01-01'` |
| `getInvoiceHorizonBucket(row, today?)` | horizon enum | Only valid when `isInvoiceOwed`; see research R3 |
| `getAttentionFlags(row, today?)` | `{ partial, overdue }` | partial = paid pence > 0; overdue = owed + reliable + past due |

**Mandatory consumers** (no duplicate remaining math elsewhere in finance module):
- Hub attention list remaining column
- `InvoicesTab` remaining table cell
- `InvoiceDrawer` remaining row
- Hub headline aggregates

---

## Summary contract (`FinanceHubSummary`)

```typescript
interface FinanceHubSummary {
  totalOutstandingGbp: number;
  unpaidCount: number;
  totalOverdueGbp: number;
  horizon: {
    overdue: { count: number; balanceGbp: number };
    due30: { count: number; balanceGbp: number };
    dueLater: { count: number; balanceGbp: number };
    noDate: { count: number; balanceGbp: number };
  };
  attentionList: Array<FinanceInvoiceRow & {
    remainingPence: number;
    remainingDisplay: string;
    partial: boolean;
    overdue: boolean;
    horizon: FinanceInvoiceHorizonFilter;
    sortPriority: number;
  }>;
}
```

---

## Horizon routing contract

When user clicks horizon segment `H`:

1. `setTab('invoices')`
2. `setStatusFilter('unpaid')`
3. `setHorizonFilter(H)` where `H ∈ 'overdue' | 'due-30' | 'due-later' | 'no-date'`

`InvoicesTab` displays rows where:
- `isInvoiceOwed(row)` AND
- `getInvoiceHorizonBucket(row) === H`

When `horizonFilter` is null, Invoices tab behaves as today (status pills only).

---

## Display contract

| Surface | Rule |
|---------|------|
| Hub headline outstanding | `formatGbp` whole pounds from `totalOutstandingGbp` (match existing `TotalTile` pattern) |
| Hub headline overdue | `totalOverdueGbp` formatted consistently |
| Attention list remaining | `formatInvoiceRemaining(row)` |
| PARTIAL pill | visible when `partial === true` |
| OVERDUE pill | visible when `overdue === true` |
| Horizon segment count | `horizon.*.count` |
| Due date in attention list | show compact date when reliable; `"—"` or “No date” when unreliable |

---

## Authorization contract

Same as Finance Invoices Tab (008): authenticated session, RLS on `invoices`, client org filter mandatory.

---

## Error contract

| Condition | UI |
|-----------|-----|
| Fetch error | Hub sections show error + retry |
| Empty owed set | Headline zeros; attention list empty copy; horizon counts all zero |
| Loading | Inline loading consistent with other Finance tabs |

---

## Non-goals

- Server-side aggregation RPC
- Realtime subscriptions
- Mutations from hub
- Changing order-based top ribbon totals
