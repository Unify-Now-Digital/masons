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
-- Conventions: the org UUID stays a placeholder permanently (real value in
-- CLAUDE.local.md, never in tracked files); hosted_invoice_url values are
-- deliberately redacted — they are live payment links.
-- =============================================================================

-- --- 1) Stamp UPDATEs as run (one per invoice; explicit single-row targets;
--        each ran with: returning id, invoice_number, amount, stripe_invoice_id,
--        amount_remaining) --------------------------------------------------

-- Stamp 1 — Andrew Younger, £4713.40
update public.invoices
set stripe_invoice_id     = 'in_1TTk04P7PyojXUvIyRqktrAt',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 471340,
    hosted_invoice_url    = '<REDACTED — live payment link>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = 'd4576ba1-7f8d-47e3-a0ff-7a5af01278f3'
  and stripe_invoice_id is null;   -- guard: never overwrite an existing link

-- Stamp 2 — samantha jalloh, £3920.00
update public.invoices
set stripe_invoice_id     = 'in_1TXhF3P7PyojXUvIKNO4Acbw',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 392000,
    hosted_invoice_url    = '<REDACTED — live payment link>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = '8ca56816-01a3-4d69-b757-a485b230687f'
  and stripe_invoice_id is null;

-- Stamp 3 — Geraldine Canton, £3025.00
update public.invoices
set stripe_invoice_id     = 'in_1TXhvFP7PyojXUvIidoLjEf4',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 302500,
    hosted_invoice_url    = '<REDACTED — live payment link>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = '0b759282-a538-47ae-a290-7ee2e4aa5c95'
  and stripe_invoice_id is null;

-- Stamp 4 — Anne Marshall, £1982.80
update public.invoices
set stripe_invoice_id     = 'in_1TYmk5P7PyojXUvIs7CRLGwd',
    stripe_credential_mode = 'live',
    stripe_invoice_status = 'open',
    amount_paid           = 0,
    amount_remaining      = 198280,
    hosted_invoice_url    = '<REDACTED — live payment link>',
    updated_at            = now()
where organization_id = '<SEARS_MELVIN_ORG_ID>'
  and id = 'cec2e09f-c4f2-4a7c-8903-af615f85da21'
  and stripe_invoice_id is null;
--
-- ACTUAL OUTPUTS (Dashboard):
--   Stamp 1 (Andrew): RETURNING displayed no rows in the Dashboard, but a
--     follow-up SELECT confirmed the write landed — stripe_invoice_id
--     in_1TTk04P7PyojXUvIyRqktrAt, mode live, remaining 471340,
--     hosted_invoice_url present. (Dashboard RETURNING display quirk;
--     verified by read, not by the returned output.)
--   Stamp 2 (samantha): 1 row — 8ca56816… | INV-WEB-MP8BH4MS-71XYJV |
--     3920.00 | in_1TXhF3P7PyojXUvIKNO4Acbw | 392000
--   Stamp 3 (Geraldine): 1 row — 0b759282… | INV-WEB-MP8D1774-TKQ3OA |
--     3025.00 | in_1TXhvFP7PyojXUvIidoLjEf4 | 302500
--   Stamp 4 (Anne): 1 row — cec2e09f… | INV-WEB-MPCLYI1D-V0YIRI |
--     1982.80 | in_1TYmk5P7PyojXUvIs7CRLGwd | 198280

-- --- 2) orders.invoice_id backfill as run (after the stamps, same session) ---
-- Ran as FOUR separate single-row UPDATEs against orders, each guarded
-- invoice_id IS NULL, each with its own RETURNING (id, invoice_id).

update public.orders
set invoice_id = 'd4576ba1-7f8d-47e3-a0ff-7a5af01278f3',   -- Andrew Younger
    updated_at = now()
where id = '1834d374-f2f4-4d3a-85d1-ed4524fd191f'
  and invoice_id is null;          -- guard: only an unlinked order

update public.orders
set invoice_id = '8ca56816-01a3-4d69-b757-a485b230687f',   -- samantha jalloh
    updated_at = now()
where id = '10f03a45-dc4c-4a47-b3e4-8b0bd23183e9'
  and invoice_id is null;

update public.orders
set invoice_id = '0b759282-a538-47ae-a290-7ee2e4aa5c95',   -- Geraldine Canton
    updated_at = now()
where id = 'f65004b6-879f-42f4-a8d5-de24beeb92c5'
  and invoice_id is null;

update public.orders
set invoice_id = 'cec2e09f-c4f2-4a7c-8903-af615f85da21',   -- Anne Marshall
    updated_at = now()
where id = '03822c8c-fa47-4584-82e4-44d1b28615ec'
  and invoice_id is null;
--
-- ACTUAL OUTPUT (Dashboard, 4 × 1 row):
--   1834d374-f2f4-4d3a-85d1-ed4524fd191f -> d4576ba1-… | 4713.40
--   10f03a45-dc4c-4a47-b3e4-8b0bd23183e9 -> 8ca56816-… | 3920.00
--   f65004b6-879f-42f4-a8d5-de24beeb92c5 -> 0b759282-… | 3025.00
--   03822c8c-fa47-4584-82e4-44d1b28615ec -> cec2e09f-… | 1982.80

-- --- 3) Read-back as run -----------------------------------------------------
-- select i.invoice_number, i.stripe_invoice_id, i.stripe_credential_mode,
--        i.stripe_invoice_status, i.amount_paid, i.amount_remaining,
--        (i.hosted_invoice_url is not null) as has_url
-- from public.invoices i
-- where i.organization_id = '<SEARS_MELVIN_ORG_ID>'
--   and i.id in ('d4576ba1-7f8d-47e3-a0ff-7a5af01278f3', '8ca56816-01a3-4d69-b757-a485b230687f',
--                '0b759282-a538-47ae-a290-7ee2e4aa5c95', 'cec2e09f-c4f2-4a7c-8903-af615f85da21');
--
-- ACTUAL OUTPUT (Dashboard, 4 rows, all stamped):
--   INV-WEB-MP8BH4MS-71XYJV | in_1TXhF3P7PyojXUvIKNO4Acbw | live | open | paid 0 | remaining 392000 | has_url true
--   INV-WEB-MP8D1774-TKQ3OA | in_1TXhvFP7PyojXUvIidoLjEf4 | live | open | paid 0 | remaining 302500 | has_url true
--   INV-WEB-MOSQ7L1X-BHBV7O | in_1TTk04P7PyojXUvIyRqktrAt | live | open | paid 0 | remaining 471340 | has_url true
--   INV-WEB-MPCLYI1D-V0YIRI | in_1TYmk5P7PyojXUvIs7CRLGwd | live | open | paid 0 | remaining 198280 | has_url true
--
-- Post-apply verification (app): expanding each of the four invoices in
-- InvoiceWorkspace produced NO write — updated_at unchanged on re-read
-- (guards 1+2 in ExpandedInvoiceOrders + ensureStripeInvoice id-skip).
