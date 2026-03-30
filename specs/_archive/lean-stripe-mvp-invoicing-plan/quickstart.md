# Quickstart: Lean Stripe MVP for Invoicing

## Overview

Get Stripe Checkout payment links and webhook-driven “paid” updates working locally (TEST mode).

---

## 1. Database

Run migration that adds Stripe columns to `invoices`:

```bash
supabase db push
# or: supabase migration up
```

Confirm `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at` exist on `invoices`.

---

## 2. Supabase Edge Function secrets

Set (or verify) in Supabase project:

```bash
supabase secrets set INBOX_ADMIN_TOKEN=your-token
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set APP_ORIGIN=http://localhost:5173
```

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: usually already set.
- `APP_ORIGIN`: no trailing slash. Use dev URL (e.g. Vite) for local testing.

---

## 3. Frontend env

`.env`:

```
VITE_SUPABASE_FUNCTIONS_URL=https://<PROJECT_REF>.supabase.co/functions/v1
VITE_INBOX_ADMIN_TOKEN=<same as INBOX_ADMIN_TOKEN>
```

Restart Vite after changes.

---

## 4. Deploy Edge Functions

```bash
supabase functions deploy stripe-create-checkout-session
supabase functions deploy stripe-webhook
```

---

## 5. Stripe Dashboard (TEST mode)

1. **Webhook**
   - Endpoint: `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

2. **Products/Prices**
   - Not required for Checkout `mode: 'payment'` with custom amount. We use line items or `amount` via API.

---

## 6. Manual test flow

1. Open app → Invoicing → select an invoice with linked orders and positive amount.
2. Click “Copy payment link.” Link copied, toast shown.
3. Open link in new tab → complete Checkout (TEST card `4242 4242 4242 4242`).
4. Redirect to `/invoicing/:id?stripe=success&session_id=...` → invoice shows paid; status pill “paid.”
5. In Stripe Dashboard → Developers → Webhooks → verify `checkout.session.completed` delivered and 200.

---

## 7. Troubleshooting

- **401 on create-checkout-session:** `X-Admin-Token` missing or wrong. Check `VITE_INBOX_ADMIN_TOKEN` and header.
- **Webhook 400:** Invalid signature. Ensure raw body used and `STRIPE_WEBHOOK_SECRET` matches Dashboard.
- **Invoice not updating:** Check webhook logs; confirm `metadata.invoice_id` in session. Verify DB update in function.
