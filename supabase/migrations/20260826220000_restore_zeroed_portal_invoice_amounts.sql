-- =============================================================================
-- RECORD OF APPLIED PRODUCTION WRITE — do not re-run.
-- Applied 2026-08-26 by Giorgi via Supabase Dashboard SQL editor (auto-commit,
-- per supabase/CLAUDE.md destructive-statement pattern: dry-run SELECT →
-- id-scoped UPDATE with RETURNING → re-verify SELECT).
--
-- Incident: expanding the orders sub-row in InvoiceWorkspace wrote amount = 0
-- to four live Sears Melvin portal-created invoices (INV-WEB-*). Cause: the
-- ExpandedInvoiceOrders recalc effect recalculated invoice.amount from linked
-- orders unconditionally on first mount; the four rows had no orders reachable
-- via orders.invoice_id, so the empty-set reduce wrote 0. Fixed in commit
-- 3071e84 (guard 1: empty order set never writes) plus the follow-up pence-
-- comparison guard 2 (value-identical writes skipped).
--
-- Restore source of truth: orders.value via invoices.order_id — each of the
-- four invoices carries order_id pointing at a single portal order (no
-- additional options, no permit), whose value equals the original invoice
-- amount. Cross-checked against Stripe: each customer's Stripe invoices
-- (created May 2026, all open, none paid) match these totals exactly — see
-- 20260826221000_link_portal_invoices_to_stripe.sql.
--
-- Restored amounts (GBP pounds): 4713.40, 3920.00, 3025.00, 1982.80.
-- =============================================================================

-- Org guard note: '<SEARS_MELVIN_ORG_ID>' below is a placeholder per the
-- repo convention (real org UUIDs live in CLAUDE.local.md, never in tracked
-- files); the applied statement used the literal UUID.

-- --- 1) Dry-run SELECT as run (confirm exactly the four zeroed rows) ---------
-- select i.id, i.invoice_number, i.amount as current_amount, o.value as intended_amount
-- from public.invoices i
-- join public.orders o on o.id = i.order_id
-- where i.organization_id = '<SEARS_MELVIN_ORG_ID>'
--   and i.id in ('d4576ba1-7f8d-47e3-a0ff-7a5af01278f3', '8ca56816-01a3-4d69-b757-a485b230687f',
--                '0b759282-a538-47ae-a290-7ee2e4aa5c95', 'cec2e09f-c4f2-4a7c-8903-af615f85da21')
--   and i.amount = 0;
--
-- ACTUAL OUTPUT (Dashboard, 4 rows):
--   0b759282-a538-47ae-a290-7ee2e4aa5c95 | INV-WEB-MP8D1774-TKQ3OA | current 0.00 | intended 3025.00
--   8ca56816-01a3-4d69-b757-a485b230687f | INV-WEB-MP8BH4MS-71XYJV | current 0.00 | intended 3920.00
--   cec2e09f-c4f2-4a7c-8903-af615f85da21 | INV-WEB-MPCLYI1D-V0YIRI | current 0.00 | intended 1982.80
--   d4576ba1-7f8d-47e3-a0ff-7a5af01278f3 | INV-WEB-MOSQ7L1X-BHBV7O | current 0.00 | intended 4713.40

-- --- 2) Restore UPDATE as run ------------------------------------------------
update public.invoices i
set amount = o.value,
    updated_at = now()
from public.orders o
where o.id = i.order_id
  and i.organization_id = '<SEARS_MELVIN_ORG_ID>'
  and i.id in ('d4576ba1-7f8d-47e3-a0ff-7a5af01278f3', '8ca56816-01a3-4d69-b757-a485b230687f',
               '0b759282-a538-47ae-a290-7ee2e4aa5c95', 'cec2e09f-c4f2-4a7c-8903-af615f85da21')
  and i.amount = 0;              -- guard: only rows still zeroed by the bug
-- returning i.id, i.invoice_number, i.amount;
--
-- ACTUAL RETURNING OUTPUT (Dashboard, 4 rows):
--   0b759282-a538-47ae-a290-7ee2e4aa5c95 | INV-WEB-MP8D1774-TKQ3OA | 3025.00
--   8ca56816-01a3-4d69-b757-a485b230687f | INV-WEB-MP8BH4MS-71XYJV | 3920.00
--   cec2e09f-c4f2-4a7c-8903-af615f85da21 | INV-WEB-MPCLYI1D-V0YIRI | 1982.80
--   d4576ba1-7f8d-47e3-a0ff-7a5af01278f3 | INV-WEB-MOSQ7L1X-BHBV7O | 4713.40
-- Rows affected: 4

-- --- 3) Read-back SELECT as run ---------------------------------------------
-- select count(*)
-- from public.invoices
-- where organization_id = '<SEARS_MELVIN_ORG_ID>'
--   and deleted_at is null
--   and (amount is null or amount = 0);
--
-- ACTUAL OUTPUT (Dashboard):
--   count of rows with amount IS NULL OR amount = 0 (SM org, deleted_at IS NULL) = 0
