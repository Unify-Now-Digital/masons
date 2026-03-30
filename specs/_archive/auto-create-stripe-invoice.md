# Auto-create Stripe Invoice for Invoicing Table

## Overview

Automatically create the Stripe invoice when an invoice becomes payable so that Full and Partial payment actions are available immediately in the Invoicing table, without requiring the user to click a manual "Link" button.

**Context:**
- Mason App currently requires clicking a manual "Link" button in the Invoicing table to create the Stripe invoice.
- Until that happens, table rows have no `stripe_invoice_id` and no `hosted_invoice_url`, so Full and Partial actions cannot appear.
- Desired UX: as soon as an invoice is ready (after creation or after first order is attached and total > 0), a Stripe invoice should already exist.

**Goal:**
- Automatically create the Stripe invoice when an invoice becomes payable so Stripe fields are present immediately.
- Table shows Full (opens hosted invoice URL) and Partial (opens sidebar and focuses Collect payment) without any extra click.
- Manual "Link" button should no longer be necessary for the normal flow.

---

## Current State Analysis

### Invoices and Stripe Fields

**Table:** `public.invoices`

**Relevant structure:**
- `id`, `invoice_number`, `customer_name`, `amount`, `status`, `due_date`, etc.
- Stripe Invoicing API fields: `stripe_invoice_id`, `stripe_invoice_status`, `hosted_invoice_url`, `amount_paid`, `amount_remaining`, `locked_at`
- Invoice is "ready to bill" when it has at least one order and `amount > 0`.

**Observations:**
- Stripe invoice is created today only when the user clicks "Link" in the table (or equivalent in sidebar), which calls `createStripeInvoice(invoice_id)`.
- Edge Function `stripe-create-invoice` is idempotent: if `stripe_invoice_id` is already set, it returns the existing Stripe invoice; otherwise it creates one and updates the invoice row.

### Orders and Invoice Amount

**Table:** `public.orders` (and view `orders_with_options_total`)

- Orders are linked to an invoice via `invoice_id`.
- Invoice amount is derived from the sum of order totals (base + permit + additional options).
- Recalculation of invoice amount happens in the app when orders change (e.g. in `ExpandedInvoiceOrders` via `recalculateInvoiceAmount`).

### Data Access Patterns

**Invoices list:** `fetchInvoices()` in `invoicing.api.ts` selects explicit columns including `stripe_invoice_id`, `hosted_invoice_url`, etc. Table uses `useInvoicesList()` and `transformInvoicesForUI()` to display rows.

**Stripe payment link column:** Renders Full when `hostedInvoiceUrl` exists, Partial when `stripeInvoiceId` or `hostedInvoiceUrl` exists. Renders "Link" when no Stripe invoice exists.

**Invoice creation flow:** `CreateInvoiceDrawer` creates the invoice then creates orders with `invoice_id`; amount is set at creation from inline order totals.

**Order-attach flow:** User can add orders to an existing invoice (e.g. from `ExpandedInvoiceOrders` + `CreateOrderDrawer`); `recalculateInvoiceAmount` updates the invoice `amount`.

---

## Business Rules (Requirements)

1. **Auto-create Stripe invoice only when:**
   - Invoice exists.
   - Invoice total > 0.
   - Invoice has at least one order / billable content.
   - `stripe_invoice_id` is null (or missing).

2. **Do NOT create duplicate Stripe invoices** if one already exists (backend is already idempotent; app must not call unnecessarily in a way that could cause race conditions).

3. **Revised invoices:** If an invoice is revised and a new local invoice record is created, the new invoice should get its own Stripe invoice automatically; the old one remains unchanged/historical.

4. **If auto-create fails:**
   - Invoice still exists locally.
   - UI should show a clear error/toast/log.
   - User may retry manually if needed (temporary fallback "Create link" allowed during rollout).

---

## Recommended Implementation Approach

### Trigger Points

- **Trigger 1 – Invoice creation:** Immediately after a new invoice and its orders are created in `CreateInvoiceDrawer`, if `finalAmount > 0`, call `createStripeInvoice(createdInvoice.id)`. Then invalidate invoices list and invoice detail queries so the table and sidebar show updated Stripe fields.
- **Trigger 2 – First order attached / amount becomes > 0:** When the invoice amount is recalculated after orders change (e.g. in `ExpandedInvoiceOrders` after `recalculateInvoiceAmount`), if the new total > 0 and the invoice does not yet have a Stripe invoice, call `createStripeInvoice(invoiceId)`. Then invalidate list and detail. Guard with `!stripe_invoice_id` (or rely on backend idempotency after a single fetch of the invoice if needed).

### Stored Fields (no schema change)

The existing Edge Function already persists on the invoice row:
- `stripe_invoice_id`
- `hosted_invoice_url`
- `stripe_invoice_status`
- `amount_paid`
- `amount_remaining`
- (and related fields like `locked_at` when applicable)

No new columns required.

### Query Refresh

After successful `createStripeInvoice(invoiceId)`:
- Invalidate `invoicesKeys.all` and `invoicesKeys.detail(invoiceId)` (and optionally `invoicesKeys.payments(invoiceId)` if relevant) so the table row and sidebar show Full + Partial immediately.

### Avoiding Duplicate Calls

- **On create:** Call only once after `createInvoice` + orders, when `finalAmount > 0`.
- **On order attach/recalc:** Call only when the amount has actually changed (e.g. when `recalculateInvoiceAmount` is run) and optionally only when `currentTotal > 0`. Backend idempotency ensures no duplicate Stripe invoice if `stripe_invoice_id` is already set.

### UX Changes

1. **Invoicing table:** When a Stripe invoice exists, show Full + Partial only. When it does not (e.g. 0 amount or auto-create failed), optionally keep a temporary fallback "Create link" / "Link" action during rollout; goal is to remove it for the normal flow.
2. **Sidebar:** No change to behavior; Stripe invoice data should appear immediately after list/detail refresh.

---

## What NOT to Do

- Do not create a second Stripe invoice for the same Mason invoice (rely on backend idempotency and avoid redundant calls).
- Do not block invoice creation or order attachment on Stripe creation; on Stripe failure, surface error but leave invoice and orders saved.
- Do not change the schema of `invoices` or `orders` for this feature unless a concrete need is identified in /plan.
- Do not remove the ability for the user to retry creating the Stripe link if auto-create fails (fallback allowed during rollout).

---

## Open Questions / Considerations for /plan

1. **Best trigger point:** Confirm whether to trigger on invoice creation only, on first order attached only, or both (with guard `!stripe_invoice_id`). Recommendation: both, with guards.
2. **Avoiding duplicate calls:** If invoice is edited multiple times (e.g. order list changes repeatedly), ensure we do not call `createStripeInvoice` on every recalc when a Stripe invoice already exists (e.g. fetch invoice once to check `stripe_invoice_id` before calling, or rely on backend idempotency and accept one extra call per invoice).
3. **Existing invoices without Stripe invoice:** Whether to provide a one-time backfill job or a "Create link" button for existing invoices that have amount > 0 but no `stripe_invoice_id` (migration/rollout concern).
4. **Error handling:** Exact toast copy and whether to show a persistent "Create link" in the cell when auto-create has failed for that row.

---

## Acceptance Criteria

- New invoices that are ready to bill (amount > 0, orders attached) automatically receive a Stripe invoice without clicking Link.
- In the Invoicing table, rows show Full + Partial immediately for newly ready invoices after query refresh.
- No duplicate Stripe invoices are created for the same Mason invoice.
- Existing revised-invoice flow still works; new revised invoice gets its own Stripe invoice.
- Query refresh keeps table and sidebar in sync with Stripe fields.
