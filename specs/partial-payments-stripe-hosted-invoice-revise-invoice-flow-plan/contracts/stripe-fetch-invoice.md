# Contract: stripe-fetch-invoice Edge Function (Optional)

## Purpose

Fetch the latest state of a Stripe Invoice and sync to the Mason invoice (amount_paid, amount_remaining, stripe_invoice_status, hosted_invoice_url). Useful for on-demand refresh when webhooks may be delayed.

## Request

- **Method:** POST
- **Headers:** Admin token for auth.
- **Body (JSON):**
  - `invoice_id` (string, required): Mason invoice UUID.

## Behavior

1. Load Mason invoice; return 404 if not found.
2. If no `stripe_invoice_id`, return 400.
3. Fetch Stripe invoice by `stripe_invoice_id`.
4. Update Mason invoice row: `stripe_invoice_status`, `amount_paid`, `amount_remaining`, `hosted_invoice_url`, and `locked_at` if `amount_paid > 0`.
5. Do not insert into `invoice_payments` (webhook is source of truth for payment rows); this is a sync of invoice-level fields only.

## Response (success)

- **200 JSON:** Updated fields: `stripe_invoice_status`, `amount_paid`, `amount_remaining`, `hosted_invoice_url`, `locked_at` (or equivalent).

## Errors

- 400: No Stripe invoice linked.
- 401: Unauthorized.
- 404: Invoice not found.
- 500: Stripe or Supabase error.
