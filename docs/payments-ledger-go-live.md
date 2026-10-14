# Payments ledger — go-live plan

Nothing here has been run against a hosted Supabase project. All migrations were tested on a
local Postgres 17 built from a schema-only snapshot of production (`scripts/local-db/`).
**Every production step below needs Arin's explicit approval before it is run.**

## Test locally
```
scripts/local-db/test-ledger.sh          # builds a local DB, seeds legacy rows, runs the migrations + assertions
scripts/local-db/test-rls.sh             # (RLS PR) ledger suites again + RLS hardening suite on top
(cd supabase/functions/_shared && deno test ledger_test.ts)
npm run gate
```

## Decisions applied (Arin, 14 Oct 2026)
1. **Stripe is the source of truth** for the two mismatched invoices (INV-000073, INV-000075:
   Mason amount £0, Stripe total £1,855 / £795). The backfill sets their total from Stripe and
   writes an `invoice_total_from_stripe` row to `payment_audit_log`. Other differences
   (INV-000074 unpaid; INV-000133 where Stripe holds a £1 test amount) are left alone.
2. **Labelled stand-in payments** for invoices marked paid with no payment row: source `manual`,
   payer "Stand-in (no payment recorded)", `matched_by = backfill:stand-in`, flagged
   `needs_review` so someone can replace it with the real payment.
3. **Revolut built but disabled**: `20261014120050_revolut_connections_disabled.sql` creates
   `revolut_connections` (tokens service-role only) and `app_feature_flags.revolut_ledger = false`.
   All Revolut edge functions return "disabled" while the flag is off. Nothing is scheduled.
5. **No score-based auto-match**. Only a Stripe link or an INV/ORD reference auto-confirms;
   amount/name/date scores only create suggestions, at any score; a finance user confirms.
7. **Revolut reversal of a matched payment**: the match stays, the payment is flagged for review,
   and a negative `refund` row (`<external_id>:reversal`) mirrors its allocations, so the invoice
   balance goes back up. A finance user clears the flag with "Mark checked" (audited).

## Order (each step needs Arin's approval)
0. **RLS PR, Stripe-config fix** (`20261014130000_rls_stripe_config_admin_only.sql`, from the
   RLS hardening PR). Independent of the ledger and can go first, on its own, as the urgent fix.
1. **Back up** (PITR point or `pg_dump` of `invoices`, `order_payments`, `invoice_payments`,
   `payments`, `organization_stripe_config`, `cemeter*`).
2. **SM website check**: `SearsMelvin/functions/api/stripe-webhook.js` still POSTs to
   `public.payments` with the 2025 columns (`invoice_id, amount, date…`). After step 3 that name
   is the ledger table, so those inserts will fail (they are logged, and the legacy table has
   0 rows in prod, so nothing is lost today). Point it at `ledger_ingest_payment` or remove it
   before or with step 3.
3. **Migration 1** `20261014120000_payments_ledger.sql`: expand only. Renames the empty legacy
   `public.payments` to `payments_legacy_2025`, adds `invoices.total_pence`, creates the ledger
   tables, RPCs, RLS, `invoice_balances`, the raw-payload purge cron, and rewrites
   `orders_with_balance.amount_paid` from allocations.
4. **Migration 1b** `20261014120050_revolut_connections_disabled.sql`: Revolut table + flag (off).
5. **Deploy edge functions** `stripe-webhook`, `revolut-webhook`, `revolut-sync-transactions`,
   `revolut-oauth-start`, `revolut-oauth-callback`, `revolut-token-refresh`. Revolut ones are
   no-ops while the flag is off.
6. **Migration 2** `20261014120100_payments_ledger_backfill_freeze.sql`: Stripe totals for
   INV-000073/075, backfill (Stripe de-duplicated, pounds→pence), stand-ins, re-derive invoice
   paid/remaining/status, freeze the old tables. Check `ledger_backfill_diff` and the function's
   JSON counts after.
7. **RLS PR, remaining migrations** `20261014130100` … `20261014130400` (finance roles, revoke
   anon, policies for the policy-less tables, cemeteries per org). `20261014130500` (SM public
   cemetery read) is optional and separate.
8. **Deploy the web app** from the merged branch.
9. **Smoke test** as admin, member and staff (Finance › Payments, Invoicing, Orders, Cemeteries),
   and the SM site pages (home, memorials, memorial quote form, permit checker).
10. **Later, separate approval:** turn on `revolut_ledger` only after a direct Revolut Business
    connection exists; then register the webhook URL
    `.../revolut-webhook?connection=<revolut_connections.id>`.
11. **Later, separate PR ("contract")**: drop `invoices.amount` (or make it generated from
    `total_pence`), drop the sync trigger, drop the old payment tables after one release.

Steps 3→6 should run in one maintenance window: between 3 and 5 the old functions still write
legacy rows; migration 2 backfills those too, so no payment is lost if 5 is delayed.
