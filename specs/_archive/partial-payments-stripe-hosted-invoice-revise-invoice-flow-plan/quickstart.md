# Quickstart: Partial Payments + Revise Invoice Flow

## Prerequisites

- Node/npm (or pnpm) for frontend.
- Supabase CLI for local migrations and Edge Functions.
- Stripe account with Invoicing enabled and **Partial payments** turned on (see [research.md](research.md)).

## Environment

### Supabase

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_DB_URL` if running migrations externally).

### Stripe

- `STRIPE_SECRET_KEY`: Secret key for API calls (create/send invoice, void, fetch).
- `STRIPE_WEBHOOK_SECRET`: Signing secret for the webhook endpoint (different for local vs deployed).
- Product IDs (for line items): `STRIPE_PRODUCT_ID_PERMIT`, `STRIPE_PRODUCT_ID_MEMORIAL`, `STRIPE_PRODUCT_ID_OPTION`.

### Edge Functions (admin)

- `INBOX_ADMIN_TOKEN` (or equivalent): Token sent as `x-admin-token` for stripe-create-invoice, stripe-send-invoice, stripe-fetch-invoice.

## Local Stripe Webhook (development)

1. Install Stripe CLI and login.
2. Forward webhooks to your local Edge Function:
   - `stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook`
3. Use the signing secret printed by `stripe listen` as `STRIPE_WEBHOOK_SECRET` in your local Supabase env (e.g. `.env.local` or Supabase dashboard for local project).

## Running migrations

From repo root:

```bash
supabase db reset
# or
supabase migration up
```

Apply migrations in order; the new migration adds columns to `invoices` and creates `invoice_payments` + RLS.

## Running Edge Functions locally

```bash
supabase functions serve
```

Invoke with admin token:

- `stripe-create-invoice`: POST with body `{ "invoice_id": "<uuid>" }`, header `x-admin-token: <INBOX_ADMIN_TOKEN>`.
- `stripe-send-invoice`: POST with body `{ "invoice_id": "<uuid>" }`, header `x-admin-token: <INBOX_ADMIN_TOKEN>`.
- `stripe-fetch-invoice`: POST with body `{ "invoice_id": "<uuid>" }`, header `x-admin-token: <INBOX_ADMIN_TOKEN>`.
- `stripe-webhook`: POST with Stripe event payload and `stripe-signature` (Stripe CLI or Dashboard sends this).

## Frontend

- Ensure app uses the same Supabase and (for Edge Function calls) the same base URL and admin token or authenticated user flow as configured in the app.
- Invoicing page: after implementation, use “Create Stripe invoice” then “Request payment” to get `hosted_invoice_url` and open it in a new tab; partial payments can be made on that page.

## Checklist before development

- [ ] Partial payments enabled in Stripe Dashboard (Invoicing).
- [ ] `STRIPE_WEBHOOK_SECRET` set for the environment (local CLI secret when using `stripe listen`).
- [ ] Migrations applied (invoices new columns, invoice_payments table, RLS).
- [ ] Edge Functions deployed or served locally with required env vars.
