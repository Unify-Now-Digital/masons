# Generate Partial Payment Checkout Link for Invoices

## Overview

Implement a staff-facing “Generate partial payment link (Stripe Checkout)” for Mason invoices that allows multiple partial payments against a single Stripe Invoice, while keeping customers on Stripe-hosted pages only (no in-app card entry). Each payment must be recorded by Stripe as a payment on the existing invoice so that Stripe’s own status/amounts (unpaid → partially_paid → paid) remain the source of truth.

**Context:**
- Mason App already uses Stripe Invoicing with `collection_method='send_invoice'` and `hosted_invoice_url` for full-amount payment.
- Partial payment support exists at the invoice level (amount_paid / amount_remaining + `invoice_payments` table, webhooks) but there is no way to generate staff-controlled partial payment links.
- Stripe Checkout (mode=`payment`) gives a clean hosted payment page; we must avoid in-app Payment Elements and keep all card entry on Stripe.

**Goal:**
- Add a new Edge Function and frontend UX that lets staff:
  - Generate a Stripe-hosted Checkout link for a specified partial amount (default deposit suggestion, editable).
  - Ensure that payment is attached to the existing Stripe Invoice so Stripe shows partial payments on that invoice.
  - Rely on existing webhooks to update `amount_paid`, `amount_remaining`, and `invoice_payments`.
- Preserve existing constraints: customers never enter card details inside Mason App; editing locked after first payment; “Revise invoice” remains the only way to change line items once payments exist.

---

## Current State Analysis

### Invoices & Payments Schema

**Table:** `public.invoices`

**Current Structure (relevant fields):**
- `id` (uuid, PK)
- `invoice_number` (text, unique)
- `customer_name` (text)
- `amount` (numeric) — total
- `status` (text: draft/pending/paid/overdue/cancelled)
- `stripe_invoice_id` (text, nullable)
- `stripe_invoice_status` (text, nullable)
- `hosted_invoice_url` (text, nullable)
- `amount_paid` (bigint, default 0, smallest currency unit)
- `amount_remaining` (bigint, nullable, smallest currency unit)
- `locked_at` (timestamptz, nullable)
- `user_id` (uuid, nullable, FK auth.users)
- RLS: enabled; invoice owner via `user_id` (policy tightening in progress elsewhere).

**Table:** `public.invoice_payments`

**Current Structure:**
- `id` (uuid, PK)
- `user_id` (uuid, nullable, FK auth.users)
- `invoice_id` (uuid, FK invoices.id)
- `stripe_invoice_id` (text, not null)
- `stripe_payment_intent_id` (text, nullable)
- `stripe_charge_id` (text, nullable)
- `amount` (bigint, not null, smallest currency unit)
- `status` (text, not null; e.g. paid/failed/pending)
- `created_at` (timestamptz, default now())
- Indexes on `invoice_id`, `stripe_invoice_id`; unique on `(stripe_invoice_id, stripe_charge_id)` and on `stripe_payment_intent_id` (where not null) for idempotency.
- RLS: authenticated users see/insert/update own rows (or legacy null user_id) via `user_id`.

**Observations:**
- Schema already supports multiple payments per invoice and tracks Stripe IDs for idempotency.
- Invoice amounts/status are synced from Stripe via existing webhook (`invoice.updated`, `invoice.payment_succeeded`, `invoice.paid`, `payment_intent.succeeded`).
- No dedicated table or columns for “payment links”; not required for MVP.

### Stripe Invoicing & Checkout Flow (Current)

**Edge Functions:**
- `stripe-create-invoice`:
  - Creates Stripe Invoice with `collection_method='send_invoice'`, `days_until_due`, `auto_advance=false`.
  - Finalizes invoice, retrieves `hosted_invoice_url`, updates `stripe_invoice_id`, `stripe_invoice_status`, `amount_paid`, `amount_remaining`, `locked_at`, `hosted_invoice_url` on Mason invoice.
  - No `sendInvoice` here; email sending is optional and separated.
- `stripe-send-invoice`:
  - Validates existence of `stripe_invoice_id` and customer email.
  - Calls `stripe.invoices.sendInvoice` for email-based flows.
- `stripe-webhook`:
  - Handles Checkout legacy (`checkout.session.completed`), Stripe Invoicing (`invoice.updated`, `invoice.payment_succeeded`, `invoice.paid`, `invoice.payment_failed`), and `payment_intent.succeeded`.
  - Syncs invoice status/amounts; inserts `invoice_payments` rows with idempotency.

**Observations:**
- Hosted invoice URL currently directs customer to full-balance payment page — no per-payment amount input for staff.
- There is no dedicated Edge Function for “generate partial Checkout URL attached to invoice”.
- Webhook already has the primitives to record payments; we need to ensure partial payments via Checkout drive the right events and metadata.

### Relationship Analysis

**Current Relationship:**
- `invoices` ←→ `invoice_payments` (1-to-many by `invoice_id`).
- `invoices` ←→ Stripe Invoice (1-to-1 via `stripe_invoice_id`).
- `invoice_payments` ←→ Stripe PaymentIntent / Charge via `stripe_payment_intent_id` / `stripe_charge_id`.

**Gaps/Issues:**
- No direct API to create a partial payment Checkout Session that is explicitly associated with the existing Stripe Invoice.
- Staff cannot generate multiple partial payment links; only full hosted links or generic Checkout links (legacy) are available.

### Data Access Patterns

**Invoices:**
- Fetched via Supabase client in `invoicing.api.ts` and `useInvoices` hooks.
- UI surfaces `stripe_invoice_status`, `amount_paid`, `amount_remaining`, `hosted_invoice_url`.

**Payments:**
- `invoice_payments` used via `useInvoicePayments(invoiceId)` (hook introduced for partial payments work).
- Payment history shown in `InvoiceDetailSidebar`.

**Stripe:**
- Edge Functions call Stripe using secret key; webhooks drive local state.
- APP URL for redirect/return from Stripe is already used in similar flows (`/dashboard/invoicing?...`).

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- None required for minimal feature; use existing `invoice_payments` for records.

**Optional (future):**
- `invoices.last_partial_checkout_amount` (bigint) to show last-generated partial link in UI.
- `invoice_payment_links` table to store historical links / expiry / status for auditability.

**Non-Destructive Constraints:**
- No breaking changes; additive-only if optional enhancements are later added.
- No table renames or column removals; maintain compatibility with existing reporting.

### Query/Data-Access Alignment

**Edge Functions:**
- New `stripe-create-invoice-payment-link` will:
  - Read invoice by `invoice_id` (including `stripe_invoice_id`, `user_id`).
  - Validate ownership (via `user_id` if needed).
  - Retrieve Stripe Invoice (to read `amount_remaining`, currency, customer).
  - Create PaymentIntent and associate it with the invoice (via metadata and/or explicit invoice attachment).
  - Create Checkout Session for that PaymentIntent and return URL.

**Frontend:**
- `InvoiceDetailSidebar` will:
  - Fetch `amount_remaining` for invoice; render a “Collect payment” partial payment card.
  - Default amount input to suggested deposit; non-empty, <= remaining.
  - Call new Edge Function via `stripe.api.ts`, capture `checkout_url`.
  - Provide “Copy” and “Open” actions for that URL.

---

## Implementation Approach

### Phase 1: Edge Function — stripe-create-invoice-payment-link

- **Inputs & validation:**
  - Define POST payload: `{ invoice_id: string; amount: number }` (amount in pence).
  - Validate `invoice_id` as non-empty uuid string; `amount > 0`.
  - Authenticate using the same admin/service pattern used by other Stripe functions (x-admin-token + Bearer).
- **Invoice + Stripe data:**
  - Load Mason invoice by `invoice_id`. Require:
    - `stripe_invoice_id` present.
    - (Optional) invoice `user_id` for future RLS-aware restrictions.
  - Retrieve Stripe Invoice by `stripe_invoice_id`, expanded with `customer`.
  - Compute/validate:
    - `currency` (e.g. `'gbp'`).
    - `amount_remaining` (smallest unit); require `amount <= amount_remaining`.
- **PaymentIntent + Invoice association:**
  - Create PaymentIntent with:
    - `amount`, `currency`, `customer`.
    - Metadata: `{ mason_invoice_id, stripe_invoice_id, payment_kind: 'partial' }`.
  - Associate PaymentIntent with Stripe Invoice:
    - Preferred: direct “attach payment” call if supported in current Stripe SDK API (e.g. invoices.attachPayment / invoices.applyCreditNote style).
    - Fallback: store enough metadata so webhooks can map `payment_intent` back to `stripe_invoice_id`, then rely on invoice-level events.
- **Checkout Session:**
  - Create Checkout Session:
    - `mode: 'payment'`.
    - `customer: customer_id`.
    - Either:
      - Link to existing PaymentIntent if API supports it directly, or
      - Use `payment_intent_data` to create the PI and attach metadata (webhook-driven mapping).
    - `success_url`: `APP_URL + '/dashboard/invoicing?invoice=' + invoice_id + '&pay=success'`.
    - `cancel_url`: `APP_URL + '/dashboard/invoicing?invoice=' + invoice_id + '&pay=cancel'`.
    - `metadata`: `{ mason_invoice_id, stripe_invoice_id }`.
  - Return JSON: `{ checkout_url, stripe_payment_intent_id, amount, currency }`.
- **Safety:**
  - Ensure idempotency key or metadata if multiple identical requests arrive (out of scope for v1, but keep code structured to add later).
  - Avoid changing local DB in this function; leave payment recording to webhooks.

### Phase 2: Webhook alignment (reuse existing logic)

- Confirm existing webhook handlers cover:
  - `payment_intent.succeeded`:
    - Map `payment_intent` → `stripe_invoice_id` via metadata or `invoice` field.
    - Insert `invoice_payments` row (idempotent) with `amount` and `status='paid'`.
  - `invoice.updated` / `invoice.payment_succeeded` / `invoice.paid`:
    - Sync `amount_paid`, `amount_remaining`, `stripe_invoice_status`, `hosted_invoice_url`, `locked_at` from Stripe.
- If missing:
  - Add logic to:
    - Extract `mason_invoice_id` or `stripe_invoice_id` from `payment_intent.metadata`.
    - Look up Mason invoice and insert payment row with correct `user_id`, `stripe_invoice_id`, and `amount`.
- No schema changes; all adjustments are in webhook code.

### Phase 3: Frontend — InvoiceDetailSidebar “Collect payment” section

- **UI card:**
  - New “Collect payment” section under Stripe status / Paid / Remaining.
  - Show:
    - `amount_remaining` (formatted).
    - Suggested deposit value and explanation.
    - Numeric input for “Amount to collect now” (defaults to suggested, must be > 0 and <= remaining).
  - Buttons:
    - “Generate Checkout link”:
      - Calls new API to `stripe-create-invoice-payment-link`.
      - On success, displays `checkout_url` with:
        - “Copy link”.
        - “Open in new tab”.
- **Validation:**
  - Client-side checks:
    - `amount > 0`.
    - `amount <= amount_remaining`.
  - Show clear error messages if validation fails.
- **Interaction with existing flows:**
  - Keep “Open full invoice (pays full amount)” button (hosted_invoice_url) but relabel for clarity.
  - Keep existing “Request payment” (email send) behavior, now clearly distinct from partial link generation.
- **Post-payment UX:**
  - Rely on existing webhook-driven refresh (invalidate invoice + payments queries).
  - Ensure `amount_paid`, `amount_remaining`, and payment history update after success.

### Phase 4: Safety Considerations

- All payments remain on Stripe-hosted pages (Checkout + Invoice pages); no Payment Element in-app.
- Avoid double-charging:
  - Validate `amount <= amount_remaining` at Edge Function level using fresh Stripe Invoice data.
  - Idempotent webhook handling via existing unique constraints.
- Testing:
  - Use Stripe test mode to simulate:
    - Single partial payment then full payment.
    - Multiple partial payments until fully paid.
    - Over-amount attempts (must be rejected).
  - Verify Mason and Stripe states remain consistent.

---

## What NOT to Do

- Do not introduce in-app card forms or Payment Element.
- Do not bypass Stripe Invoicing; all payments must still accrue to the existing Stripe invoice.
- Do not relax existing locking rule: invoices remain locked after any payment, and editing must continue to go through “Revise invoice”.
- Do not introduce new tables unless absolutely necessary; leverage `invoice_payments` and existing invoices columns.

---

## Open Questions / Considerations

- **Stripe API details:** confirm the most robust pattern for associating a Checkout Session’s PaymentIntent with an existing invoice:
  - Direct `attachPayment` / invoice-level association vs. webhook-only mapping using PI metadata.
- **Customer email & send_invoice:** ensure Stripe Customer has a valid email (already enforced elsewhere for send_invoice) but note that Checkout links themselves do not require email in all flows.
- **Link lifetime:** should staff be able to regenerate links freely, or do we need a “link invalidation” model later? (Out of scope for v1.)
- **Multi-currency:** initial scope is GBP; verify behavior if multi-currency support is added later.

