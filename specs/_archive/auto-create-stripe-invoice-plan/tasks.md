# Tasks: Auto-create Stripe invoice

Reference: [auto-create-stripe-invoice.md](../auto-create-stripe-invoice.md), [implementation plan](../auto-create-stripe-invoice-implementation-plan.md).

---

## Phase 1 – Shared helper ensureStripeInvoice

### Task 1.1: Add ensureStripeInvoice helper [X]

**File:** `src/modules/invoicing/utils/ensureStripeInvoice.ts` (new) or add to `src/modules/invoicing/api/stripe.api.ts`

- Implement `ensureStripeInvoice(invoiceId: string, options?: { queryClient?: QueryClient; onSuccess?: (data: CreateStripeInvoiceResponse) => void })` (or overload that accepts `invoice: { id, amount?, stripe_invoice_id? }` when caller has invoice in hand).
- Guards: if `stripe_invoice_id` already set (when invoice is provided or after optional fetch), return without calling. If `amount <= 0`, return without calling.
- In-flight guard: module-level `Set<string>` keyed by `invoiceId`; add before `createStripeInvoice`, remove in `finally`; if id already in set, return (or optionally coalesce with existing promise).
- On success: if `queryClient` provided, invalidate `invoicesKeys.all` and `invoicesKeys.detail(invoiceId)`; call `onSuccess(data)` if provided.
- On failure: log/warn; toast non-blocking message; clear in-flight; rethrow or return so callers don’t block.

**Contract:** [contracts/ensure-stripe-invoice.md](contracts/ensure-stripe-invoice.md)

---

### Task 1.2: Optional fetch for guard (ExpandedInvoiceOrders path)

- If using invoice-id-only API: before calling `createStripeInvoice`, optionally `fetchInvoice(invoiceId)` to read `stripe_invoice_id` and `amount` and skip when already set or amount <= 0. Reduces redundant Edge Function calls. Alternative: rely on backend idempotency and only use in-flight guard; document choice in code.

---

## Phase 2 – Wire trigger into flows

### Task 2.1: CreateInvoiceDrawer – use ensureStripeInvoice [X]

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

- After `await Promise.all(orderPromises)`, when `finalAmount > 0`, call `ensureStripeInvoice(createdInvoice.id, { queryClient, onSuccess })` (or pass `createdInvoice` with `amount: finalAmount`, `stripe_invoice_id: null`) instead of raw `createStripeInvoice`.
- Remove direct `createStripeInvoice` and local invalidation from this file; ensureStripeInvoice handles invalidation and optional onSuccess (e.g. for selectedInvoice merge in parent if needed).
- Keep existing toast on failure if ensureStripeInvoice surfaces one, or keep local catch for "Stripe link not created".

---

### Task 2.2: ExpandedInvoiceOrders – use ensureStripeInvoice

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

- In the effect that runs after `recalculateInvoiceAmount`, when `currentTotal > 0`, call `ensureStripeInvoice(invoiceId, { queryClient })` instead of `createStripeInvoice(invoiceId)`.
- If helper accepts only invoiceId, it may fetch invoice to apply guards; otherwise pass a minimal object `{ id: invoiceId, amount: currentTotal }` if we don’t have `stripe_invoice_id` without a fetch. Document whether we refetch invoice here or rely on backend idempotency.

---

### Task 2.3: ReviseInvoiceModal – use ensureStripeInvoice (optional) [X]

**File:** `src/modules/invoicing/components/ReviseInvoiceModal.tsx`

- After creating new invoice and calling `createStripeInvoice(data.new_invoice_id)`, replace with `ensureStripeInvoice(data.new_invoice_id, { queryClient })` for consistency. Ensures one code path for “ensure Stripe invoice exists.”

---

## Phase 3 – Refresh and selectedInvoice

### Task 3.1: Invalidation and selectedInvoice merge [X]

- ensureStripeInvoice already invalidates list + detail when `queryClient` is passed. Confirm InvoicingPage’s sidebar receives updated invoice (e.g. via refetch from invalidated detail query, or via existing `onStripeInvoiceCreated` when creation is triggered from sidebar). If ensureStripeInvoice is used from table/create flow only, selectedInvoice is updated when user opens that invoice (detail refetch). If we need immediate merge when selected invoice is the one we just ensured, add optional `onSuccess` from ensureStripeInvoice so parent can merge Stripe fields into selectedInvoice state.

---

## Phase 4 – Table/UI

### Task 4.1: Stripe column – Full + Partial, fallback Link [X]

**File:** `src/modules/invoicing/components/invoiceColumnDefinitions.tsx`

- Keep current behavior: show Full (when `hostedInvoiceUrl`) and Partial (when `stripeInvoiceId` or `hostedInvoiceUrl`). When no Stripe invoice, show "Link" for manual retry. No change required if already correct; remove any leftover debug UI if present.

---

### Task 4.2: Optional loading state (Creating…)

- Optional: when ensureStripeInvoice is in progress for a given invoiceId, show a small loading state in the Stripe payment link cell for that row (e.g. "Creating…" or spinner). Requires a way to expose "in progress" (e.g. context, or a per-invoiceId state in a store). Defer if not in scope.

---

## Phase 5 – Backfill and existing invoices

### Task 5.1: No backfill

- Do not add a bulk job or automatic backfill for existing invoices without Stripe invoice. They continue to use "Link" for manual creation. Document in quickstart.md (already done).

---

## Phase 6 – QA

### Task 6.1: Manual QA

- Run through [quickstart.md](quickstart.md) QA checklist: create invoice with orders; add first order to invoice; no duplicate Stripe invoices; revised invoice; failure handling; existing invoices without Stripe.

---

## Completion checklist

- [X] ensureStripeInvoice implemented with guards and in-flight dedup.
- [X] CreateInvoiceDrawer and ExpandedInvoiceOrders use ensureStripeInvoice.
- [X] Optional: ReviseInvoiceModal uses ensureStripeInvoice.
- [X] Invalidation (and optional selectedInvoice merge) confirmed.
- [X] Table shows Full + Partial when Stripe data present; Link when not.
- [ ] QA checklist passed.
