# Payments ledger — go-live plan

Nothing here has been run against a hosted Supabase project. All migrations were tested on a
local Postgres 17 built from a schema-only snapshot of production (`scripts/local-db/`).

## Test locally
```
scripts/local-db/test-ledger.sh          # builds a local DB, seeds legacy rows, runs both migrations + assertions
(cd supabase/functions/_shared && deno test ledger_test.ts)
npm run gate
```

## Order (needs Arin's approval at each step)
1. **Back up** (PITR point or `pg_dump` of `invoices`, `order_payments`, `invoice_payments`, `payments`).
2. **Migration 1** `20261014120000_payments_ledger.sql` — expand only: renames the empty legacy
   `public.payments` to `payments_legacy_2025`, adds `invoices.total_pence` (backfilled, kept in
   sync with `amount` by trigger), creates the ledger tables, RPCs, RLS, `invoice_balances`,
   raw-payload purge cron, and rewrites `orders_with_balance.amount_paid` from allocations.
   Old tables still written by the old functions at this point.
3. **Deploy edge functions** `stripe-webhook`, `revolut-webhook`, `revolut-sync-transactions`
   (they now write only to the ledger). Revolut webhook URL becomes
   `.../revolut-webhook?connection=<revolut_connections.id>`.
   `revolut_connections` does not exist in prod today — create/repair it first (open question).
4. **Migration 2** `20261014120100_payments_ledger_backfill_freeze.sql` — copies
   `invoice_payments` (paid) and `order_payments` into the ledger (Stripe de-duplicated on
   charge / payment intent; pounds→pence), adds labelled manual rows for invoices that were
   marked paid with no payment row, re-derives invoice paid/remaining/status, then freezes the
   old tables (trigger + revoked writes; not dropped). Check `ledger_backfill_diff` after.
5. **Deploy the web app** from this branch.
6. Later (separate PR, "contract"): drop `invoices.amount` (or make it a generated column from
   `total_pence`), drop the sync trigger, drop the old payment tables after one release.

Steps 2→4 should run in one maintenance window: between 2 and 3 the old functions still write
legacy rows; migration 2 backfills those too, so no payment is lost if 3 is delayed.
