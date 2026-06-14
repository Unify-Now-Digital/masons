# Data Model: Finance Hub — Outstanding Invoice Triage

## Overview

Frontend-only extension of the Finance module. No new tables or migrations. Hub reads `public.invoices_with_breakdown` (same as Invoices tab), applies server + client filters, derives aggregates and horizon buckets in TypeScript using shared helpers in `invoiceRemaining.ts`.

## Source: `invoices_with_breakdown`

Unchanged from Finance Invoices Tab (`008`). Hub uses a subset of columns:

| Field | Used for |
|-------|----------|
| `id` | Row identity, drawer open |
| `organization_id` | Tenant filter |
| `deleted_at` | Must be null |
| `amount` | SQL floor `>= 5` GBP (test/seed exclusion; **not** `is_test`) |
| `status` | SQL `pending` only |
| `invoice_number` | Attention list |
| `customer_name` | Attention list |
| `issue_date` | Optional context |
| `due_date` | Horizon buckets, overdue flag |
| `amount` | Remaining helper (pounds) |
| `amount_paid` | Partial flag, remaining helper (pence) |
| `amount_remaining` | Remaining helper (pence) |
| Breakdown columns | Drawer only (unchanged) |

## Shared helpers: `invoiceRemaining.ts`

### `invoiceRemainingPence(row)`

Returns non-negative integer pence — canonical remaining balance.

### `isInvoiceOwed(row)`

`invoiceRemainingPence(row) > 0`.

### `formatInvoiceRemaining(row)`

Display string for remaining column/drawer/hub list; uses `formatGbpPence` from `@/shared/lib/formatters`.

### `isReliableDueDate(dueDate)`

`false` when missing/invalid OR `dueDate >= '2100-01-01'`; else `true`.

### `getInvoiceHorizonBucket(row, today?)`

Returns `'overdue' | 'due-30' | 'due-later' | 'no-date'` for owed rows.

### `getAttentionFlags(row, today?)`

Returns `{ partial: boolean; overdue: boolean }`.

### `attentionListSortKey(row)`

Numeric priority for stable sort (partial+overdue highest).

## Derived: `FinanceHubInvoice` (frontend)

Mapped from each owed pending row:

| Field | Derivation |
|-------|------------|
| `remainingPence` | `invoiceRemainingPence(row)` |
| `remainingDisplay` | `formatInvoiceRemaining(row)` |
| `partial` | `amount_paid > 0` |
| `overdue` | reliable date AND past due AND owed |
| `horizon` | `getInvoiceHorizonBucket(row)` |
| `sortPriority` | `attentionListSortKey(row)` |

## Derived: `FinanceHubSummary` (frontend)

| Field | Type | Derivation |
|-------|------|------------|
| `totalOutstandingGbp` | number | sum remaining pence / 100 |
| `unpaidCount` | number | count owed rows |
| `totalOverdueGbp` | number | sum remaining pence where overdue flag |
| `horizonCounts` | record | count per bucket |
| `horizonBalancesGbp` | record | optional sum per bucket |
| `attentionList` | `FinanceHubInvoice[]` | sorted owed rows |

## Filter models

### SQL population (hub fetch)

```text
organization_id = activeOrg
AND deleted_at IS NULL
AND status = 'pending'
AND amount >= 5 (GBP)
→ client: isHubEligibleInvoice(row) AND isInvoiceOwed(row)
```

### `FinanceInvoiceStatusFilter` (existing, extended usage)

Unchanged enum: `'all' | 'unpaid' | 'overdue' | 'paid'`.

Horizon routing sets `'unpaid'` then applies horizon client filter.

### `FinanceInvoiceHorizonFilter` (new UI state)

| Value | Client filter on unpaid rows |
|-------|------------------------------|
| `null` | No horizon filter |
| `'overdue'` | `horizon === 'overdue'` |
| `'due-30'` | `horizon === 'due-30'` |
| `'due-later'` | `horizon === 'due-later'` |
| `'no-date'` | `horizon === 'no-date'` |

## UI state (`FinancePage`)

| State | Default | Purpose |
|-------|---------|---------|
| `tab` | `'hub'` | Default landing tab |
| `horizonFilter` | `null` | Invoices tab horizon slice |
| `statusFilter` | `'all'` | Existing invoice pills |
| `selectedInvoice` | `null` | Shared drawer |

## Validation rules

1. Hub MUST NOT include rows where `isInvoiceOwed` is false.
2. Hub MUST NOT include `draft`, `paid`, `cancelled`, or `overdue` status rows (SQL pending gate).
3. Unreliable due dates MUST only appear in `no-date` bucket (SC-006).
4. Headline `totalOutstandingGbp` MUST equal sum of `invoiceRemainingPence` / 100 over attention set.
5. Drawer remaining MUST equal hub list remaining for the same invoice id.
6. Partial flag MUST NOT show when `amount_paid` is 0 or null.
7. Overdue flag MUST NOT show when due date is unreliable, even if status display would say overdue.

## Relationships

```text
FinancePage
├── HubTab ── useFinanceHub() ── fetchFinanceHubInvoices()
├── InvoicesTab ── useFinanceInvoices('unpaid') + horizonFilter client slice
└── InvoiceDrawer ── formatInvoiceRemaining() / invoiceRemainingPence()
```

## Out of scope

- Order-level `fetchFinanceTotals` ribbon changes
- New database views or RPCs
- Invoicing module imports
- Payment recording from hub
