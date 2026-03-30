# Invoicing: Invoice List Breakdown Columns (Main / Options / Permit)

## Overview

Add **three new read-only financial columns** to the Invoicing module’s invoice list/table so users can see the breakdown of each invoice total **without opening** the invoice detail sidebar/page.

**Context:**
- The invoice list is rendered by `src/modules/invoicing/pages/InvoicingPage.tsx` using column definitions from `src/modules/invoicing/components/invoiceColumnDefinitions.tsx`.
- The list data currently comes from `fetchInvoices()` in `src/modules/invoicing/api/invoicing.api.ts`, which selects a fixed set of fields from the `public.invoices` table.
- The application already has canonical “order financial breakdown” logic in `src/modules/orders/utils/orderCalculations.ts`:
  - Base/main product total: `getOrderBaseValue(order)`
  - Permit cost: `getOrderPermitCost(order)`
  - Additional options total: `getOrderAdditionalOptionsTotal(order)`

**Goal:**
- Add the following columns to the invoice list UI:
  - **Main product total**
  - **Additional Options total**
  - **Permit total cost**
- Values must match existing business logic and must not change the invoice grand total logic.
- Keep all existing list behavior (filters, column presets, row actions, expansion, deep links) unchanged.

---

## Current State Analysis

### Invoices schema

**Table:** `public.invoices`

**Current Structure (relevant fields):**
- `id` (uuid)
- `order_id` (uuid, nullable): the invoice → order link used by the UI (`Invoice.order_id`)
- `amount` (numeric in DB, exposed to UI as `Invoice.amount: number`)
- Stripe totals: `amount_paid`, `amount_remaining` (pence) used for table display (`formatPence` in invoicing utils)

**Observations:**
- The invoices list query is a **fixed select string** (`INVOICES_LIST_SELECT`) in `src/modules/invoicing/api/invoicing.api.ts`.
- The current invoice list rows do **not** include any “breakdown totals” fields.

### Orders breakdown schema

**Table/View:** `public.orders` + `public.orders_with_options_total`

**Current Structure (relevant to breakdown):**
- Base/main product value is derived from:
  - `orders.value` for New Memorial orders
  - `orders.renovation_service_cost` for Renovation orders
- Permit cost: `orders.permit_cost`
- Additional options total: `orders_with_options_total.additional_options_total`

**Observations:**
- This breakdown logic is already used in the UI (`src/modules/orders/utils/orderCalculations.ts`) and should be reused to avoid inconsistent totals.

### Relationship Analysis

**Current Relationship:**
- `public.invoices.order_id` → `public.orders.id`
- `public.orders_with_options_total` is a view over orders + additional options aggregation.

**Gaps/Issues:**
- Invoice list rows currently don’t include any order-derived breakdown fields; computing them in the frontend would require additional queries (N+1) or duplicating logic.

### Data Access Patterns

**How invoices are currently accessed:**
- `fetchInvoices()` selects `INVOICES_LIST_SELECT` from `public.invoices` and sorts by `created_at desc`.
- UI transforms are done via `transformInvoicesForUI()` (`src/modules/invoicing/utils/invoiceTransform.ts`).

**How order breakdown is currently accessed:**
- For orders views, breakdown totals are derived using helpers in `src/modules/orders/utils/orderCalculations.ts`.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- Add a **non-destructive view** that exposes the invoice list fields plus breakdown totals derived from the linked order:
  - `main_product_total` (numeric)
  - `additional_options_total` (numeric)
  - `permit_total_cost` (numeric)

**Proposed view (example name):**
- `public.invoices_with_breakdown`

**Computation rules (must match existing UI logic):**
- `main_product_total`:
  - if `orders.order_type = 'Renovation'` → `orders.renovation_service_cost`
  - else → `orders.value`
- `permit_total_cost` → `orders.permit_cost`
- `additional_options_total` → `orders_with_options_total.additional_options_total`

**Indexes to add (if needed):**
- Only if query plans show regressions. Start with just the view; `invoices.order_id` and `orders.id` are already indexed by primary key, and `orders_with_options_total` is grouped by `orders.id`.

**Non-Destructive Constraints:**
- No table renames
- No column deletions
- Keep backward compatibility: existing invoice list can keep reading from `public.invoices` until the UI migrates to the view.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Update the invoice list query to select from `public.invoices_with_breakdown` instead of `public.invoices`.
- Keep all existing invoice fields identical, and add the three new numeric columns.

**Recommended Display Patterns:**
- In the invoice table, add three new columns:
  - `Main product total`
  - `Additional Options total`
  - `Permit total cost`
- Format using existing money formatting (GBP), consistent with existing columns:
  - Prefer using `formatPence` if values are stored as pence.
  - Otherwise, use the same formatting style used for `invoice.amount` (GBP with 2 dp).
  - Pick one approach and apply consistently to all three columns.

---

## Implementation Approach

### Phase 1: Backend data shape (preferred, minimal UI disruption)
- Create migration to add `public.invoices_with_breakdown` view:
  - Select the current `INVOICES_LIST_SELECT` fields from `public.invoices`
  - Left join to `public.orders` on `invoices.order_id`
  - Left join to `public.orders_with_options_total` on `orders.id`
  - Derive and expose:
    - `main_product_total`
    - `permit_total_cost`
    - `additional_options_total`
- Ensure the view is readable under existing RLS constraints (invoices RLS must continue to apply; if invoices already use RLS by `user_id`, ensure the view includes the `user_id` and relies on existing policies).

### Phase 2: Frontend invoice list columns
- Update `fetchInvoices()` to select from `invoices_with_breakdown` and include the 3 new fields.
- Update `src/modules/invoicing/types/invoicing.types.ts` `Invoice` type to include:
  - `main_product_total?: number | null`
  - `additional_options_total?: number | null`
  - `permit_total_cost?: number | null`
- Update `transformInvoiceForUI()` / `UIInvoice` to include formatted display strings for the new columns.
- Add 3 new column definitions in `src/modules/invoicing/components/invoiceColumnDefinitions.tsx` using the existing formatting conventions.
- Add them to the column preset defaults if this project expects new columns to appear by default (respecting how column state is persisted).

### Safety Considerations
- Validate invoices without `order_id`:
  - Show `—` for all three breakdown columns.
- Validate orders with missing values:
  - Treat nulls as 0 only if that matches existing order calculation rules; otherwise show `—`.
- Ensure existing actions remain unchanged:
  - Row click / sidebar open
  - Stripe link / partial collection flow
  - Expansion rows

---

## What NOT to Do

- Do not change invoice grand total logic or payment calculations.
- Do not add new “mock” breakdown values in the frontend.
- Do not add per-row extra queries from the invoice list (avoid N+1).
- Do not change existing filters/pagination/row actions.

---

## Open Questions / Considerations

- Currency unit for new fields:
  - Are order values stored as pounds (e.g. `1234.56`) or pence? Current order calculations treat them as pounds; invoice `amount_paid/remaining` are pence. The view + UI must settle on one consistent unit for these new columns.
- Renovation vs New Memorial:
  - Confirm `orders.order_type` values and that `'Renovation'` is the canonical string (as used in `isRenovationOrder`).
- Multi-order invoices:
  - If an invoice can link to multiple orders (beyond `invoices.order_id`), the breakdown must be clarified. Current schema suggests one `order_id` per invoice; if not true, the view must aggregate across linked orders.

