# Contract: ensureStripeInvoice

**Feature:** Auto-create Stripe invoice  
**Plan:** [auto-create-stripe-invoice-implementation-plan.md](../../auto-create-stripe-invoice-implementation-plan.md)

---

## Purpose

Central helper to ensure a Stripe invoice exists for a given Mason invoice when it is billable, and to avoid duplicate or redundant calls.

---

## Signature (proposed)

```ts
// Option A: by id (helper fetches invoice when needed for guards)
function ensureStripeInvoice(
  invoiceId: string,
  options?: {
    queryClient?: QueryClient;
    onSuccess?: (data: CreateStripeInvoiceResponse) => void;
  }
): Promise<{ created: boolean; data?: CreateStripeInvoiceResponse } | void>;

// Option B: caller passes invoice (avoids fetch when invoice already in hand)
function ensureStripeInvoice(
  invoice: { id: string; amount?: number | null; stripe_invoice_id?: string | null },
  options?: {
    queryClient?: QueryClient;
    onSuccess?: (data: CreateStripeInvoiceResponse) => void;
  }
): Promise<{ created: boolean; data?: CreateStripeInvoiceResponse } | void>;
```

---

## Behavior

1. **Guard – already has Stripe invoice:** If `invoice.stripe_invoice_id` exists (and non-empty string), return without calling `createStripeInvoice`. Return `{ created: false }`.
2. **Guard – not billable:** If `invoice.amount <= 0` (or missing), return without calling. Return `{ created: false }`.
3. **Guard – in-flight:** If a call for this `invoice.id` is already in progress (module-level Set or similar), return without starting a second call (or optionally await the existing promise and return its result).
4. **Call:** Otherwise call `createStripeInvoice(invoice.id)`. On success: invalidate `invoicesKeys.all` and `invoicesKeys.detail(invoice.id)` (if `queryClient` provided); call `onSuccess(data)` if provided. Return `{ created: true, data }`. Clear in-flight guard in `finally`.
5. **Failure:** On throw: log/toast non-blocking; clear in-flight guard; rethrow or return so caller can keep UI usable. Do not block invoice creation or order attach.

---

## Usage

- **CreateInvoiceDrawer:** After creating invoice + orders, if `finalAmount > 0`, call `ensureStripeInvoice(createdInvoice, { queryClient, onSuccess })`. `createdInvoice` has `id`, `amount` = finalAmount; `stripe_invoice_id` is null.
- **ExpandedInvoiceOrders:** After `recalculateInvoiceAmount`, if `currentTotal > 0`, call `ensureStripeInvoice(invoiceId, { queryClient })` (helper will need to fetch invoice to check `stripe_invoice_id` and `amount`), or pass a minimal object `{ id: invoiceId, amount: currentTotal, stripe_invoice_id }` if we have it from refetch.
- **ReviseInvoiceModal:** After creating new invoice, call `ensureStripeInvoice(newInvoiceId, { queryClient })`.

---

## createStripeInvoice (existing)

- **API:** `createStripeInvoice(invoiceId: string): Promise<CreateStripeInvoiceResponse>`.
- **Response:** `stripe_invoice_id`, `hosted_invoice_url`, `stripe_invoice_status`, `amount_paid`, `amount_remaining`, etc.
- **Backend:** Idempotent; if invoice already has `stripe_invoice_id`, returns existing Stripe invoice without creating a new one.
