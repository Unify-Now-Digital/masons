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
-- select i.id, i.invoice_number, i.customer_name, i.amount, i.order_id,
--        o.value as order_value
-- from public.invoices i
-- join public.orders o on o.id = i.order_id
-- where i.organization_id = '<SEARS_MELVIN_ORG_ID>'
--   and i.id in ('<INVOICE_ID_1>', '<INVOICE_ID_2>', '<INVOICE_ID_3>', '<INVOICE_ID_4>')
--   and i.amount = 0;
--
-- ACTUAL OUTPUT (paste from Dashboard):
-- <PASTE_DRY_RUN_OUTPUT — expected 4 rows, order_value = 4713.40 / 3920.00 /
--  3025.00 / 1982.80>

-- --- 2) Restore UPDATE as run ------------------------------------------------
update public.invoices i
set amount = o.value,
    updated_at = now()
from public.orders o
where o.id = i.order_id
  and i.organization_id = '<SEARS_MELVIN_ORG_ID>'
  and i.id in ('<INVOICE_ID_1>', '<INVOICE_ID_2>', '<INVOICE_ID_3>', '<INVOICE_ID_4>')
  and i.amount = 0;              -- guard: only rows still zeroed by the bug
-- returning i.id, i.invoice_number, i.amount;
--
-- ACTUAL RETURNING OUTPUT (paste from Dashboard):
-- <PASTE_RETURNING_OUTPUT — expected 4 rows with restored amounts>
-- Rows affected: <PASTE_ROW_COUNT — expected 4>

-- --- 3) Read-back SELECT as run ---------------------------------------------
-- select id, invoice_number, amount
-- from public.invoices
-- where organization_id = '<SEARS_MELVIN_ORG_ID>'
--   and id in ('<INVOICE_ID_1>', '<INVOICE_ID_2>', '<INVOICE_ID_3>', '<INVOICE_ID_4>');
--
-- ACTUAL OUTPUT (paste from Dashboard):
-- <PASTE_READBACK_OUTPUT — expected amounts 4713.40 / 3920.00 / 3025.00 /
--  1982.80, zero rows remaining with amount = 0>
