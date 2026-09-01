# Data Model — Finance Consolidation

**No schema change (AC-F4).** Everything below is a CLIENT-side shape. The single server source is the existing view `invoices_with_breakdown` (definition: migration `20260715150100…sql:6-47`), read-only.

## 1. `FinanceInvoiceRow` — unified row type off `invoices_with_breakdown`

The one row shape both tiles and table consume (F2 §1 units table). PostgREST returns bigint as **JS strings** — `Number()` before arithmetic; **never ×100 again**.

| Field | Type (wire) | Unit | Notes |
|---|---|---|---|
| `id` | string (uuid) | — | |
| `organization_id` | string (uuid) | — | org guard at query layer |
| `invoice_number` | string | — | carries the `INV-WEB-` enquiry prefix (portal-written) |
| `status` | string | — | `'pending'`/`'paid'`/… ; `'paid'` ⇒ remaining 0 (canonical rule, FR-017) |
| `stripe_invoice_status` | string \| null | — | `'void'`/`'uncollectible'` drive `isVoidedStripeInvoice` |
| `stripe_invoice_id` | string \| null | — | feeds lock predicate (`isInvoiceLocked`, T5) |
| `amount` | number | **decimal GBP £** | |
| `amount_paid` | string \| null | **bigint pence-as-string** | `Number()` first |
| `amount_remaining` | string \| null | **bigint pence-as-string** | `Number()` first; display via canonical helpers only |
| `main_product_total` | number | decimal £ | `COALESCE(o.value,0)`; **0 when `order_id IS NULL`** |
| `additional_options_total` | number | decimal £ | `SUM(order_additional_options.cost)`; 0 when no order |
| `permit_total_cost` | number | decimal £ | `COALESCE(o.permit_cost,0)`; 0 when no order |
| `due_date` | string \| null | date | default sort key (asc); reliability-checked before bucketing |
| `created_at` | string | timestamp | today's fetch order — superseded |
| `deleted_at` | string \| null | timestamp | always filtered `IS NULL` at the query layer |
| `is_test` | boolean | — | filtered per test toggle at the query layer |
| `order_id` | string \| null | uuid | null ⇒ the three order-derived money columns are 0 |
| *(customer/person display fields)* | — | — | present in `INVOICES_LIST_SELECT` (`invoicing.api.ts:34`); exact list = **OQ2**, enumerated at C1 |

Not in the list select (sidebar-only, unchanged): `intended_deposit_pence` (pence-as-string, `InvoiceDetailSidebar.tsx:132-133,201-202`).

**OQ2 resolved (C1, 2026-09-01)** — `INVOICES_LIST_SELECT` (`invoicing.api.ts:33-34`), 30 fields verbatim:
`id, order_id, person_id, invoice_number, customer_name, amount, status, due_date, issue_date, payment_method, payment_date, notes, created_at, updated_at, deleted_at, stripe_checkout_session_id, stripe_payment_intent_id, stripe_status, paid_at, stripe_invoice_id, stripe_invoice_status, hosted_invoice_url, amount_paid, amount_remaining, revised_from_invoice_id, locked_at, user_id, main_product_total, additional_options_total, permit_total_cost`.
Note: `organization_id` and `is_test` are **filter-only** (applied in the query, never selected) — client code must not expect them on returned rows.

## 2. `AgingBucket` and `TileFilter`

```ts
type AgingBucket = 'd7' | 'd7to30' | 'd30plus' | 'notYetDue' | null
// 'd7'      daysPastDue <= 7          (getOverdueAgingBucket, invoiceRemaining.ts:157-166)
// 'd7to30'  daysPastDue <= 30
// 'd30plus' else (overdue)
// 'notYetDue' horizon due30 + dueLater (synthesized; F2 §2)
// null      no reliable due date → visible under 'all' ONLY (spec A-2)

type TileFilter = 'd7' | 'd7to30' | 'd30plus' | 'notYetDue' | 'all'
// 'all' = no filter: full working set, paid included, void rows dimmed
```

Bucketing domain: the four non-`all` tiles classify **hub-eligible rows only** (`isHubEligibleInvoice`: `status==='pending'`, not void, `amount >= 5` (£), owed). Void/paid/sub-£5/enquiry-hidden rows never enter a bucket.

## 3. Tile filter state (page-level)

```ts
// Lives on FinancePage (owner of the tiles); passed down as props — never a key.
interface FinanceFilterState {
  activeTile: TileFilter        // default 'all'
  showEnquiry: boolean          // default false; hides invoice_number.startsWith('INV-WEB-')
}
```

Enquiry hiding applies to the working set **before** bucketing (spec A-1): hidden rows are absent from tiles and table alike.

## 4. `FinanceSummary` — derived aggregates (client-side, from the unified row set)

```ts
interface FinanceSummary {
  buckets: Record<'d7' | 'd7to30' | 'd30plus' | 'notYetDue', { count: number; totalPence: number }>
  invoicedUnpaidGbp: number     // ribbon tile 2 (hub-derived; void-excluded) — must equal today's value (quickstart step 0 baseline)
  overdueGbp: number            // ribbon tile 5 (hub-derived; void-excluded)
  overdueCount: number          // ribbon tile 5 secondary count (ex due-horizon dependent 2)
  allZero: boolean              // empty-state (ex allHorizonZero, dependent 4)
}
```

Ribbon tiles 1/3/4 (Total order balance, Collected this month, Expected this month) stay on `fetchFinanceTotals` (order-side; NOT redefined, FR-011 limit).

## 5. Column-state record (localStorage)

```ts
// key: 'invoices_column_state'  (module id 'invoices'; per-browser = accepted per-user)
// Serialized shape currently defined by src/shared/tableViewPresets/**/columnState.ts — exact schema = OQ3, read at C3.
// Behavioural contract: visibility map + order; unknown/removed column ids tolerated on load
// (a returning browser may hold ids from before this feature — e.g. phantom 'actions' — and must not crash).
// New id introduced: 'daysOverdue' (hideable, default visible).
```
