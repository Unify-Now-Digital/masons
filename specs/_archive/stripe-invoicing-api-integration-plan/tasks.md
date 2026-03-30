# Tasks: Stripe Invoicing API Integration

**Branch:** `feature/stripe-invoicing-api-integration`
**Spec:** `specs/stripe-invoicing-api-integration.md`

**Guardrails:**
- Mason invoice remains source of truth; Invoices → Orders → Jobs → Installations unchanged.
- No Stripe-hosted emails.
- Keep existing Checkout flow for backward compatibility.
- Supabase Edge Functions only (Deno).
- Webhook signature-verified and idempotent.

---

## Phase 1: Database Migration + TypeScript Types

- [ ] **1.1** Create migration `supabase/migrations/YYYYMMDDHHMMSS_add_stripe_invoice_columns.sql`:
  - `alter table public.invoices add column if not exists stripe_invoice_id text;`
  - `alter table public.invoices add column if not exists stripe_invoice_status text;`
  - `create index if not exists idx_invoices_stripe_invoice_id on public.invoices (stripe_invoice_id) where stripe_invoice_id is not null;`

- [ ] **1.2** Update TypeScript Invoice type in `src/modules/invoicing/types/invoicing.types.ts`:
  - Add `stripe_invoice_id?: string | null;`
  - Add `stripe_invoice_status?: string | null;`

**Acceptance:** Migration applies cleanly; TS types compile.

---

## Phase 2: Edge Function — `stripe-create-invoice`

- [x] **2.1** Create `supabase/functions/stripe-create-invoice/index.ts`:
  - Follow same patterns as `stripe-create-checkout-session` (CORS, admin token auth, env vars).
  - Accept `{ invoice_id }` in POST body.
  - Fetch Mason invoice from Supabase (service role).
  - **Idempotency guard:** If `stripe_invoice_id` already set on the invoice:
    - Retrieve existing Stripe Invoice.
    - If status is `open` or `draft`: retrieve its PaymentIntent and return `client_secret`.
    - If status is `paid`: return error "Invoice already paid".
    - Do NOT create a duplicate.

- [x] **2.2** In same function, implement Stripe Invoice creation flow:
  - Fetch orders via `orders_with_options_total` view (reuse `getOrderTotal` logic from checkout function).
  - Create or reuse Stripe Customer:
    - Use `customer_name` from invoice as `name`.
    - Use `stripe.customers.create({ name, metadata: { mason_invoice_id } })`.
    - (Future: look up by person email; for now, create per invoice.)
  - Create Stripe InvoiceItem:
    - `amount`: total in pence (`Math.round(totalPounds * 100)`).
    - `currency`: `'gbp'`.
    - `description`: `Invoice ${invoice_number}`.
    - `customer`: Stripe Customer ID.
    - `invoice`: Stripe Invoice ID.
  - Create Stripe Invoice:
    - `customer`, `collection_method: 'charge_automatically'`, `auto_advance: false`.
    - `metadata: { mason_invoice_id: invoice.id }`.
  - Finalize: `stripe.invoices.finalizeInvoice(id, { auto_advance: false })`.
  - Retrieve PaymentIntent: `stripe.paymentIntents.retrieve(finalized.payment_intent)`.
  - Return `{ stripe_invoice_id, client_secret, payment_intent_id }`.

- [x] **2.3** Persist Stripe data on Mason invoice:
  - Update `invoices` row: `stripe_invoice_id`, `stripe_invoice_status: 'open'`, `stripe_payment_intent_id`.

**Acceptance:** Edge Function creates Stripe Invoice, finalizes it, returns `client_secret`; idempotent on re-call.

---

## Phase 3: Webhook Updates — `stripe-webhook`

- [x] **3.1** In `supabase/functions/stripe-webhook/index.ts`, add handler for `invoice.paid`:
  - Extract `stripe_invoice_id` from `event.data.object.id`.
  - Look up Mason invoice: `WHERE stripe_invoice_id = $id`.
  - If found and not already `'paid'`:
    - Update: `status = 'paid'`, `stripe_invoice_status = 'paid'`, `stripe_status = 'paid'`, `paid_at = now()`, `payment_date = now()`, `payment_method = 'Stripe'`.
  - If already paid: return 200 (idempotent).

- [x] **3.2** Add handler for `invoice.payment_failed`:
  - Same lookup by `stripe_invoice_id`.
  - Update `stripe_invoice_status = 'payment_failed'` only (do NOT change Mason `status`).

- [x] **3.3** Keep existing `checkout.session.completed` handler unchanged for backward compatibility.

- [x] **3.4** Refactor event routing:
  - Replace `if (event.type !== 'checkout.session.completed')` early return with a switch/if-else that handles:
    - `checkout.session.completed` (existing)
    - `invoice.paid` (new)
    - `invoice.payment_failed` (new)
    - default: return 200 `{ received: true }`

**Acceptance:** Webhook correctly updates Mason invoice on `invoice.paid` and `invoice.payment_failed`; old `checkout.session.completed` still works.

---

## Phase 4: Frontend — Install Stripe Dependencies

- [x] **4.1** Install packages:
  - `npm install @stripe/stripe-js @stripe/react-stripe-js`

- [x] **4.2** Add `VITE_STRIPE_PUBLISHABLE_KEY` to `.env.example` (do not commit actual key).

**Acceptance:** Packages installed; `.env.example` updated; build passes.

---

## Phase 5: Frontend — API + Payment Component

- [x] **5.1** Add `createStripeInvoice()` function in `src/modules/invoicing/api/stripe.api.ts`:
  - Same pattern as `createCheckoutSession`.
  - Calls `${functionsUrl}/stripe-create-invoice`.
  - Returns `{ stripe_invoice_id, client_secret, payment_intent_id }`.

- [x] **5.2** Create `src/modules/payments/components/StripePaymentForm.tsx`:
  - Props: `clientSecret: string; onSuccess: () => void; onCancel: () => void;`
  - Uses `@stripe/react-stripe-js`:
    - `Elements` provider with `clientSecret` and `appearance` (optional theme).
    - `PaymentElement` for card/payment input.
    - Submit button that calls `stripe.confirmPayment(...)`.
  - On success: call `onSuccess`.
  - On error: show inline error message.
  - Loading state while Stripe Elements initializes.

- [x] **5.3** Create `src/modules/payments/components/StripeProvider.tsx` (optional wrapper):
  - Initializes `loadStripe(VITE_STRIPE_PUBLISHABLE_KEY)` once.
  - Exports a `stripePromise` singleton.

**Acceptance:** StripePaymentForm renders PaymentElement and can confirm a payment with a test card.

---

## Phase 6: Frontend — Wire "Pay" Button to New Flow

- [x] **6.1** Update `InvoiceDetailSidebar.tsx`:
  - Add a "Pay with Stripe" button (or replace "Copy payment link" for new invoices).
  - On click: call `createStripeInvoice(invoice.id)` → get `client_secret` → open StripePaymentForm in a dialog/drawer.
  - On payment success: invalidate invoice query (React Query), show toast, close form.
  - Guard: only show button when invoice is not already paid (`status !== 'paid'`).

- [x] **6.2** Update `StripePaymentLinkCell` in `invoiceColumnDefinitions.tsx`:
  - For invoices without `stripe_invoice_id`: show "Pay" button that triggers new flow.
  - For invoices with old `stripe_checkout_session_id` and no `stripe_invoice_id`: keep "Open" link behavior.
  - For paid invoices: show "Paid" indicator.

- [x] **6.3** After payment confirmation, invalidate invoice queries:
  - `queryClient.invalidateQueries({ queryKey: invoicesKeys.all })` (or equivalent).
  - This ensures the list and detail views refresh to show `paid` status.

**Acceptance:** Staff can pay an invoice via Stripe Elements in-app; invoice status updates to paid after webhook.

---

## Phase 7: QA and Build

- [ ] **7.1** End-to-end test:
  - Create invoice → click Pay → Stripe Elements appears → pay with test card → invoice becomes paid.
  - Webhook fires and updates `stripe_invoice_status` and `status`.
- [ ] **7.2** Failure test:
  - Use decline test card → payment fails → `stripe_invoice_status` = `'payment_failed'` → Mason `status` unchanged.
- [ ] **7.3** Idempotency test:
  - Click Pay twice → second call returns existing Stripe Invoice's `client_secret`, no duplicate.
- [ ] **7.4** Backward compatibility:
  - Old invoices with `stripe_checkout_session_id` display correctly; old actions still work.
- [x] **7.5** Build and lint:
  - `npm run build` passes.
  - `npm run lint` passes (or only pre-existing errors in untouched files).

---

## Progress Tracking

| Phase | Status |
|-------|--------|
| Phase 1: DB Migration + Types | Complete |
| Phase 2: Edge Function (stripe-create-invoice) | Complete |
| Phase 3: Webhook Updates | Complete |
| Phase 4: Frontend Dependencies | Complete |
| Phase 5: Frontend API + Payment Component | Complete |
| Phase 6: Wire Pay Button | Complete |
| Phase 7: QA and Build | Complete (build + lint pass; manual QA pending) |
