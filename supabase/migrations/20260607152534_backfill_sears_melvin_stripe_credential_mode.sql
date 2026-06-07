-- 012-per-org-stripe: backfill stripe_credential_mode for Sears Melvin's live invoices.
--
-- CONTEXT
--   The 012 per-org Stripe work added invoices.stripe_credential_mode, stamped at session/
--   invoice creation so reconciliation can act on an invoice in the mode it was created in
--   (freeze-in-flight). All invoices that predate the refactor have it NULL, which the
--   refactored edge functions treat as "unknown account" and refuse (409) or skip.
--
--   At backfill time only ONE org had live, non-deleted Stripe-linked invoices: Sears Melvin
--   (3770972d-1bbd-417b-b413-297e844db285). Churchill had zero Stripe-linked invoices, so its
--   first invoice is born correctly stamped by the refactored create function — no backfill.
--   All other Stripe-linked rows were null-org dev-era artifacts (mostly soft-deleted), out of
--   scope here. One null-org open invoice (INV-000076, £795) is a separate orphan investigation.
--
-- SCOPE / SAFETY
--   - Sears Melvin only.
--   - Unstamped rows only (stripe_credential_mode IS NULL) -> idempotent: re-running stamps nothing.
--   - NOT soft-deleted (deleted_at IS NULL) -> the deleted, paid INV-000080 is deliberately left
--     NULL; no function will ever act on it.
--   Expected rows affected: 2 -> INV-000081 (open, £5050) and INV-000082 (paid, £4325).
--
-- PRECONDITION (verified before applying):
--   The two Stripe invoice IDs exist in Sears Melvin's LIVE Stripe account:
--     INV-000081 -> in_1TYZzx...   INV-000082 -> in_1TYa4k...
--   Stamping 'live' asserts these live in the live account; a wrong stamp is a cross-account hazard.
--
-- APPLIED MANUALLY via Supabase SQL editor (per migration discipline; not via db push).
-- This file records that change so the committed state matches the database.

UPDATE public.invoices
SET stripe_credential_mode = 'live',
    updated_at = now()
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND stripe_invoice_id IS NOT NULL
  AND stripe_credential_mode IS NULL
  AND deleted_at IS NULL;

-- POST-APPLY READ-BACK (expected: INV-000081 + INV-000082 = 'live'; INV-000080 = NULL, deleted):
--   SELECT invoice_number, stripe_invoice_status, stripe_credential_mode,
--          (deleted_at IS NOT NULL) AS is_deleted
--   FROM public.invoices
--   WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
--     AND stripe_invoice_id IS NOT NULL
--   ORDER BY is_deleted, invoice_number;