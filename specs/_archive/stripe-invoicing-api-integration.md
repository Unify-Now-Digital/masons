# Stripe Invoicing API Integration (Replace Checkout Flow)

## Overview

Replace the current Stripe Checkout "payment" flow in the Invoicing module with a Stripe Invoicing API flow that creates **real Stripe Invoice objects** internally — without sending Stripe-hosted emails — and collects payment via Stripe Elements embedded in the app.

**Context:**
- The app currently uses Stripe Checkout Sessions to collect payment for Mason invoices. This creates a redirect-based flow and does not produce real Stripe Invoice objects.
- The Mason invoice (in Supabase) remains the **source of truth** for all invoice data, status, and line items. The Stripe invoice is a payment vehicle only.
- The core architecture is unchanged: **Invoices → Orders → Jobs → Installations**.

**Goal:**
- When staff clicks "Pay" on a Mason invoice, create a Stripe Invoice object via the Stripe Invoicing API.
- Finalize the Stripe invoice immediately.
- Collect payment via Stripe Elements (Payment Element or Card Element) inside the app — no redirect to Stripe Checkout.
- Update Mason invoice status via webhook on `invoice.paid` and `invoice.payment_failed`.
- Never send Stripe-hosted invoice emails to customers.

---

## Current State Analysis

### Invoicing Module Schema

**Table:** `invoices`

**Current Structure:**
- `id` (uuid, PK)
- `invoice_number` (text)
- `customer_id` / `person_id` (FK to people)
- `status` (text: draft, sent, paid, overdue, cancelled, etc.)
- `total_amount` (numeric)
- `due_date` (date)
- `stripe_checkout_session_id` (text, nullable) — stores current Checkout Session ID
- `stripe_payment_intent_id` (text, nullable) — stores PaymentIntent from Checkout
- `stripe_payment_url` (text, nullable) — stores Checkout URL
- Other fields: `notes`, `created_at`, `updated_at`, etc.
- RLS enabled

**Observations:**
- Existing Stripe columns (`stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_payment_url`) are tied to the Checkout flow and will need to be replaced or supplemented with Stripe Invoice-specific columns.
- `status` field already supports the lifecycle needed (draft → sent → paid / overdue / cancelled).

### Stripe Edge Functions

**Function:** `supabase/functions/stripe-create-checkout-session/index.ts`

**Current Behavior:**
- Creates a Stripe Checkout Session with line items derived from the Mason invoice.
- Returns a Checkout URL that the frontend redirects to.
- Stores `stripe_checkout_session_id` and `stripe_payment_url` on the invoice row.

**Function:** `supabase/functions/stripe-webhook/index.ts`

**Current Behavior:**
- Listens for `checkout.session.completed` events.
- On success, updates Mason invoice `status` to `'paid'` and stores `stripe_payment_intent_id`.

**Observations:**
- Both functions must be replaced or refactored to use Stripe Invoicing API instead of Checkout Sessions.
- Webhook must listen for `invoice.paid` and `invoice.payment_failed` instead of `checkout.session.completed`.

### Frontend Invoicing Components

**Key files:**
- `src/modules/invoicing/` — invoice list, create/edit drawers, detail views
- `src/modules/payments/` — payment-related components

**Current Behavior:**
- "Pay" action on an invoice calls the `stripe-create-checkout-session` Edge Function.
- Frontend receives a Checkout URL and opens it (redirect or new tab).
- After payment, webhook updates status; frontend polls or refetches.

**Observations:**
- Frontend must be updated to:
  1. Call a new Edge Function that creates + finalizes a Stripe Invoice.
  2. Use the returned `client_secret` (from the Stripe Invoice's PaymentIntent) to render Stripe Elements inline.
  3. Handle payment confirmation in-app without redirect.

### Relationship Analysis

**Current Relationship:**
- Mason invoice ↔ Stripe Checkout Session (1:1, via `stripe_checkout_session_id`).
- Mason invoice ↔ Stripe PaymentIntent (1:1, via `stripe_payment_intent_id`).

**Target Relationship:**
- Mason invoice ↔ Stripe Invoice (1:1, via new `stripe_invoice_id` column).
- Stripe Invoice contains a PaymentIntent; its ID can also be stored for reference.

**Gaps/Issues:**
- Need to add `stripe_invoice_id` column to the `invoices` table.
- Existing `stripe_checkout_session_id` and `stripe_payment_url` columns become unused (can be left nullable for backward compatibility; do not drop).

### Data Access Patterns

**How Invoices are Currently Accessed:**
- `useInvoices()` / `useInvoice(id)` hooks fetch from Supabase.
- Invoice list shows status, total, Stripe payment link.
- Detail view has "Pay" button that triggers Checkout flow.

**How Stripe Data is Queried:**
- Only via stored IDs on the invoice row; no direct Stripe API calls from the frontend.
- Webhook is the only server-to-server Stripe interaction after initial creation.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- Add column: `stripe_invoice_id text null` to `invoices` table.
- Add column: `stripe_invoice_status text null` to `invoices` table (mirrors Stripe invoice status for quick display).
- Optionally add index on `stripe_invoice_id` for webhook lookups.

**Non-Destructive Constraints:**
- Do **not** drop or rename existing `stripe_checkout_session_id`, `stripe_payment_intent_id`, or `stripe_payment_url` columns (backward compatibility; old invoices may reference them).
- All new columns are nullable (existing invoices unaffected).
- No table renames or structural changes to the Invoices → Orders → Jobs → Installations chain.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Webhook lookups: `SELECT * FROM invoices WHERE stripe_invoice_id = $1` (use the new column).
- Frontend: continue fetching via existing hooks; add `stripe_invoice_id` and `stripe_invoice_status` to the TypeScript types.

**Recommended Display Patterns:**
- Show `stripe_invoice_status` as a secondary indicator (e.g. "Stripe: paid") alongside the Mason invoice status.
- "Pay" button visible when `status` is `'sent'` or `'overdue'` and `stripe_invoice_id` is null (no Stripe invoice yet) or Stripe status is not `'paid'`.

---

## Implementation Approach

### Phase 1: Database Migration

- Create migration: add `stripe_invoice_id` and `stripe_invoice_status` to `invoices`.
- Update TypeScript types in `src/modules/invoicing/` and `src/modules/orders/types/` (or wherever the invoice type is defined).

### Phase 2: New Edge Function — `stripe-create-invoice`

- **Path:** `supabase/functions/stripe-create-invoice/index.ts`
- **Behavior:**
  1. Receive `mason_invoice_id` in request body.
  2. Fetch Mason invoice + line items from Supabase (service role).
  3. Find or create a Stripe Customer for the person (use email/phone; store `stripe_customer_id` on the person record if not already present).
  4. Create a Stripe Invoice via `stripe.invoices.create({...})`:
     - `customer`: Stripe Customer ID.
     - `collection_method`: `'charge_automatically'`.
     - `auto_advance`: `false` (we finalize manually to control timing).
     - `metadata`: `{ mason_invoice_id }`.
     - **Do not** set `send_invoice` or any email-related fields.
  5. Add Stripe InvoiceItems for each line item.
  6. Finalize the Stripe Invoice: `stripe.invoices.finalizeInvoice(stripeInvoiceId)`.
  7. Retrieve the PaymentIntent from the finalized invoice (`invoice.payment_intent`).
  8. Return `{ stripe_invoice_id, client_secret, payment_intent_id }` to the frontend.
  9. Update Mason invoice row: set `stripe_invoice_id`, `stripe_invoice_status`, and `stripe_payment_intent_id`.

### Phase 3: Update Webhook — `stripe-webhook`

- **Path:** `supabase/functions/stripe-webhook/index.ts`
- **Changes:**
  - Add handler for `invoice.paid`:
    - Look up Mason invoice by `stripe_invoice_id` (from event `data.object.id`).
    - Update `status` → `'paid'`, `stripe_invoice_status` → `'paid'`.
  - Add handler for `invoice.payment_failed`:
    - Look up Mason invoice by `stripe_invoice_id`.
    - Update `stripe_invoice_status` → `'payment_failed'` (do not change Mason `status` to avoid overwriting manual states).
  - Keep existing `checkout.session.completed` handler for backward compatibility with old invoices.

### Phase 4: Frontend — Inline Payment via Stripe Elements

- **Files:**
  - New component: `src/modules/payments/components/StripePaymentForm.tsx` (or similar).
  - Update: invoice detail/action component to call new Edge Function and render Stripe Elements.

- **Behavior:**
  1. Staff clicks "Pay" on an invoice.
  2. Frontend calls `stripe-create-invoice` Edge Function.
  3. Receives `client_secret`.
  4. Renders Stripe Payment Element (via `@stripe/react-stripe-js`) in a modal or inline panel.
  5. User completes payment inside the app.
  6. On `paymentIntent.succeeded` (client-side confirmation), show success state.
  7. Webhook updates Mason invoice status asynchronously.

- **Dependencies:**
  - `@stripe/stripe-js` and `@stripe/react-stripe-js` (check if already installed; if not, add).
  - Stripe publishable key in environment (`.env`).

### Safety Considerations

- **No data loss:** Only additive columns; no drops or renames.
- **Backward compatibility:** Old invoices with Checkout Session IDs continue to work; webhook still handles `checkout.session.completed`.
- **Rollback:** If needed, revert migration (drop new columns) and restore old Edge Function; no structural damage.
- **Testing:**
  - Use Stripe test mode for all development.
  - Test webhook with Stripe CLI (`stripe listen --forward-to ...`).
  - Verify Mason invoice status updates correctly on `invoice.paid` and `invoice.payment_failed`.

---

## What NOT to Do

- Do **not** send Stripe-hosted invoice emails (no `send_invoice`, no `auto_advance: true` without controlling email settings).
- Do **not** change the DB relational structure: Invoices → Orders → Jobs → Installations remains unchanged.
- Do **not** add subscription or recurring billing support.
- Do **not** drop existing Stripe columns (`stripe_checkout_session_id`, `stripe_payment_url`).
- Do **not** change invoice creation, editing, or line-item logic in the Mason app.
- Do **not** remove the existing `checkout.session.completed` webhook handler (old invoices may still rely on it).

---

## Open Questions / Considerations

- **Stripe Customer management:**
  - Do we already store `stripe_customer_id` on the person/customer record? If not, a small migration to add it to the `people`/`customers` table is needed.
  - How to handle invoices for people without an email (Stripe requires email for customer creation in some configurations)?
- **Partial payments:**
  - Stripe Invoicing supports partial payments; decide whether to expose this or enforce full payment only.
- **Refunds:**
  - Out of scope for this spec, but the Stripe Invoice model supports refunds natively if needed later.
- **Multiple payments per invoice:**
  - If a payment fails and the user retries, should we create a new Stripe Invoice or retry the existing one? Recommend retrying the existing Stripe Invoice (Stripe supports this).
- **Stripe Elements version:**
  - Prefer the newer Payment Element over the legacy Card Element for broader payment method support.
