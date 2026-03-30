# API Contracts: Lean Stripe MVP for Invoicing

## Edge Function: stripe-create-checkout-session

**URL:** `POST /functions/v1/stripe-create-checkout-session`  
**Auth:** `X-Admin-Token` header (must match `INBOX_ADMIN_TOKEN`). JWT off.

### Request

```ts
// JSON body
{ invoice_id: string }  // UUID
```

### Response — Success (200)

```ts
{ url: string }  // Stripe Checkout URL
```

### Response — Error

- **401:** `{ error: "Unauthorized" }` — missing or invalid `X-Admin-Token`
- **400:** `{ error: "..." }` — invalid or missing `invoice_id`
- **404:** `{ error: "..." }` — invoice not found
- **500:** `{ error: "..." }` — server/config error (e.g. Stripe, DB)

---

## Edge Function: stripe-webhook

**URL:** `POST /functions/v1/stripe-webhook`  
**Auth:** None (public). Security via `Stripe-Signature` verification.

### Request

- **Body:** Raw request body (required for signature verification).
- **Headers:** `Stripe-Signature` must be present and valid for `STRIPE_WEBHOOK_SECRET`.

### Response

- **200:** Event handled (e.g. `checkout.session.completed`).
- **400:** Invalid signature or bad request.
- **500:** Unexpected error.

### Handled event

- **`checkout.session.completed`:** Read `invoice_id` from `session.metadata` or `payment_intent.metadata`; update `invoices` to paid.

---

## Frontend: createCheckoutSession

**Module:** `src/modules/invoicing/api/stripe.api.ts`

```ts
createCheckoutSession(invoiceId: string): Promise<{ url: string }>
```

- **HTTP:** POST to `VITE_SUPABASE_FUNCTIONS_URL/stripe-create-checkout-session`
- **Headers:** `Content-Type: application/json`, `X-Admin-Token: VITE_INBOX_ADMIN_TOKEN`
- **Body:** `{ invoice_id: invoiceId }`
- **Throws:** If `VITE_SUPABASE_FUNCTIONS_URL` or `VITE_INBOX_ADMIN_TOKEN` missing; or non-2xx response.
