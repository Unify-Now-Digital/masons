# Research: Lean Stripe MVP for Invoicing

## Context

- **Goal:** Staff share Stripe Checkout link; customer pays in GBP; webhook marks invoice paid. Link-based only (no Stripe.js).
- **Tables:** `invoices` only; additive columns. Orders/invoice totals unchanged.

---

## Technical Decisions

### 1. Stripe Checkout vs Payment Intents directly

**Decision:** Use Checkout Sessions (`mode: 'payment'`).

**Rationale:**
- Hosted UI; no Stripe.js. Meets “link-based only” constraint.
- Handles redirect URLs, `success` / `cancel` flow, and `session_id` in URL.
- Session and PaymentIntent both expose `metadata`; we set `invoice_id` on both for webhook lookup.

### 2. Webhook verification

**Decision:** Verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` and raw body. Use `constructEvent` / `constructEventAsync`.

**Rationale:**
- Stripe requires raw body for signature verification; parsed JSON must not be used.
- Deno/Edge–compatible Stripe SDK supports this. Reject with 400 if invalid.

### 3. Invoice total source for Checkout

**Decision:** Prefer computing total from orders (same as `getOrderTotal`) in the edge function. Use `invoices.amount` only if it is guaranteed to match.

**Rationale:**
- Spec says “invoice is sum of its orders.” Orders are source of truth; `amount` can lag.
- Edge function already loads orders for session; we can sum there. Avoids drift.

### 4. Idempotency for `checkout.session.completed`

**Decision:** Webhook updates idempotent by `invoice_id`. Optionally skip if `stripe_status` already `'paid'`.

**Rationale:**
- Stripe may retry. Re-applying same updates is safe. Skip when already paid avoids redundant writes.

### 5. Auth for create-checkout-session

**Decision:** `X-Admin-Token == INBOX_ADMIN_TOKEN` only. JWT **OFF**.

**Rationale:**
- Matches `inbox-twilio-send` / `inbox-gmail-send`. Single shared secret; simple. Webhook is public; secured by signature.

### 6. APP_ORIGIN

**Decision:** Env var `APP_ORIGIN` (or `VITE_APP_ORIGIN`), no trailing slash. Used for `success_url` / `cancel_url`.

**Rationale:**
- Dev vs prod differ. Frontend base URL may differ from backend. Explicit config avoids hardcoding.

---

## Constraints

- **Additive-only** DB changes. No view changes for totals.
- **No Stripe.js**; no embedded checkout.
- **GBP, one-time** only. No subscriptions or multi-currency.
- **Secrets:** Never log `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INBOX_ADMIN_TOKEN`.

---

## References

- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Webhooks: https://stripe.com/docs/webhooks/signature-verification
- Spec: `specs/implement lean stripe mvp for invoicing module -gbp- one-time payments only- staff shares link.md`
