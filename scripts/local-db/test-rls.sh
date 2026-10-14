#!/usr/bin/env bash
# RLS hardening tests on a LOCAL Postgres (never a hosted project).
# Builds snapshot + ledger migrations, seeds, applies all RLS migrations, then re-runs the
# ledger suites (to prove nothing regressed) and the RLS suite.
set -euo pipefail
DB="${1:-mason_rls_test}"
case "${PGHOST:-localhost}" in *supabase*) echo "Refusing: PGHOST points at Supabase" >&2; exit 1;; esac
scripts/local-db/build.sh "$DB" supabase/migrations/20261014120000_payments_ledger.sql supabase/migrations/20261014120050_revolut_connections_disabled.sql >/dev/null
run() { if ! out=$(psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" 2>&1); then echo "$out" | grep -E 'ok -|FAIL|ERROR' ; exit 1; fi; echo "$out" | grep -oE 'ok - .*'; }
apply() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null 2>/tmp/rls_mig.err || { echo "FAIL $1"; grep -v NOTICE /tmp/rls_mig.err | tail -5; exit 1; }; }
run supabase/tests/ledger/00_seed_legacy.sql
apply supabase/migrations/20261014120100_payments_ledger_backfill_freeze.sql
for f in supabase/migrations/20261014130*_rls_*.sql; do apply "$f"; done
# idempotency: re-apply all RLS migrations
for f in supabase/migrations/20261014130*_rls_*.sql; do apply "$f"; done
run supabase/tests/ledger/10_ledger.sql
run supabase/tests/ledger/20_rls.sql
run supabase/tests/ledger/30_invoice_e2e.sql
run supabase/tests/ledger/40_decisions.sql
run supabase/tests/rls/10_hardening.sql
echo "RLS + ledger DB tests passed"
