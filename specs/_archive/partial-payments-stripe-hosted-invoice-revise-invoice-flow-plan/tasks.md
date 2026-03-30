# Phase 2: Implementation Tasks

## Phase 1 — Database migrations (Supabase)

- [X] **1.1** Inspect current `invoices` schema and confirm `stripe_invoice_id`, `stripe_invoice_status` exist.
- [X] **1.2** Add columns to `invoices` (if missing): `hosted_invoice_url` (text), `amount_paid` (bigint default 0), `amount_remaining` (bigint nullable), `revised_from_invoice_id` (uuid nullable FK to invoices.id), `locked_at` (timestamptz nullable). Ensure `stripe_invoice_status` exists.
- [X] **1.3** Create `invoice_payments` table: id (uuid PK), user_id (uuid nullable), invoice_id (uuid not null FK invoices.id), stripe_invoice_id (text not null), stripe_payment_intent_id (text nullable), stripe_charge_id (text nullable), amount (bigint not null), status (text not null), created_at (timestamptz default now()). Add indexes on invoice_id and stripe_invoice_id; add unique constraint for idempotency (e.g. (stripe_invoice_id, stripe_charge_id) or stripe_payment_intent_id).
- [X] **1.4** Add `user_id` to `invoices` (uuid nullable, FK auth.users) if not present, for RLS and for populating `invoice_payments.user_id` from webhook.
- [X] **1.5** Enable RLS on `invoice_payments`. Policies: SELECT/INSERT/UPDATE by `user_id = (select auth.uid())` or user_id is null (legacy).

## Phase 2 — Stripe Edge Functions (invoice create / send / fetch)

- [X] **2.1** Update `stripe-create-invoice`: set `collection_method: 'send_invoice'` when creating Stripe invoice; create line items as before; finalize and send invoice; persist `stripe_invoice_id`, `hosted_invoice_url`, `stripe_invoice_status` (and optionally `amount_paid`/`amount_remaining` from Stripe response).
- [X] **2.2** Add or update `stripe-send-invoice`: accept `invoice_id`; if no Stripe invoice, return 400 or call create flow; call Stripe send invoice; return `hosted_invoice_url` and status.
- [X] **2.3** (Optional) Add `stripe-fetch-invoice`: fetch Stripe invoice by Mason invoice’s `stripe_invoice_id`; update Mason invoice with `stripe_invoice_status`, `amount_paid`, `amount_remaining`, `hosted_invoice_url`, `locked_at`; return updated fields.

## Phase 3 — Webhook updates (source of truth sync)

- [X] **3.1** Confirm `stripe-webhook` handler is deployed and `STRIPE_WEBHOOK_SECRET` is set.
- [X] **3.2** Handle `invoice.updated`: map stripe_invoice_id → Mason invoice; update stripe_invoice_status, amount_paid, amount_remaining, hosted_invoice_url; set locked_at when amount_paid > 0.
- [X] **3.3** Handle `invoice.payment_succeeded` and/or `invoice_paid`: update invoice totals; insert into `invoice_payments` with idempotency (unique on stripe_charge_id or payment_intent_id); set user_id from invoice.user_id.
- [X] **3.4** Handle `payment_intent.succeeded` as fallback when linked to an invoice: insert payment record if not already present.
- [X] **3.5** Idempotency: unique constraints on invoice_payments; insert and ignore 23505.

## Phase 4 — Frontend (Invoicing page UX)

- [X] **4.1** Invoice summary: show Stripe status (draft/open/paid/void/uncollectible), Paid amount, Remaining amount, and “Hosted Invoice Link” button (open `hosted_invoice_url` in new tab).
- [X] **4.2** “Request payment” action: call stripe-send-invoice; refresh or display updated hosted link/status.
- [X] **4.3** Payment history panel: list `invoice_payments` for the invoice (date, amount, status, optional Stripe refs).
- [X] **4.4** Locking: when `amount_paid > 0` or stripe status indicates payment started, disable line-item editing; show banner “Invoice locked — payments started” and primary CTA “Revise invoice”.
- [X] **4.5** Deposit suggestion: compute suggested deposit = 100% permit + 50% (main + options); allow override field (store locally as staff guidance); display when requesting payment (do not send to Stripe unless Stripe supports suggested partial amount).

## Phase 5 — Revise invoice flow (void + recreate)

- [X] **5.1** Add “Revise invoice” modal: explain that old invoice will be voided and new one created; payments remain on old invoice; confirm and capture updated line items (existing editor).
- [X] **5.2** Backend (new Edge Function or extend create): void old Stripe invoice (if open/draft); create new Stripe invoice with new line items; set new Mason invoice `revised_from_invoice_id` to old invoice id; add note “Revised from INV-xxxx; previous payments on prior invoice.”
- [X] **5.3** UI: link old ↔ new invoices in invoice detail (e.g. “Revised from …” / “Revised to …”); old invoice read-only.

## Testing / QA

- [ ] **T.1** Create Mason invoice → create Stripe invoice → hosted link works and opens Stripe page.
- [ ] **T.2** Customer makes partial payment on hosted page → Stripe shows partially paid → within ~1 min webhook updates local amount_paid/amount_remaining and adds payment record.
- [ ] **T.3** Second partial payment → totals and payment history update again.
- [ ] **T.4** After first payment, invoice editing is locked in UI; “Revise invoice” is visible.
- [ ] **T.5** Revise invoice: new invoice created, old voided in Stripe when applicable; both linked in app; old is read-only.
- [ ] **T.6** RLS: another user cannot see invoice_payments or invoice details they do not own (if RLS is tightened to user_id).

## Outputs

- SQL migration file(s) for invoices columns + invoice_payments + RLS.
- Updated/new Edge Functions and env var documentation.
- Updated webhook handler.
- Frontend: Invoicing summary, request payment, payment history, lock banner, revise modal and linking.
- Manual QA notes (from checklist above).
