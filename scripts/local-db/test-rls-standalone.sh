#!/usr/bin/env bash
# RLS hardening WITHOUT the payments ledger (PR #35). LOCAL Postgres only.
set -euo pipefail
DB="${1:-mason_rls_standalone}"
case "${PGHOST:-localhost}" in *supabase*) echo "Refusing: PGHOST points at Supabase" >&2; exit 1;; esac
scripts/local-db/build.sh "$DB" supabase/migrations/20261014130000_rls_stripe_config_admin_only.sql >/dev/null
run() { if ! out=$(psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" 2>&1); then echo "$out" | grep -E 'ok -|FAIL|ERROR' ; exit 1; fi; echo "$out" | grep -oE 'ok - .*' || true; }
apply() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null 2>/tmp/rls_mig.err || { echo "FAIL $1"; grep -v NOTICE /tmp/rls_mig.err | tail -5; exit 1; }; }
run supabase/tests/rls/00_seed.sql
for pass in 1 2; do for f in supabase/migrations/20261014130*_rls_*.sql; do apply "$f"; done; done
run supabase/tests/rls/10_hardening.sql
echo "standalone RLS tests passed"
