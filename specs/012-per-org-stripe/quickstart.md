# Quickstart: Per-Organization Stripe (012-per-org-stripe)

**Branch**: `012-per-org-stripe`

## Prerequisites

- Supabase project with Edge Functions deploy access
- Platform operator email in `ADMIN_EMAILS` (and local `VITE_ADMIN_EMAIL` for UI tests)
- `STRIPE_CREDENTIALS_ENCRYPTION_KEY` set in Supabase secrets (generate 32+ char random; store in password manager)
- Per-organisation **test** and **live** Stripe accounts (not Connect)

## Deploy order

1. Apply migration `YYYYMMDDHHmmss_organization_stripe_config.sql`
2. Set secrets: `STRIPE_CREDENTIALS_ENCRYPTION_KEY`, ensure `ADMIN_EMAILS` populated
3. Deploy Edge Functions: `_shared/stripeOrgCredentials.ts` (via bundling), `stripe-org-config`, `stripe-get-publishable-key`, updated `stripe-webhook`, all existing `stripe-*` invoice/checkout functions
4. Deploy frontend (per-invoice publishable key)
5. **Do not** enable global `STRIPE_*` for new org traffic after migration

## Register organisation credentials (Churchill pilot)

```bash
# Example — use platform admin JWT or INBOX_ADMIN_TOKEN per contract
curl -X POST "$SUPABASE_URL/functions/v1/stripe-org-config" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "<CHURCHILL_ORG_UUID>",
    "action": "upsert_credentials",
    "test_secret_key": "sk_test_…",
    "test_publishable_key": "pk_test_…",
    "test_webhook_secret": "whsec_…",
    "live_secret_key": "sk_live_…",
    "live_publishable_key": "pk_live_…",
    "live_webhook_secret": "whsec_…"
  }'
```

## Stripe Dashboard — webhooks (per Stripe account)

For **each** of test and live Stripe accounts:

- URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook?organization_id=<ORG_UUID>`
- Events: `checkout.session.completed`, `invoice.paid`, `invoice.updated`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Copy signing secret into Mason via `upsert_credentials` for the matching mode

Local testing:

```bash
stripe listen --forward-to "http://127.0.0.1:54321/functions/v1/stripe-webhook?organization_id=<ORG_UUID>"
```

Use the CLI `whsec` for **test** config only.

**Setup verification**: Confirm each organisation's Stripe Dashboard webhook URL has the correct `?organization_id=<that org's uuid>`. A mismatch (e.g. Org B's events sent to Org A's URL) will verify the signature but **ignore** reconciliation due to org mismatch — events look "received" to Stripe while Mason never updates (check high-visibility `org_mismatch` logs).

## Test round trip (required before live)

1. Confirm `live_payments_enabled = false` for org
2. Create Mason invoice for org; run checkout or hosted invoice flow in **test** mode
3. Pay with test card `4242 4242 4242 4242`
4. Verify webhook returns 200; Mason invoice `status=paid`; `organization_stripe_config.test_round_trip_passed_at` set
5. Attempt `enable_live` — should succeed only after step 4
6. Operator: small live charge + refund (manual checklist, FR-013)
7. `action: "enable_live"` for Churchill only

## Verification checklist

- [ ] Org A payment appears only in Org A Stripe dashboard (test mode audit)
- [ ] Org B with live disabled cannot start live checkout (blocked message)
- [ ] Webhook with wrong `organization_id` does not update invoice (high-visibility `org_mismatch` log emitted)
- [ ] Each org's Stripe webhook URL uses that org's UUID in `organization_id` query param
- [ ] `payment_intent.succeeded` alone does not mark invoice paid
- [ ] Hosted invoice path: paid only after `invoice.paid`
- [ ] Disable live mid-checkout: new session blocked; in-flight completes
- [ ] Non-admin JWT cannot call `stripe-org-config`

## Rollback

- `disable_live` on affected org (immediate)
- Revert Edge deploy to previous build if handler regression
- Do not delete credential rows without operator backup of keys
