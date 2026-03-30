# Quickstart: Stripe Invoicing API Integration

## Prerequisites

1. Stripe test-mode secret key (`STRIPE_SECRET_KEY`) configured in Supabase Edge Function secrets.
2. Stripe test-mode publishable key added to `.env` as `VITE_STRIPE_PUBLISHABLE_KEY`.
3. Stripe webhook secret (`STRIPE_WEBHOOK_SECRET`) configured.
4. Supabase CLI installed for local Edge Function testing.
5. Stripe CLI installed for webhook forwarding (`stripe listen --forward-to ...`).

## Run the app

```bash
cd c:\Users\owner\Desktop\unify-memorial-mason-main
npm install
npm run dev
```

## Apply the migration

```bash
supabase db push
# Or apply manually via Supabase dashboard SQL editor
```

## Test the flow

### 1. Create a Stripe Invoice

- Open the app → Invoicing module.
- Create or select an existing invoice with linked orders (total > 0).
- Click "Pay with Stripe" (new button).
- Expected: A Stripe Payment Element appears inline (modal or panel).

### 2. Complete payment

- Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.
- Submit payment.
- Expected: Success message shown; invoice status updates to "paid".

### 3. Verify webhook

- Check Supabase `invoices` table:
  - `stripe_invoice_id` is populated.
  - `stripe_invoice_status` = `'paid'`.
  - `status` = `'paid'`.
  - `stripe_payment_intent_id` is populated.

### 4. Test failure

- Use Stripe test card: `4000 0000 0000 0002` (decline).
- Expected: Payment fails; `stripe_invoice_status` = `'payment_failed'`; Mason `status` unchanged.

### 5. Test idempotency

- Click "Pay with Stripe" again on the same invoice.
- Expected: Does not create a second Stripe Invoice; retrieves existing one and shows Payment Element.

### 6. Backward compatibility

- Old invoices with `stripe_checkout_session_id` should still display correctly.
- Old "Copy payment link" / "Open" actions can remain functional for legacy invoices.

## Build

```bash
npm run build
npm run lint
```
