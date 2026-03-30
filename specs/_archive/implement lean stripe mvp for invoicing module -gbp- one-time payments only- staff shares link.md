# Lean Stripe MVP for Invoicing Module (GBP, One-Time Payments, Staff Shares Link)

## Overview

**Goal:** Enable staff to share a Stripe Checkout payment link for invoices. Customers pay in GBP via Stripe (one-time payments only). A webhook marks invoices as paid when checkout completes. No Stripe.js embed; link-based checkout only.

**Context:**
- Invoicing module already has invoices, orders, and invoice totals (sum of linked order totals: base value + permit cost + additional options).
- Invoices use `invoices` table; orders link via `invoice_id`. Total = sum of `getOrderTotal(order)` per linked order.
- Stripe Checkout Session creation and webhook handling run in Supabase Edge Functions. Frontend only generates/copies the link and shows Stripe status.

**Scope:**
- **Backend:** `stripe-create-checkout-session` (create session, return URL), `stripe-webhook` (verify signature, handle `checkout.session.completed`).
- **Frontend:** “Copy payment link” in invoice details; Stripe status pill (unpaid / pending / paid); toast on copy.
- **DB:** New columns on `invoices`: `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at`. Views that compute invoice totals remain unchanged.
- **Currency:** GBP. **Mode:** `payment` (one-time). **Auth:** Checkout creation protected by `X-Admin-Token`; webhook is public, verified by Stripe signature.

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Current structure:**
- `id uuid` PK, `order_id uuid` (legacy, nullable), `invoice_number text`, `customer_name text`, `amount decimal(10,2)`, `status text` (`draft` | `pending` | `paid` | `overdue` | `cancelled`), `due_date`, `issue_date`, `payment_method`, `payment_date`, `notes`, `created_at`, `updated_at`.

**Observations:**
- No Stripe-related columns. `status` is general invoice status; we will add `stripe_status` for payment lifecycle (unpaid / pending / paid).
- `amount` stores the invoice total. Totals are derived from linked orders (sum of order totals) and kept in sync via `ExpandedInvoiceOrders` / `recalculateInvoiceAmount`.

### Orders and Invoice Total

**Relationship:** Orders reference invoices via `invoice_id`. Invoice total = sum of `getOrderTotal(order)` over orders with `invoice_id = invoice.id`. `getOrderTotal` = base value (`value` or `renovation_service_cost`) + `permit_cost` + `additional_options_total` (from `orders_with_options_total` view).

**Data access:** `useOrdersByInvoice(invoiceId)`; `recalculateInvoiceAmount` updates `invoices.amount` when orders change. Edge function must use equivalent logic (or same data source) to compute total for Checkout.

### Invoicing UI

**Relevant files:**
- `InvoiceDetailSidebar`: invoice details, status badge, amount, linked orders.
- `InvoicingPage`, `invoiceColumnDefinitions`: list view, amount, status.
- No payment-link or Stripe UI today.

### Edge Functions Pattern

**Existing:** `inbox-twilio-send`, `inbox-gmail-send` use `X-Admin-Token == INBOX_ADMIN_TOKEN`, JWT off, CORS for `POST`/`OPTIONS`. We reuse that pattern for `stripe-create-checkout-session`. Webhook is unauthenticated; security via Stripe signature verification.

---

## Recommended Schema Adjustments

### Database Migration

**New columns on `invoices` (all nullable, additive):**
- `stripe_checkout_session_id text` — Stripe Checkout Session ID.
- `stripe_payment_intent_id text` — Set when payment completes (from webhook).
- `stripe_status text` — `'unpaid'` | `'pending'` | `'paid'`. Default `'unpaid'`.
- `paid_at timestamptz` — When Stripe payment completed.

**Constraints:**
- No changes to existing columns or to `orders_with_options_total` / other views. Invoice total logic stays as-is.
- Add indexes only if needed for lookups (e.g. `stripe_checkout_session_id`) for webhook idempotency or debugging.

### Query / Data-Access Alignment

- Continue fetching invoices and orders as today. Add `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at` to invoice selects where relevant.
- Frontend shows Stripe status pill from `stripe_status`; invoice `status` can be updated to `'paid'` when `stripe_status = 'paid'` (webhook logic).

---

## Implementation Approach

### Phase 1: Database Migration

- Add migration adding the four columns to `invoices`.
- Ensure no view definitions that reference `invoices` need changes (e.g. reporting views). If they use `SELECT *` or explicit column lists, add new columns to explicit lists only where necessary; otherwise keep as-is.

### Phase 2: Edge Function — `stripe-create-checkout-session`

**File:** `supabase/functions/stripe-create-checkout-session/index.ts`

**Security:**
- CORS: `POST`, `OPTIONS`. Headers: `authorization`, `apikey`, `content-type`, `x-admin-token`.
- Validate `X-Admin-Token == INBOX_ADMIN_TOKEN`. JWT **OFF**.

**Request:** `POST` with JSON body `{ invoice_id: string }`.

**Logic:**
1. Validate `invoice_id`.
2. Load invoice from `invoices` and ensure it exists.
3. Load orders with `invoice_id = invoice.id` (use `orders_with_options_total` or equivalent so `additional_options_total` is available). Compute total = sum of order totals (same logic as `getOrderTotal`: base + `permit_cost` + `additional_options_total`). Use `invoices.amount` only if it is guaranteed to match; otherwise compute from orders.
4. Create Stripe Checkout Session (`mode: 'payment'`), GBP. Set:
   - `metadata.invoice_id` = `invoice_id`
   - `payment_intent_data.metadata.invoice_id` = `invoice_id`
5. URLs:
   - `success_url` = `${APP_ORIGIN}/invoicing/${invoice_id}?stripe=success&session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url` = `${APP_ORIGIN}/invoicing/${invoice_id}?stripe=cancel`
   - `APP_ORIGIN` from env (e.g. `APP_ORIGIN` or `VITE_APP_ORIGIN`), no trailing slash.
6. On success: update `invoices` set `stripe_checkout_session_id` = session id, `stripe_status` = `'pending'`. Return `{ url: session.url }`.
7. Use Supabase service-role client for DB. Require `STRIPE_SECRET_KEY` and `APP_ORIGIN` in env.

### Phase 3: Edge Function — `stripe-webhook`

**File:** `supabase/functions/stripe-webhook/index.ts`

**Security:**
- No admin token. Public HTTP endpoint.
- Verify Stripe signature with `STRIPE_WEBHOOK_SECRET` and raw request body. Use Stripe SDK `constructEvent` / `constructEventAsync` (Deno-compatible).

**Logic:**
1. Read raw body (required for signature verification). Reject if missing.
2. Verify `Stripe-Signature` header. Reject with 400 if invalid.
3. Handle `checkout.session.completed`:
   - Read `invoice_id` from `session.metadata.invoice_id` (or `payment_intent.metadata.invoice_id` as fallback).
   - Update `invoices` set `stripe_status = 'paid'`, `paid_at = now()`, `stripe_payment_intent_id` = payment intent id (if available), `stripe_checkout_session_id` = session id (if not already set), `status = 'paid'`, `updated_at = now()` where `id = invoice_id`.
   - Idempotency: safe to reapply (same outcome). Optionally skip if `stripe_status` already `'paid'`.
4. Return 200 for handled events. Return 400 for invalid signature; 500 only for unexpected failures.
5. Log safely (no tokens, no raw bodies).

### Phase 4: Frontend

**API helper (new):** e.g. `src/modules/invoicing/api/stripe.api.ts`
- `createCheckoutSession(invoiceId: string)`: `POST` to `.../stripe-create-checkout-session` with `X-Admin-Token`, body `{ invoice_id }`. Returns `{ url: string }`. Validates `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_INBOX_ADMIN_TOKEN`.

**Invoice details (“Copy payment link”):**
- Add button in `InvoiceDetailSidebar` (or wherever invoice details are shown). On click: call `createCheckoutSession(invoice.id)`, then copy `url` to clipboard and show success toast. On error, show error toast.
- Disable or hide when `stripe_status === 'paid'` (or when invoice `status === 'paid'` if that’s the only gate).

**Stripe status pill:**
- Add a pill/badge for `stripe_status`: `unpaid` | `pending` | `paid`. Place it next to existing invoice status in detail view and optionally in list view. Use distinct styling (e.g. muted for unpaid, yellow for pending, green for paid).

**Post-payment refresh:**
- On `/invoicing/:id?stripe=success&session_id=...`, invalidate invoice (and list) queries so the UI refetches and shows updated `stripe_status` / `status`. Optionally show a brief “Payment successful” message.

**No Stripe.js:** Do not add Stripe.js or embedded checkout. Only link-based redirect.

### Phase 5: Configuration and Secrets

**Supabase Edge Function secrets:**
- `INBOX_ADMIN_TOKEN` (existing).
- `STRIPE_SECRET_KEY` (Stripe secret, for Checkout API).
- `STRIPE_WEBHOOK_SECRET` (webhook signing secret).
- `APP_ORIGIN` (e.g. `https://app.example.com`), used for `success_url` / `cancel_url`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (existing).

**Frontend env:**
- `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_INBOX_ADMIN_TOKEN` (existing).

**Stripe Dashboard:**
- Webhook endpoint: `https://<project>.supabase.co/functions/v1/stripe-webhook`. Events: `checkout.session.completed`.
- Use **TEST** mode for end-to-end validation.

---

## Safety Considerations

- **Idempotency:** Webhook handler updates invoice only by `invoice_id`; re-delivery of `checkout.session.completed` yields same result. Optionally guard with `stripe_status = 'paid'` skip.
- **Totals:** Checkout amount must match invoice total (from orders). Use same logic as `getOrderTotal` and existing recalculation flow.
- **Secrets:** Never log or expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `INBOX_ADMIN_TOKEN`.
- **Views:** Confirm no view breaks when new columns are added. Prefer additive-only migration.

---

## What NOT to Do

- Do not add Stripe.js or embedded checkout.
- Do not change how invoice totals are computed in existing views or `orders_with_options_total`.
- Do not add subscriptions or recurring payments; one-time `payment` mode only.
- Do not support multi-currency in this MVP; GBP only.
- Do not alter RLS policies unless required for service-role access (edge functions use service role).

---

## Open Questions / Considerations

1. **APP_ORIGIN:** Confirm env var name and value (dev vs prod). Ensure no trailing slash and correct path (`/invoicing/:id`).
2. **Stripe status vs invoice status:** When `stripe_status` becomes `'paid'`, we set `invoices.status` to `'paid'`. Ensure no conflict with manually marking paid via other means (e.g. “Bank Transfer”).
3. **Webhook idempotency:** Stripe may retry. Prefer “skip if already paid” to avoid redundant updates.
4. **Views:** Double-check reporting or other views that `SELECT` from `invoices` before migration.

---

## Acceptance Criteria

- Staff can generate a Stripe Checkout payment link for an invoice (from invoice details). Link is copied to clipboard and a toast is shown.
- Paying via the link in Stripe TEST mode completes checkout. Webhook receives `checkout.session.completed`, verifies signature, and updates the invoice (`stripe_status = 'paid'`, `paid_at`, `stripe_payment_intent_id`, `stripe_checkout_session_id`, `status = 'paid'`).
- Invoice detail and list UIs show Stripe status pill (unpaid / pending / paid) and reflect paid state after payment (via query invalidation/refresh).
- Success/cancel redirects back to `/invoicing/:id` with appropriate query params; success path triggers refresh.
- End-to-end flow works in Stripe TEST mode.
- Build passes; no regressions to existing invoice total or order-invoice behavior.

---

**Specification Version:** 1.0  
**Created:** 2025-01-23  
**Status:** Ready for implementation
