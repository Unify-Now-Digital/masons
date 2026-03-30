# Contract: stripe-create-invoice Edge Function

## Purpose

Create (or return existing) a Stripe Invoice for a Mason invoice. Supports partial payments and hosted invoice page; collection method must be `send_invoice`.

## Request

- **Method:** POST
- **Headers:** `x-admin-token` (or `X-Admin-Token`) — must match `INBOX_ADMIN_TOKEN` (or project-configured admin token).
- **Body (JSON):**
  - `invoice_id` (string, required): Mason invoice UUID.

## Behavior

1. Load Mason invoice by `invoice_id`; return 404 if not found.
2. If Mason invoice is already `paid`, return 400.
3. If `stripe_invoice_id` already set:
   - Retrieve Stripe invoice; if status is `paid`, return existing `hosted_invoice_url` and status.
   - If `open` or `draft`, finalize if draft, then return `hosted_invoice_url`, `stripe_invoice_id`, `stripe_invoice_status`.
   - If `void` or `uncollectible`, clear Stripe ids on Mason invoice and continue to create new Stripe invoice.
4. Otherwise create new Stripe Invoice:
   - **Collection method:** `collection_method: 'send_invoice'`.
   - **Partial payments:** Ensure account/settings allow partial payments; no extra param required if enabled at account level.
   - Create Stripe Customer (or reuse if we have one); attach metadata `mason_invoice_id`.
   - Add invoice line items from Mason orders (base, permit, options) as today.
   - Finalize invoice with `auto_advance: false` (or per Stripe best practice for send_invoice).
   - Send invoice (Stripe API send invoice) so `hosted_invoice_url` is available.
5. Persist on Mason invoice: `stripe_invoice_id`, `stripe_invoice_status`, `hosted_invoice_url`, and any other new columns (e.g. `amount_paid`, `amount_remaining` from Stripe response if available).

## Response (success)

- **200 JSON:**
  - `stripe_invoice_id` (string)
  - `hosted_invoice_url` (string)
  - `stripe_invoice_status` (string)
  - Optionally: `invoice_pdf`, `amount_paid`, `amount_remaining` for UI.

## Errors

- 400: Invalid body, missing `invoice_id`, or invoice already paid.
- 401: Missing or invalid admin token.
- 404: Invoice not found.
- 500: Stripe or Supabase error.

## Env vars

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `INBOX_ADMIN_TOKEN` (or equivalent)
- `STRIPE_PRODUCT_ID_PERMIT`, `STRIPE_PRODUCT_ID_MEMORIAL`, `STRIPE_PRODUCT_ID_OPTION`
