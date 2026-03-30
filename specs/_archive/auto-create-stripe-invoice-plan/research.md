# Research: Auto-create Stripe invoice

**Feature:** [auto-create-stripe-invoice.md](../auto-create-stripe-invoice.md)  
**Plan:** [auto-create-stripe-invoice-implementation-plan.md](../auto-create-stripe-invoice-implementation-plan.md)

---

## 1. Trigger points (current and desired)

### 1.1 CreateInvoiceDrawer flow

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

- **Flow:** User submits form → `createInvoiceAsync(invoiceData)` with `amount: finalAmount` → `Promise.all(orderPromises)` creates orders with `invoice_id: createdInvoice.id`.
- **Current auto-create (already present):** After `await Promise.all(orderPromises)`, if `finalAmount > 0`, calls `createStripeInvoice(createdInvoice.id)`, then invalidates `invoicesKeys.all` and `invoicesKeys.detail(createdInvoice.id)`. On failure: toast "Stripe link not created", no block.
- **Trigger point:** Immediately after invoice + orders creation when `finalAmount > 0`. No need to refetch invoice; we have `createdInvoice` and know amount from local `finalAmount`.

### 1.2 ExpandedInvoiceOrders / Add Order to invoice flow

**File:** `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx`

- **Flow:** `useOrdersByInvoice(invoiceId)` returns orders. `useEffect` runs when `orders` or `invoiceId` change. Computes `currentTotal` from orders via `getOrderTotal`. If total changed (`lastOrdersTotalRef`), calls `recalculateInvoiceAmount(invoiceId, orders, updateInvoiceAsync)` (updates `invoice.amount` in DB), then if `currentTotal > 0` calls `createStripeInvoice(invoiceId)` and invalidates list + detail.
- **Current auto-create (already present):** After `recalculateInvoiceAmount`, when `currentTotal > 0`, calls `createStripeInvoice(invoiceId)`. No guard on `stripe_invoice_id` (relies on backend idempotency). No refetch of invoice before calling.
- **Trigger point:** After invoice amount is recalculated and updated (order attach/remove/edit). Single path: recalc → then ensure Stripe.

### 1.3 Shared recalc/update path

- **recalculateInvoiceAmount:** Defined in `ExpandedInvoiceOrders.tsx`; takes `invoiceId`, `orders`, `updateInvoice`. Sums `getOrderTotal(order)` and calls `updateInvoice({ id: invoiceId, updates: { amount: newAmount } })`. No other shared module currently; only used from ExpandedInvoiceOrders.
- **Recommendation:** Introduce shared `ensureStripeInvoice(invoiceId, options?)` (or `ensureStripeInvoice(invoice)` with optional fetch) used by both CreateInvoiceDrawer and ExpandedInvoiceOrders. Helper checks: has `stripe_invoice_id`? amount > 0? (and optionally: has orders? — can be implied by amount > 0 if we always recalc before). Single in-flight guard keyed by `invoiceId` to avoid duplicate concurrent calls.

### 1.4 Revise invoice flow

**File:** `src/modules/invoicing/components/ReviseInvoiceModal.tsx`

- After revise, calls `createStripeInvoice(data.new_invoice_id)` for the new invoice. New invoice is created with orders and amount server-side; so one explicit call after creation is correct. Can be migrated to `ensureStripeInvoice(newInvoiceId)` for consistency.

---

## 2. Files and modules to touch

| Area | File(s) | Change |
|------|---------|--------|
| Helper | `src/modules/invoicing/api/stripe.api.ts` or new `src/modules/invoicing/utils/ensureStripeInvoice.ts` | Add `ensureStripeInvoice(invoiceId)` (or `(invoice)` with guard logic and in-flight map). |
| Create flow | `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | Replace direct `createStripeInvoice` with `ensureStripeInvoice(createdInvoice.id)` (or keep as-is and have helper used for guard only). Prefer calling shared helper so guard is centralized. |
| Order-attach flow | `src/modules/invoicing/components/ExpandedInvoiceOrders.tsx` | Replace direct `createStripeInvoice(invoiceId)` with `ensureStripeInvoice(invoiceId)`; helper will optionally fetch invoice to check `stripe_invoice_id` and `amount` if we want to avoid redundant calls. |
| Revise | `src/modules/invoicing/components/ReviseInvoiceModal.tsx` | Optionally use `ensureStripeInvoice(new_invoice_id)` after revise. |
| Table column | `src/modules/invoicing/components/invoiceColumnDefinitions.tsx` | Keep Full + Partial when Stripe data present; keep "Link" as fallback when no Stripe invoice. Optional: loading state while ensureStripeInvoice in progress (if we expose a "creating" state). |
| Invalidation / selectedInvoice | Already in place in CreateInvoiceDrawer and ExpandedInvoiceOrders; sidebar merge in InvoicingPage via `onStripeInvoiceCreated`. | Ensure ensureStripeInvoice returns or triggers same invalidation + optional callback for selectedInvoice merge. |

---

## 3. Backend idempotency

- **stripe-create-invoice (Edge Function):** If `invoice.stripe_invoice_id` is already set, retrieves existing Stripe invoice and returns it; does not create a second one. So duplicate app-side calls are safe but wasteful; in-flight guard + optional "has stripe_invoice_id" check reduce redundant calls.

---

## 4. Open points for implementation

1. **Where to put the helper:** New file `ensureStripeInvoice.ts` under `src/modules/invoicing/utils/` or add to `stripe.api.ts`. If it needs `queryClient` for invalidation, it may need to be a hook or accept queryClient as argument.
2. **Guard:** Module-level `Set<string>` or `Ref<Set<string>>` keyed by `invoiceId`; add before `createStripeInvoice`, remove in finally. If already in set, return early (or await existing promise if we want to coalesce).
3. **Fetch before call:** Optional. If we pass only `invoiceId`, we could fetch invoice to check `stripe_invoice_id` and `amount` and skip call; avoids redundant Edge Function calls when invoice already has Stripe (e.g. after edit that doesn’t change amount). Downside: extra round-trip. Alternative: always call and rely on backend idempotency; use only in-flight guard to avoid double calls from same flow.
4. **Loading state in table:** Optional. If we add a "creating" state (e.g. per-invoiceId in context or query), Stripe column could show spinner for that row until ensureStripeInvoice completes.
