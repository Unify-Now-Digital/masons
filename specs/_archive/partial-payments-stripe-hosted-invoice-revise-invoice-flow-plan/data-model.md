# Phase 1: Data Model

## Current State (Invoices)

**Table:** `public.invoices`

- **Existing columns:** `id`, `order_id`, `invoice_number`, `customer_name`, `amount`, `status`, `due_date`, `issue_date`, `payment_method`, `payment_date`, `notes`, `created_at`, `updated_at`.
- **Existing Stripe columns:** `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_status`, `paid_at` (legacy Checkout); `stripe_invoice_id`, `stripe_invoice_status` (Invoicing API).
- **Index:** `idx_invoices_stripe_invoice_id` on `stripe_invoice_id` (partial, where not null).
- **RLS:** Enabled; current policy allows all access (to be refined per project; new columns follow same table).

## New Columns on `public.invoices`

Add only if missing (all additive):

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| `hosted_invoice_url` | text | null | From Stripe after finalize/send |
| `amount_paid` | bigint | 0 | In smallest currency unit (e.g. pence); synced from Stripe |
| `amount_remaining` | bigint | null | In smallest currency unit; synced from Stripe |
| `revised_from_invoice_id` | uuid | null | FK to `invoices(id)`; set on new invoice when created via “Revise” |
| `locked_at` | timestamptz | null | Set when first payment received (or derive lock as `amount_paid > 0` in UI) |

- `stripe_invoice_status` already exists; ensure it can store Stripe values: `draft`, `open`, `paid`, `void`, `uncollectible`, and optionally `partially_paid` if Stripe sends it.
- **Constraint:** Add FK for `revised_from_invoice_id` → `public.invoices(id)`.

## New Table: `public.invoice_payments`

One row per payment against a Stripe invoice (for history and webhook idempotency).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | uuid | NOT NULL | PK, default `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL | References `auth.users(id)`; for RLS (invoice owner) |
| `invoice_id` | uuid | NOT NULL | FK to `public.invoices(id)` |
| `stripe_invoice_id` | text | NOT NULL | Stripe invoice id |
| `stripe_payment_intent_id` | text | null | When available from Stripe |
| `stripe_charge_id` | text | null | When available from Stripe |
| `amount` | bigint | NOT NULL | In smallest currency unit (e.g. pence) |
| `status` | text | NOT NULL | e.g. `paid`, `failed`, `pending` |
| `created_at` | timestamptz | NOT NULL | default `now()` |

**Indexes:**

- `idx_invoice_payments_invoice_id` on `(invoice_id)`.
- `idx_invoice_payments_stripe_invoice_id` on `(stripe_invoice_id)`.
- Unique constraint for idempotency: `(stripe_invoice_id, stripe_charge_id)` unique where `stripe_charge_id is not null`, or unique on `stripe_payment_intent_id` where not null (to avoid duplicate rows on webhook retries).

**Idempotency:** Prefer unique on `(stripe_invoice_id, stripe_charge_id)` so each charge is recorded once; if Stripe only gives payment_intent, use unique on `stripe_payment_intent_id` (one row per intent).

## RLS: `public.invoice_payments`

- **Enable RLS** on `invoice_payments`.
- **SELECT:** `user_id = (select auth.uid())`.
- **INSERT:** `user_id = (select auth.uid())` (with check).
- **UPDATE:** `user_id = (select auth.uid())` (using + with check) if updates are needed; otherwise restrict to select/insert only.
- **DELETE:** Optional; if needed, same as update.

**Note:** `user_id` on `invoice_payments` must be set when inserting. When the webhook inserts a row, it must set `user_id` from the owning invoice. If `invoices` does not yet have a `user_id` column, add it (nullable) and set it when creating invoices from the app; webhook then copies `invoices.user_id` into `invoice_payments.user_id`. Legacy invoices with null `user_id` may require a policy that allows service role to insert and then either allow null `user_id` for legacy or backfill.

## Optional: `user_id` on `public.invoices`

- To support RLS on `invoice_payments` and future invoice-scoped RLS, add `user_id uuid references auth.users(id) on delete set null` to `invoices` (nullable for existing rows).
- When creating an invoice from the app, set `user_id = auth.uid()`.
- When the webhook inserts into `invoice_payments`, set `user_id` from `invoices.user_id` for the corresponding invoice; if null, consider allowing null in `invoice_payments` for that row or backfilling invoices.

## Query Patterns

- **Invoice with payment summary:** Select from `invoices` with `amount_paid`, `amount_remaining`, `stripe_invoice_status`, `hosted_invoice_url`, `revised_from_invoice_id`, and `locked_at` (or derive locked as `amount_paid > 0`).
- **Payment history:** `select * from invoice_payments where invoice_id = $1 order by created_at`.
- **Revise link:** For an invoice with `revised_from_invoice_id` set, join to previous invoice; for the previous invoice, query “revisions” with `invoices where revised_from_invoice_id = $1`.
