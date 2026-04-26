-- Pin search_path on functions flagged by the 2026-04-26 audit
-- (lint 0011_function_search_path_mutable). Setting search_path = public
-- prevents search-path injection attacks.
--
-- Uses a DO block with pg_proc lookup so the migration is signature-agnostic
-- and handles any overloaded variants.

DO $$
DECLARE
  fn record;
  target_names text[] := ARRAY[
    'set_updated_at',
    'jsonb_diff_rows',
    'activity_log_write',
    'log_activity_generic'
  ];
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(target_names)
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      fn.schema_name, fn.function_name, fn.args
    );
  END LOOP;
END $$;
