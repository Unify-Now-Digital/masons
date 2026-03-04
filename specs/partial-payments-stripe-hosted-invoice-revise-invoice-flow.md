# Partial Payments on Stripe-Hosted Invoice + Revise Invoice Flow

## Overview

Enable multiple partial payments against a single Stripe invoice (customer pays via Stripe-hosted invoice link only). The invoice remains open until fully paid and shows "Partially paid" where applicable. After any payment, line-item editing is locked; changes require a "Revise invoice" flow (void old Stripe invoice + create new one, with carryover note and linking).

**Context:**
- Mason App: React + TypeScript + Vite, Tailwind/shadcn, React Query, Supabase (Postgres + RLS, Edge Functions), Stripe.
- Invoicing module already creates multiline Stripe invoices; customer must pay via Stripe-hosted invoice link only.
- Default deposit suggestion (UI only): 100% Permit + 50% (Main product + Additional options); user can override the amount to request.
- Constraint: Once any payment is made, use Option 1 — lock editing; changes require "Revise invoice" (void old + create new).

**Goal:**
- Partial payments enabled on Stripe invoice; hosted page supports partial amounts; invoice stays open until fully paid.
- Invoicing UI shows amount paid, amount remaining, status (draft / open / partially_paid / paid / void / uncollectible), and payment history.
- "Request payment" (send/update hosted link) with optional suggested payment amount (Stripe or local staff guidance).
- If invoice has any payment (amount_paid > 0), disable editing and show "Invoice locked — payments started"; offer "Revise invoice" action.
- "Revise invoice": void old Stripe invoice (if open), create new Stripe invoice with updated line items, record carryover paid amount and old invoice reference; app UI links old and revised invoices.

---

## Current State Analysis

### Invoices Schema

**Table:** `public.invoices`

**Current Structure:**
- `id` (uuid, PK), `order_id` (FK to orders), `invoice_number`, `customer_name`, `amount`, `status` (draft/pending/paid/overdue/cancelled), `due_date`, `issue_date`, `payment_method`, `payment_date`, `notes`, `created_at`, `updated_at`
- Stripe (Checkout legacy): `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status` (unpaid|pending|paid), `paid_at`
- Stripe Invoicing API: `stripe_invoice_id`, `stripe_invoice_status` (indexed for webhook lookups)

**Observations:**
- `stripe_invoice_id` and `stripe_invoice_status` exist; no `amount_paid`, `amount_remaining`, `hosted_invoice_url`, or `revised_from_invoice_id`.
- No `invoice_payments` table; payment history and per-payment records are not stored.
- `stripe-create-invoice` uses `collection_method: 'charge_automatically'` and single Payment Intent; must switch to `send_invoice` and enable partial payments.
- RLS: currently "Allow all access to invoices" (to be refined per project conventions).

### Invoice Payments (New Entity)

**Table:** `public.invoice_payments` (to be created)

**Planned Structure:**
- `id` (uuid, PK), `user_id` (for RLS), `app_invoice_id` (FK to invoices), `stripe_invoice_id`, `stripe_payment_intent_id` or `stripe_charge_id`, `amount`, `status`, `created_at`
- Ensures user-isolated payment history and webhook reconciliation.

### Relationship Analysis

**Current Relationship:**
- Invoices link to orders via `order_id`; `orders` can reference `invoice_id`. Stripe invoice is 1:1 with app invoice via `stripe_invoice_id`.

**Gaps/Issues:**
- No table for multiple payments per invoice; no `amount_paid` / `amount_remaining` on invoices; no `hosted_invoice_url` or `revised_from_invoice_id`; no explicit "locked" state (derived or stored).
- Webhook handler only handles `invoice.paid` and `invoice.payment_failed`; does not handle `invoice.updated` or partial payment events; does not write payment records or update amount_paid/amount_remaining.

### Data Access Patterns

**Invoices:**
- Queried from Invoicing UI; filtered by status; updated when creating/sending Stripe invoice and when webhooks fire.

**Stripe Edge Functions:**
- `stripe-create-invoice`: reads invoice + orders, creates/finalizes Stripe invoice, updates `stripe_invoice_id`, `stripe_invoice_status`, `stripe_payment_intent_id`.
- `stripe-webhook`: looks up invoice by `stripe_invoice_id`; updates status/paid_at; no payment history or amount_paid/amount_remaining today.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **invoices table:** Add columns (additive only):
  - `amount_paid` (numeric, default 0), `amount_remaining` (numeric), `hosted_invoice_url` (text), `revised_from_invoice_id` (uuid FK to invoices, nullable).
  - Optionally `is_locked` (boolean, default false) or derive from `amount_paid > 0`.
- **invoice_payments table (new):**
  - `id` uuid PK, `user_id` uuid NOT NULL (for RLS), `app_invoice_id` uuid NOT NULL references invoices(id), `stripe_invoice_id` text, `stripe_payment_intent_id` or `stripe_charge_id` text, `amount` numeric, `status` text, `created_at` timestamptz.
  - Indexes: `app_invoice_id`, `stripe_invoice_id` (for webhook lookups).
- RLS on `invoice_payments`: user-isolated by `user_id` (or via invoice ownership); RLS on new columns of `invoices` follows existing invoice policies.

**Non-Destructive Constraints:**
- Only additive changes; no table renames or column deletions; backward compatibility maintained.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Fetch invoice with `amount_paid`, `amount_remaining`, `stripe_status`/`stripe_invoice_status`, `hosted_invoice_url`, `revised_from_invoice_id`, and derived `is_locked` (or stored).
- Fetch payment history: select from `invoice_payments` where `app_invoice_id` = ? order by `created_at`.

**Display:**
- Invoicing list/detail: show Paid / Remaining, status badge, hosted link button, "Request payment", deposit suggestion (100% permit + 50% rest, overridable); when locked, show banner and "Revise invoice" CTA.
- Revise flow: show old invoice reference and carryover note; link to new invoice.

---

## Implementation Approach

### Phase 1: Data model and Stripe create/send invoice
- Add migration: `invoices` columns (`amount_paid`, `amount_remaining`, `hosted_invoice_url`, `revised_from_invoice_id`, optionally `is_locked`); create `invoice_payments` with RLS and indexes.
- Update `stripe-create-invoice`: set `collection_method: 'send_invoice'`; enable partial payments (Stripe setting/param as required); return `hosted_invoice_url` and `stripe_invoice_id`; persist `hosted_invoice_url`.
- Add or update `stripe-send-invoice`: send invoice via Stripe (or update and re-send) so staff can "Request payment".

### Phase 2: Webhook handler and payment records
- Update Stripe webhook: handle `invoice.updated`, `invoice.payment_succeeded` (and/or `invoice.paid`, partial payments); on payment events insert into `invoice_payments`; update invoice `stripe_status`, `amount_paid`, `amount_remaining`, `hosted_invoice_url`; set invoice locked when `amount_paid > 0`.
- Keep Stripe as source of truth; reconcile locally via webhooks; target &lt; 1 minute for app to reflect status and payment history.

### Phase 3: Frontend — display and lock
- Invoicing page: display hosted invoice link, Paid/Remaining, status, payment history list; "Request payment" button; deposit suggestion (100% permit + 50% main+options) with override (Stripe suggested amount if supported, else staff-only guidance).
- When `amount_paid > 0` (locked): disable line-item editing; show banner "Invoice locked — payments started" and "Revise invoice" CTA.

### Phase 4: Revise invoice flow
- "Revise invoice" action: confirm void old + create new; void old Stripe invoice if open; create new Stripe invoice with current line items; set new invoice `revised_from_invoice_id` to old invoice id; add carryover note (and store old invoice reference); link old and revised in UI (read-only history for old).

### Safety Considerations
- Idempotent webhook handling; no duplicate payment rows (dedupe by Stripe id).
- RLS: all new tables/columns remain user-isolated by `user_id` (or invoice ownership).
- Revise flow: only void when Stripe invoice is open/draft; preserve old invoice record and link.

---

## What NOT to Do

- Do not take payment inside the Mason App (no Payment Element / Checkout in-app).
- Do not implement refund flows in this feature.
- Do not implement due dates or automatic reminders in this feature.
- Do not change collection method back to `charge_automatically`; must use `send_invoice` for partial payments on hosted page.

---

## Open Questions / Considerations

- **Where is `stripe_invoice_id` stored?** Resolved: `public.invoices.stripe_invoice_id` (and `stripe_invoice_status`) in existing migrations.
- **Which Stripe webhook endpoint is active and where is the handler?** Resolved: `supabase/functions/stripe-webhook/index.ts`; handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`; needs `invoice.updated` and partial-payment event handling plus payment record inserts.
- **Does Stripe allow a "suggested payment amount" on the hosted invoice for partial payment?** To confirm during /plan; if not, store suggested amount only internally as staff guidance.
- **Exact Stripe event for each partial payment:** Use `invoice.updated` and/or `invoice.payment_succeeded` / charge events to update `amount_paid` and insert `invoice_payments`; confirm Stripe docs for send_invoice + partial payment events.

---

## Deliverables (Summary)

- DB migration(s): invoices columns + `invoice_payments` table + RLS.
- Edge Functions: update `stripe-create-invoice` (send_invoice, partial payments, hosted_invoice_url); add/update `stripe-send-invoice`; update `stripe-webhook` (invoice.updated, payment events, amount_paid/amount_remaining, invoice_payments, lock).
- Frontend: Invoicing UI (hosted link, Paid/Remaining, status, payment history, Request payment, deposit suggestion, lock banner, Revise invoice CTA); Revise flow modal (void old + create new, carryover note, references).
- Basic tests / manual test checklist for partial payment and revise flow.
- RLS: all new tables/fields user-isolated by user_id.
