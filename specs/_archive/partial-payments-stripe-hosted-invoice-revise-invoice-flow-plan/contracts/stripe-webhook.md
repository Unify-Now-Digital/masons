# Contract: stripe-webhook Edge Function

## Purpose

Receive Stripe webhook events and keep Mason invoice and payment data in sync with Stripe (source of truth). Handle partial payments and idempotent payment records.

## Request

- **Method:** POST
- **Headers:** `stripe-signature` (required for verification).
- **Body:** Raw request body (required for signature verification; do not parse as JSON before verify).

## Verification

- Use `STRIPE_WEBHOOK_SECRET` to verify `stripe-signature`; return 400 if invalid.

## Events to Handle

1. **invoice.updated**
   - Update Mason invoice (by `stripe_invoice_id`): `stripe_invoice_status`, `amount_paid`, `amount_remaining`, `hosted_invoice_url`.
   - Set `locked_at` to now() if `amount_paid > 0` (or equivalent).

2. **invoice.payment_succeeded** (or equivalent for partial payments)
   - Map Stripe invoice → Mason invoice.
   - Update invoice: status, amount_paid, amount_remaining, hosted_invoice_url, locked_at.
   - Insert into `invoice_payments` with idempotency: use unique constraint on `(stripe_invoice_id, stripe_charge_id)` or `stripe_payment_intent_id` to avoid duplicates on retries.

3. **invoice.paid**
   - Keep existing behavior; also ensure amount_paid/amount_remaining and payment record are written (or already written by invoice.updated / payment_succeeded).

4. **invoice_payment.paid** (if Stripe sends this for partial payments)
   - Same as above: update invoice totals and insert one row in `invoice_payments` with idempotency.

5. **payment_intent.succeeded** (fallback)
   - If event links to an invoice (e.g. via metadata or expand), update invoice and insert payment record with idempotency.

6. **invoice.payment_failed**
   - Keep existing: update `stripe_invoice_status` only; do not change Mason `status` to paid.

## Idempotency

- Before inserting into `invoice_payments`, ensure unique constraint on `(stripe_invoice_id, stripe_charge_id)` or `stripe_payment_intent_id`; on conflict do nothing (or skip insert).
- Updates to `invoices` table are idempotent (same values written again are safe).

## user_id for invoice_payments

- When inserting `invoice_payments`, set `user_id` from the corresponding Mason invoice’s `user_id`. If `invoices.user_id` is null (legacy), document behavior: e.g. allow null in `invoice_payments` for that row or skip insert for legacy (prefer backfill so RLS is consistent).

## Response

- **200:** Always return 200 with `{ "received": true }` after processing (or Stripe may retry).
- **400:** Invalid signature.
- **500:** Only if processing cannot proceed (e.g. DB down); Stripe will retry.
