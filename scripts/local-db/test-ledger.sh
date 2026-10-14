#!/usr/bin/env bash
# Ledger DB tests on a LOCAL Postgres (never a hosted project).
set -euo pipefail
DB="${1:-mason_ledger_test}"
case "${PGHOST:-localhost}" in *supabase*) echo "Refusing: PGHOST points at Supabase" >&2; exit 1;; esac
T=supabase/tests/ledger
scripts/local-db/build.sh "$DB" supabase/migrations/20261014120000_payments_ledger.sql supabase/migrations/20261014120050_revolut_connections_disabled.sql >/dev/null
run() { if ! out=$(psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" 2>&1); then echo "$out" | grep -E 'ok -|FAIL|ERROR' ; exit 1; fi; echo "$out" | grep -oE 'ok - .*'; }
run $T/00_seed_legacy.sql
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/20261014120100_payments_ledger_backfill_freeze.sql >/dev/null 2>&1 || { echo "FAIL backfill migration"; exit 1; }
run $T/10_ledger.sql
run $T/20_rls.sql
run $T/30_invoice_e2e.sql
run $T/40_decisions.sql
echo "ledger DB tests passed"
