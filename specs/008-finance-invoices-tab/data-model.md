# Data Model: Finance Invoices Tab

## Overview

Read-only list and detail experience over `public.invoices_with_breakdown`, scoped by organization and soft-delete rules. No new tables or persisted UI state beyond React component state (selected invoice, active filter).

## Source: `invoices_with_breakdown` (view)

Underlying entity: `public.invoices` (`i.*`) plus aggregated order breakdown:

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `id` | uuid | — | Row identity |
| `organization_id` | uuid | — | Tenant scope (required filter) |
| `deleted_at` | timestamptz | — | Must be null |
| `invoice_number` | text | — | Monospace display |
| `customer_name` | text | — | Table + drawer header |
| `issue_date` | date | — | Compact display |
| `due_date` | date | — | Sort key; red when overdue |
| `amount` | numeric(10,2) | **GBP pounds** | Invoice total |
| `amount_paid` | bigint | **pence** | Divide by 100 for display |
| `amount_remaining` | bigint | **pence** | Divide by 100 for display |
| `status` | enum | — | `draft`, `pending`, `paid`, `overdue`, `cancelled` |
| `hosted_invoice_url` | text | — | Sent indicator when present |
| `stripe_invoice_status` | text | — | Optional drawer section |
| `locked_at` | timestamptz | — | Optional drawer section |
| `main_product_total` | numeric | pounds | Memorial line |
| `additional_options_total` | numeric | pounds | Additional options line |
| `permit_total_cost` | numeric | pounds | Permit line |

## Derived: FinanceInvoiceListItem (frontend)

Mapped from each query row for table + drawer:

| Field | Derivation |
|-------|------------|
| `displayStatus` | `overdue` if `status=pending` and `due_date < today`; else `status` |
| `isOverdue` | `displayStatus === 'overdue'` |
| `paidDisplay` | `—` if paid pence is 0; else formatted GBP |
| `remainingDisplay` | formatted pence; red styling when overdue |
| `totalDisplay` | `formatGbpDecimal(amount)` |
| `sentLinkSent` | `!!hosted_invoice_url` |
| `percentPaid` | `paid / (paid + remaining)` when remaining known; else from `amount` |
| `hasStripeSection` | any of stripe status, hosted URL, locked_at |

## Filter Model: `FinanceInvoiceStatusFilter`

| Value | Query predicate |
|-------|-----------------|
| `all` | No status predicate |
| `unpaid` | `status = 'pending'` |
| `overdue` | `status = 'overdue'` OR (`status = 'pending'` AND `due_date < today`) |
| `paid` | `status = 'paid'` |

Default: `all`.

## UI State

| State | Storage | Purpose |
|-------|---------|---------|
| `statusFilter` | `useState` in `InvoicesTab` | Pill selection |
| `selectedInvoiceId` | `useState` in `FinancePage` or tab | Drawer open target |
| `selectedInvoice` | Derived from list row | Drawer content |

## Validation Rules

1. Every listed row MUST have `organization_id` equal to active org from context.
2. Rows with non-null `deleted_at` MUST NOT appear.
3. Sort order MUST be `due_date ASC` (nulls last if any—handle in mapper if needed).
4. Drawer breakdown lines MUST only render when numeric value `> 0`.
5. Stripe section MUST be omitted when all three fields are null/empty.

## Relationships

```text
invoices (1) ──< orders (N)   via orders.invoice_id
                      │
                      └── aggregated into breakdown totals on view
```

## Out of Scope

- Mutations (create, update, send payment link)
- `invoice_payments` line-item history in drawer
- Test invoice exclusion (`is_test`) — not required by spec; can add `excludeTest` later matching invoicing module
