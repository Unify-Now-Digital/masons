#!/usr/bin/env bash
# Build a LOCAL Postgres test DB: Supabase shim + prod schema snapshot + new migrations.
# Usage: scripts/local-db/build.sh [dbname] [migration files...]   LOCAL ONLY.
set -euo pipefail
DB="${1:-mason_local}"; shift || true
case "${PGHOST:-localhost}" in *supabase*) echo "Refusing: PGHOST points at Supabase" >&2; exit 1;; esac
here="$(cd "$(dirname "$0")" && pwd)"
dropdb --if-exists "$DB" && createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$here/supabase-shim.sql" >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$here/prod-schema-2026-10-14.sql" >/dev/null
files=("$@")
if [ ${#files[@]} -eq 0 ]; then files=(supabase/migrations/20261014120000_payments_ledger.sql supabase/migrations/20261014120050_revolut_connections_disabled.sql supabase/migrations/20261014120100_payments_ledger_backfill_freeze.sql); fi
for f in "${files[@]}"; do
  if ! out=$(psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1); then echo "FAIL $f"; echo "$out" | grep -v NOTICE | tail -5; exit 1; fi
done
echo "built $DB"
