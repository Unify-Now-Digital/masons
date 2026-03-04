# Contract: stripe-send-invoice Edge Function

## Purpose

Send (or re-send) a Stripe Invoice so the customer receives the hosted invoice link. Used when staff clicks “Request payment”.

## Request

- **Method:** POST
- **Headers:** `x-admin-token` (or equivalent) for auth.
- **Body (JSON):**
  - `invoice_id` (string, required): Mason invoice UUID.

## Behavior

1. Load Mason invoice; return 404 if not found.
2. If no `stripe_invoice_id`, call stripe-create-invoice flow first (or return 400 with message to create Stripe invoice first).
3. Call Stripe: send invoice for the given `stripe_invoice_id` (e.g. `stripe.invoices.sendInvoice(invoiceId)`).
4. Optionally re-fetch the Stripe invoice and update Mason invoice with latest `hosted_invoice_url`, `stripe_invoice_status`, `amount_paid`, `amount_remaining`.
5. Return the hosted URL and status so the frontend can open or copy the link.

## Response (success)

- **200 JSON:**
  - `stripe_invoice_id` (string)
  - `hosted_invoice_url` (string)
  - `stripe_invoice_status` (string)

## Errors

- 400: No Stripe invoice linked; create Stripe invoice first.
- 401: Missing or invalid admin token.
- 404: Invoice not found.
- 500: Stripe or Supabase error.

## Env vars

- Same as stripe-create-invoice for Supabase and Stripe.
