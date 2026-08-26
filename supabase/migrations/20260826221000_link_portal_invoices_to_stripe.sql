-- =============================================================================
-- RECORD OF APPLIED PRODUCTION WRITE — do not re-run.
-- Applied 2026-08-26 by Giorgi via Supabase Dashboard SQL editor, immediately
-- after 20260826220000_restore_zeroed_portal_invoice_amounts.sql.
--
-- Purpose: stamp the four portal invoices' existing live Stripe invoices onto
-- their Mason rows, THEN backfill orders.invoice_id. ORDERING IS LOAD-BEARING:
-- the stamp had to precede the backfill because once orders.invoice_id links
-- exist, expanding a row reaches ensureStripeInvoice with amount > 0, and with
-- stripe_invoice_id still null it would have CREATED duplicate live Stripe
-- invoices for real SM customers on first expand
-- (ensureStripeInvoice.ts:57–63 skip requires the id; stripe-create-invoice
-- creates + finalizes an open invoice otherwise).
--
-- Stripe-side evidence (read-only inspection of the SM live Stripe account,
-- 2026-08-26): each of the four customers had a PAIR of Stripe invoices
-- created May 2026 — one full-amount, one half-amount — all status "open",
-- none with any payment. The full-amount invoice of each pair was stamped;
-- its total matched the restored Mason amount exactly:
--   amount_remaining 471340 pence = £4713.40
--   amount_remaining 392000 pence = £3920.00
--   amount_remaining 302500 pence = £3025.00
--   amount_remaining 198280 pence = £1982.80
-- amount_paid = 0 on all four (nothing collected). stripe_credential_mode =
-- 'live' stamped so the per-org idempotency path in stripe-create-invoice
-- (index.ts:167–179) recognises the invoice instead of 409-refusing.
-- stripe_invoice_status = 'open' matches Stripe reality; future payments sync
-- via stripe-webhook's .eq('stripe_invoice_id', ...) matching.
--
-- Placeholders per repo convention: real org UUID in CLAUDE.local.md; real
-- invoice ids / Stripe ids / URLs to be pasted from the Dashboard session.
-- =============================================================================

-- --- 1) Stamp UPDATEs as run (one per invoice; explicit single-row targets) --
update public.invoices
set stripe_invoice_id     = '<STRIPE_INVOICE_ID_1>',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 471340,
    hosted_invoice_url    = '<HOSTED_URL_1>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = '<INVOICE_ID_1>'
  and stripe_invoice_id is null;   -- guard: never overwrite an existing link

update public.invoices
set stripe_invoice_id     = '<STRIPE_INVOICE_ID_2>',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 392000,
    hosted_invoice_url    = '<HOSTED_URL_2>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = '<INVOICE_ID_2>'
  and stripe_invoice_id is null;

update public.invoices
set stripe_invoice_id     = '<STRIPE_INVOICE_ID_3>',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 302500,
    hosted_invoice_url    = '<HOSTED_URL_3>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = '<INVOICE_ID_3>'
  and stripe_invoice_id is null;

update public.invoices
set stripe_invoice_id     = '<STRIPE_INVOICE_ID_4>',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 198280,
    hosted_invoice_url    = '<HOSTED_URL_4>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = '<INVOICE_ID_4>'
  and stripe_invoice_id is null;
--
-- ACTUAL OUTPUTS (paste from Dashboard):
-- <PASTE_STAMP_OUTPUTS — expected: 4 × "1 row affected">

-- --- 2) orders.invoice_id backfill as run (after the stamps, same session) ---
update public.orders o
set invoice_id = i.id,
    updated_at = now()
from public.invoices i
where i.order_id = o.id
  and i.organization_id = '<SEARS_MELVIN_ORG_ID>'
  and i.id in ('<INVOICE_ID_1>', '<INVOICE_ID_2>', '<INVOICE_ID_3>', '<INVOICE_ID_4>')
  and o.invoice_id is null;        -- guard: only unlinked orders
--
-- ACTUAL OUTPUT (paste from Dashboard):
-- <PASTE_BACKFILL_OUTPUT — expected 4 rows affected>

-- --- 3) Read-back as run -----------------------------------------------------
-- select i.id, i.invoice_number, i.amount, i.stripe_invoice_id,
--        i.stripe_credential_mode, i.stripe_invoice_status,
--        i.amount_paid, i.amount_remaining, o.id as order_id, o.invoice_id
-- from public.invoices i
-- join public.orders o on o.invoice_id = i.id
-- where i.organization_id = '<SEARS_MELVIN_ORG_ID>'
--   and i.id in ('<INVOICE_ID_1>', '<INVOICE_ID_2>', '<INVOICE_ID_3>', '<INVOICE_ID_4>');
--
-- ACTUAL OUTPUT (paste from Dashboard):
-- <PASTE_READBACK_OUTPUT — expected 4 rows, fully stamped + linked>
--
-- Post-apply verification (app): expanding each of the four invoices in
-- InvoiceWorkspace produced NO write — updated_at unchanged on re-read
-- (guards 1+2 in ExpandedInvoiceOrders + ensureStripeInvoice id-skip).
