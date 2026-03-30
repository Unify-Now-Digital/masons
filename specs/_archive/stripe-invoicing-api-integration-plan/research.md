# Research: Stripe Invoicing API Integration

## Current Stripe Integration

### Edge Functions (Deno-based, Supabase)

| Function | Path | Purpose |
|----------|------|---------|
| `stripe-create-checkout-session` | `supabase/functions/stripe-create-checkout-session/index.ts` | Creates Checkout Session, returns URL |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | Handles `checkout.session.completed`, marks invoice paid |

Both use:
- `npm:@supabase/supabase-js@2.49.4`
- `npm:stripe@14.21.0`
- Auth via `X-Admin-Token` header (checkout) and `Stripe-Signature` (webhook)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INBOX_ADMIN_TOKEN`, `APP_ORIGIN`

### Frontend Stripe API

**File:** `src/modules/invoicing/api/stripe.api.ts`

- `createCheckoutSession(invoiceId)` → calls Edge Function → returns `{ url }`.
- Uses `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_INBOX_ADMIN_TOKEN`.

### "Pay" Button Locations

1. **InvoiceDetailSidebar** (`src/modules/invoicing/components/InvoiceDetailSidebar.tsx`):
   - "Copy payment link" → `createCheckoutSession(id)` → copies URL.
2. **invoiceColumnDefinitions** (`src/modules/invoicing/components/invoiceColumnDefinitions.tsx`):
   - `StripePaymentLinkCell` → "Open" button → `createCheckoutSession(id)` → opens URL in new tab.

### Invoice Schema (DB)

**Table:** `invoices`

Base columns (migration `20250608000002`):
- `id`, `order_id`, `invoice_number`, `customer_name`, `amount`, `status`, `due_date`, `issue_date`, `payment_method`, `payment_date`, `notes`, `created_at`, `updated_at`

Stripe columns (migration `20260123120000`):
- `stripe_checkout_session_id` (text)
- `stripe_payment_intent_id` (text)
- `stripe_status` (text, default `'unpaid'`)
- `paid_at` (timestamptz)

### Invoice TypeScript Type

**File:** `src/modules/invoicing/types/invoicing.types.ts`

```ts
export interface Invoice {
  id: string;
  order_id: string | null;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  issue_date: string;
  payment_method: string | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_status?: 'unpaid' | 'pending' | 'paid' | null;
  paid_at?: string | null;
}
```

### Invoice Hooks

**File:** `src/modules/invoicing/hooks/useInvoices.ts`

- `useInvoicesList()`, `useInvoice(id)`, `useCreateInvoice()`, `useUpdateInvoice()`, `useDeleteInvoice()`

### Order Total Calculation (reused in Edge Function)

In `stripe-create-checkout-session/index.ts`:
- Fetches from `orders_with_options_total` view.
- Computes total: `base + permit_cost + additional_options_total`.
- Converts to pence: `Math.round(totalPounds * 100)`.

### NPM Dependencies

- `@stripe/stripe-js`: **NOT installed**
- `@stripe/react-stripe-js`: **NOT installed**
- Need to add both for Payment Element.

### Environment Variables

Currently set (from `.env` and Supabase secrets):
- `VITE_SUPABASE_FUNCTIONS_URL`
- `VITE_INBOX_ADMIN_TOKEN`
- `STRIPE_SECRET_KEY` (Edge Function)
- `STRIPE_WEBHOOK_SECRET` (Edge Function)
- `APP_ORIGIN` (Edge Function)

Need to add:
- `VITE_STRIPE_PUBLISHABLE_KEY` (frontend, for `loadStripe()`)

---

## Stripe Invoicing API Key Behaviors

### Creating a Stripe Invoice (no emails)

```ts
const invoice = await stripe.invoices.create({
  customer: stripeCustomerId,
  collection_method: 'charge_automatically',
  auto_advance: false,       // We finalize manually
  metadata: { mason_invoice_id: invoiceId },
  // Do NOT set pending_invoice_items_behavior
});
```

### Adding Line Items

```ts
await stripe.invoiceItems.create({
  customer: stripeCustomerId,
  invoice: stripeInvoice.id,
  amount: amountInPence,
  currency: 'gbp',
  description: `Invoice ${invoiceNumber}`,
});
```

### Finalizing

```ts
const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id, {
  auto_advance: false,  // Prevent auto-charging and emails
});
```

### Getting the PaymentIntent

```ts
const paymentIntent = await stripe.paymentIntents.retrieve(
  finalized.payment_intent as string
);
// Return paymentIntent.client_secret to frontend
```

### Idempotency Guard

Before creating a new Stripe Invoice, check if `stripe_invoice_id` is already set on the Mason invoice. If so, retrieve the existing Stripe Invoice and return its PaymentIntent's `client_secret` — do not create a duplicate.

### Webhook Events

- `invoice.paid` → `data.object.id` is the Stripe Invoice ID; look up by `stripe_invoice_id`.
- `invoice.payment_failed` → same lookup; update `stripe_invoice_status` only.
