# Data model: Auto-create Stripe invoice

**Feature:** [auto-create-stripe-invoice.md](../auto-create-stripe-invoice.md)

---

## Schema (no changes)

No migrations or schema changes are required for this feature. Existing structures are used as follows.

### Invoices (`public.invoices`)

- **Relevant columns:** `id`, `amount`, `stripe_invoice_id`, `hosted_invoice_url`, `stripe_invoice_status`, `amount_paid`, `amount_remaining`, `locked_at`.
- **Billable condition:** Invoice is considered billable when `amount > 0` and it has at least one linked order (orders with `invoice_id = invoices.id`). The app derives amount from the sum of order totals; `invoice.amount` is updated when orders change (e.g. via `recalculateInvoiceAmount` or at creation in CreateInvoiceDrawer).
- **Stripe fields:** Populated by the Edge Function `stripe-create-invoice` when a Stripe invoice is created; the app only triggers creation and then invalidates/refetches.

### Orders (`public.orders`, view `orders_with_options_total`)

- **Link:** `orders.invoice_id` → `invoices.id`. Invoice amount is computed as the sum of order totals (base + permit + additional options) from `orders_with_options_total`.
- **No change:** No new columns or constraints.

### Relationship

- One invoice has many orders (`orders.invoice_id`). "Invoice has billable content" is implied by `amount > 0` after recalc (which is derived from linked orders). The `ensureStripeInvoice` helper can therefore use `invoice.amount > 0` and optional check that at least one order exists (or rely on backend: `stripe-create-invoice` fails if total is 0).
