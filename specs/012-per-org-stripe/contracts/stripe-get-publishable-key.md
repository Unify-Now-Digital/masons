# Contract: stripe-get-publishable-key Edge Function

**Purpose**: Return the correct publishable key for paying a given invoice (FR-005).

## Endpoint

`POST /functions/v1/stripe-get-publishable-key`

## Authentication

- Supabase JWT required.
- Caller MUST be member of invoice's organisation (`user_is_member_of_org(invoices.organization_id)` via RLS or explicit check in Edge).

## Request

```json
{ "invoice_id": "uuid" }
```

## Response 200

```json
{
  "publishable_key": "pk_test_… or pk_live_…",
  "mode": "test" | "live",
  "live_payments_enabled": boolean
}
```

## Errors

| Status | When |
|--------|------|
| 400 | Missing invoice_id |
| 403 | Not org member |
| 404 | Invoice not found |
| 422 | No Stripe config for organisation |
| 422 | `payment_not_configured` — missing publishable key for resolved mode |

## Client usage

`StripePaymentForm` calls this before `loadStripe(publishableKey)`; do not use `VITE_STRIPE_PUBLISHABLE_KEY` when per-org config exists.
