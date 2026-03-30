# Data Model: Lean Stripe MVP for Invoicing

## Overview

Additive changes to `public.invoices` only. No new tables. No changes to `orders`, `orders_with_options_total`, or invoice total logic.

---

## Existing: `public.invoices`

**Current columns (relevant):**
- `id uuid` PK
- `order_id uuid` (legacy, nullable)
- `invoice_number`, `customer_name`, `amount`, `status`, `due_date`, `issue_date`, `payment_method`, `payment_date`, `notes`
- `created_at`, `updated_at`

**Invoice total:** Derived from orders (`invoice_id` → orders). Sum of `getOrderTotal(order)` = base + `permit_cost` + `additional_options_total`.

---

## New columns (additive)

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `stripe_checkout_session_id` | `text` | yes | - | Stripe Checkout Session ID from creation |
| `stripe_payment_intent_id` | `text` | yes | - | Set when payment completes (webhook) |
| `stripe_status` | `text` | yes | `'unpaid'` | `unpaid` \| `pending` \| `paid` |
| `paid_at` | `timestamptz` | yes | - | When Stripe payment completed |

**Indexes:** Add only if needed (e.g. lookup by `stripe_checkout_session_id` for idempotency/debugging). Not required for MVP.

---

## Relationships

- **Unchanged:** `invoices` ↔ `orders` via `orders.invoice_id`. Invoice total still from orders.
- **Views:** `orders_with_options_total` and any reporting views that use `invoices` remain unchanged. New columns are additive; `SELECT *` will include them.

---

## Frontend types

- Extend `Invoice` (or equivalent) with:
  - `stripe_checkout_session_id: string | null`
  - `stripe_payment_intent_id: string | null`
  - `stripe_status: 'unpaid' | 'pending' | 'paid' | null`
  - `paid_at: string | null` (ISO)

- Ensure `fetchInvoice` / `fetchInvoices` return these (e.g. `select('*')` or explicit list including them).
