# Implementation Plan: Lean Stripe MVP for Invoicing Module

## Feature Overview

Enable staff to share a Stripe Checkout payment link for invoices. Customers pay in GBP via Stripe (one-time payments only). A webhook marks invoices as paid when checkout completes. No Stripe.js embed; link-based checkout only.

**Branch:** `feature/lean-stripe-mvp-invoicing`  
**Spec File:** `specs/implement lean stripe mvp for invoicing module -gbp- one-time payments only- staff shares link.md`

---

## Technical Context

### Current State
- **Invoices:** `public.invoices`; orders link via `invoice_id`. Total = sum of `getOrderTotal(order)` (base + permit_cost + additional_options_total).
- **Invoicing UI:** `InvoiceDetailSidebar`, `InvoicingPage`, `invoiceColumnDefinitions`. No payment-link or Stripe UI.
- **Edge functions:** `inbox-twilio-send`, `inbox-gmail-send` use `X-Admin-Token == INBOX_ADMIN_TOKEN`, JWT off, CORS.

### Constraints
- **Additive-only** migrations; no changes to `orders_with_options_total` or invoice total logic.
- **No Stripe.js** or embedded checkout; link-based redirect only.
- **GBP, one-time** (`payment` mode). No subscriptions or multi-currency.

---

## Phase 1 — Database Migration

**Goal:** Add Stripe-related columns to `invoices` (additive, idempotent).

### Task 1.1: Migration file
**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_stripe_columns_to_invoices.sql`

**SQL:**
```sql
-- Add Stripe columns to invoices (additive-only)
alter table public.invoices
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_status text default 'unpaid',
  add column if not exists paid_at timestamptz;

comment on column public.invoices.stripe_checkout_session_id is 'Stripe Checkout Session ID from session creation';
comment on column public.invoices.stripe_payment_intent_id is 'Stripe Payment Intent ID when payment completes';
comment on column public.invoices.stripe_status is 'Stripe lifecycle: unpaid | pending | paid';
comment on column public.invoices.paid_at is 'When Stripe payment completed (webhook)';
```

**Acceptance:**
- Migration runs without error; existing rows unchanged.
- Views that reference `invoices` (e.g. reporting) remain valid; add new columns to explicit selects only if required.

---

## Phase 2 — Edge Function: `stripe-create-checkout-session`

**Goal:** Create Stripe Checkout Session, return `url`, persist `stripe_checkout_session_id` + `stripe_status='pending'`.

### Task 2.1: Function shell, CORS, admin token
**File:** `supabase/functions/stripe-create-checkout-session/index.ts`

- `Deno.serve`, CORS headers (`POST`, `OPTIONS`), handle OPTIONS → 200.
- Validate `X-Admin-Token == INBOX_ADMIN_TOKEN`; 401 if missing/mismatch. JWT **OFF**.

### Task 2.2: Request validation and DB load
- Parse `{ invoice_id: string }`; reject invalid/missing with 400.
- Load invoice by `id`; 404 if not found.
- Load orders with `invoice_id = invoice.id` (use `orders_with_options_total` or equivalent). Compute total = sum of order totals (same as `getOrderTotal`). Use `invoices.amount` only if guaranteed to match; otherwise derive from orders.

### Task 2.3: Stripe Checkout Session
- Create Session `mode: 'payment'`, currency GBP.
- `metadata.invoice_id` and `payment_intent_data.metadata.invoice_id` = `invoice_id`.
- `success_url` = `${APP_ORIGIN}/invoicing/${invoice_id}?stripe=success&session_id={CHECKOUT_SESSION_ID}`.
- `cancel_url` = `${APP_ORIGIN}/invoicing/${invoice_id}?stripe=cancel`.
- `APP_ORIGIN` from env (no trailing slash).

### Task 2.4: DB update and response
- Update `invoices` set `stripe_checkout_session_id`, `stripe_status = 'pending'` for the invoice.
- Return `{ url: session.url }`. Use Supabase service-role client. Require `STRIPE_SECRET_KEY`, `APP_ORIGIN`.

**Acceptance:**
- POST with valid token + `invoice_id` returns `url`; invoice updated.
- Invalid token → 401; invalid/missing `invoice_id` → 400.

---

## Phase 3 — Edge Function: `stripe-webhook`

**Goal:** Verify Stripe signature, handle `checkout.session.completed`, mark invoice paid.

### Task 3.1: Webhook endpoint
**File:** `supabase/functions/stripe-webhook/index.ts`

- No admin token; public endpoint.
- Read raw body; verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`. 400 if invalid.
- Use Stripe SDK `constructEvent` / `constructEventAsync` (Deno-compatible).

### Task 3.2: Handle `checkout.session.completed`
- `invoice_id` from `session.metadata.invoice_id` or `payment_intent.metadata.invoice_id`.
- Update `invoices`: `stripe_status = 'paid'`, `paid_at = now()`, `stripe_payment_intent_id`, `stripe_checkout_session_id` (if not set), `status = 'paid'`, `updated_at`.
- Idempotent: skip or no-op if already `stripe_status = 'paid'`.

### Task 3.3: Response and logging
- Return 200 for handled events; 400 for bad signature; 500 for unexpected errors.
- Log safely (no secrets, no raw bodies).

**Acceptance:**
- Valid webhook → invoice updated to paid.
- Invalid signature → 400. No token logging.

---

## Phase 4 — Frontend

**Goal:** “Copy payment link” button, Stripe status pill, post-payment refresh.

### Task 4.1: API helper
**File:** `src/modules/invoicing/api/stripe.api.ts` (new)

- `createCheckoutSession(invoiceId: string)`: POST to `.../stripe-create-checkout-session` with `X-Admin-Token`, body `{ invoice_id }`. Returns `{ url: string }`. Validate `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_INBOX_ADMIN_TOKEN`; throw if missing.

### Task 4.2: Invoice types
- Add `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at` to `Invoice` (or relevant) type. Ensure `fetchInvoice` / `fetchInvoices` return these (e.g. `select('*')` or explicit list).

### Task 4.3: “Copy payment link” button
**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

- Add button; on click call `createCheckoutSession(invoice.id)`, copy `url` to clipboard, show success toast. On error, show error toast. Disable or hide when `stripe_status === 'paid'` (or `status === 'paid'`).

### Task 4.4: Stripe status pill
- Pill for `stripe_status`: unpaid / pending / paid. Place next to invoice status in detail view; optionally in list. Distinct styling (muted / yellow / green).

### Task 4.5: Post-payment refresh
- On `/invoicing/:id?stripe=success&session_id=...`, invalidate invoice (and list) queries so UI refetches. Optionally show “Payment successful” message.

**Acceptance:**
- Copy link → clipboard + toast. Status pill reflects unpaid/pending/paid. After payment, refresh shows paid.

---

## Phase 5 — Configuration and Secrets

### Supabase Edge Function secrets
- `INBOX_ADMIN_TOKEN` (existing).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_ORIGIN`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (existing).

### Frontend env
- `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_INBOX_ADMIN_TOKEN` (existing).

### Stripe Dashboard
- Webhook: `https://<project>.supabase.co/functions/v1/stripe-webhook`. Events: `checkout.session.completed`. Use **TEST** mode.

### `.env.example`
- Ensure `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_INBOX_ADMIN_TOKEN` documented. Restart Vite after env changes.

---

## Acceptance Checklist

- [ ] Staff can generate Stripe Checkout payment link; link copied, toast shown.
- [ ] Paying via link (TEST mode) completes checkout; webhook updates invoice to paid.
- [ ] Invoice detail and list show Stripe status pill; paid state after payment (refresh).
- [ ] Success/cancel redirect to `/invoicing/:id` with correct query params; success triggers refresh.
- [ ] Build passes; no regressions to invoice totals or order-invoice behavior.

---

## File-Level Change Summary

| Phase | Action | Path |
|-------|--------|------|
| 1 | Create | `supabase/migrations/..._add_stripe_columns_to_invoices.sql` |
| 2 | Create | `supabase/functions/stripe-create-checkout-session/index.ts` |
| 3 | Create | `supabase/functions/stripe-webhook/index.ts` |
| 4 | Create | `src/modules/invoicing/api/stripe.api.ts` |
| 4 | Update | `src/modules/invoicing/types/invoicing.types.ts` |
| 4 | Update | `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` |
| 4 | Update | `src/modules/invoicing/pages/InvoicingPage.tsx` and/or list components (status pill) |
| 4 | Update | Invoicing route/page to handle `?stripe=success` and invalidate queries |
| 5 | Update | `.env.example` (if not already present) |

---

**Plan Version:** 1.0  
**Status:** Ready for implementation
