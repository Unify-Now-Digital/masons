# Data Model: Stripe Invoicing API Integration

## No structural DB changes

The Invoices → Orders → Jobs → Installations chain is **unchanged**.

---

## Additive columns on `invoices` table

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `stripe_invoice_id` | `text` | `null` | Stores the Stripe Invoice object ID (e.g. `in_xxx`) |
| `stripe_invoice_status` | `text` | `null` | Mirrors Stripe invoice status for quick display (`draft`, `open`, `paid`, `uncollectible`, `void`, `payment_failed`) |

### Migration SQL

```sql
alter table public.invoices
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_invoice_status text;

create index if not exists idx_invoices_stripe_invoice_id
  on public.invoices (stripe_invoice_id)
  where stripe_invoice_id is not null;
```

### Backward compatibility

- Existing columns (`stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at`) are **not dropped or renamed**.
- Old invoices paid via Checkout continue to work.
- `stripe_status` (old) vs `stripe_invoice_status` (new): both can coexist. Old flow writes `stripe_status`; new flow writes `stripe_invoice_status`. Frontend can display whichever is relevant.

---

## TypeScript type update

Add to `Invoice` interface in `src/modules/invoicing/types/invoicing.types.ts`:

```ts
stripe_invoice_id?: string | null;
stripe_invoice_status?: string | null;
```

---

## New frontend API function

In `src/modules/invoicing/api/stripe.api.ts`, add:

```ts
export interface CreateStripeInvoiceResponse {
  stripe_invoice_id: string;
  client_secret: string;
  payment_intent_id: string;
}

export async function createStripeInvoice(
  invoiceId: string
): Promise<CreateStripeInvoiceResponse> { ... }
```

---

## No changes to

- `orders`, `jobs`, `inscriptions`, `workers`, or any other table.
- RLS policies on `invoices` (new columns inherit existing row-level policies).
- Invoice creation/editing hooks or UI.
