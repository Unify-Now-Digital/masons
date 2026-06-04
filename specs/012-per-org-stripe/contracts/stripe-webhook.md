# Contract: stripe-webhook (per-org, updated)

## Endpoint

`POST /functions/v1/stripe-webhook?organization_id=<ORG_UUID>`

## Authentication

- No JWT. **Stripe-Signature** verified with org's test or live webhook secret (see research R3).
- Missing or invalid `organization_id` → **400**.
- Unknown org or missing config → **500** / **404** (no fallback to global secret).

## Processing order

1. Parse `organization_id` from query string.
2. Read raw body; construct event (try test `whsec`, then live `whsec`, or order by heuristic after unsafe parse of `livemode` — implementation uses dual try).
3. Load Mason invoice(s) referenced in event.
4. If `invoices.organization_id !==` query org → **200** `{ received: true, ignored: "org_mismatch" }` (no DB mutation) **and** emit a **high-visibility / alerting audit log** (e.g. structured error level + `org_mismatch` + both org IDs + event id). Signature verification succeeded but the invoice tenant does not match the URL org — this indicates a **likely misconfigured per-org webhook URL** in the Stripe Dashboard, not a benign duplicate. Operators must notice this in logs/monitoring; do not swallow silently.
5. Route `event.type` per path-authoritative rules (research R7).

## Path detection

An invoice's payment path is determined by a **single canonical signal** on the Mason invoice row:

- **Checkout path** — `stripe_checkout_session_id` is present (set by checkout creation functions).
- **Hosted-invoice path** — `stripe_invoice_id` is present (set by Stripe Invoicing creation functions).

The webhook MUST use this same signal that creation functions stamp, **not** ad-hoc event metadata alone, so path authority is consistent end to end.

**Precedence when both signals are present**: If **both** `stripe_invoice_id` and `stripe_checkout_session_id` are present on the invoice (partial-payment-on-hosted-invoice flow), the **hosted-invoice path wins** (`stripe_invoice_id` takes precedence) and `invoice.paid` is the authoritative paid event. Checkout-only invoices (`stripe_checkout_session_id` present, no `stripe_invoice_id`) use `checkout.session.completed`.

## Authoritative paid events

| Event | Sets Mason `status=paid` |
|-------|--------------------------|
| `checkout.session.completed` | Yes only when invoice is on **checkout path** (`stripe_checkout_session_id` present) |
| `invoice.paid` | Yes only when invoice is on **hosted-invoice path** (`stripe_invoice_id` present) |
| `invoice.payment_succeeded` | No (sync only) |
| `invoice.updated` | No (sync only) |
| `payment_intent.succeeded` | **No** (remove paid writes) |

## Test round trip recording

When `event.livemode === false` and authoritative paid reconciliation succeeds for org:

```sql
UPDATE organization_stripe_config
SET test_round_trip_passed_at = now()
WHERE organization_id = :org AND test_round_trip_passed_at IS NULL;
```

## In-flight sessions

For `checkout.session.completed`, resolve Stripe API secret using `invoices.stripe_credential_mode` if set, else org's current resolved mode.

## Response

Always return **200** `{ received: true }` for ignored duplicates (idempotent); **400** only for signature/org parameter failures.
