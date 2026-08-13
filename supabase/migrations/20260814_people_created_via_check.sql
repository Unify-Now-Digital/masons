-- 20260814_people_created_via_check.sql
-- Forward-only record: applied via Dashboard SQL editor 14 Aug 2026 by Giorgi.
-- Do NOT db-push / re-run.
--
-- FR-B1 of assisted-contact-creation-and-backfill (Commit C): enforce the
-- created_via vocabulary now that a second writer exists ('inbox_assisted',
-- the assisted-create dialog). The 20260810_people_created_via.sql migration
-- explicitly deferred this constraint to that moment.
--
-- Writer audit backing this constraint (FR-B3, final, 14 Aug 2026 — full
-- table in specs/assisted-contact-creation-and-backfill/tasks.md T014):
--   1. attemptAutoLink            → 'inbox_ingest'   (live since Commit B)
--   2. createCustomer (3 entries) → 'inbox_assisted' | 'manual' (Commit C1)
--   3. resolvePersonId            → 'manual'          (Commit C1)
--   4. create_quote (live DB fn, SM website quote flow, no repo trace)
--      → conscious-NULL. NULL stays legal BY DESIGN — this constraint must
--      not break the live website order path; stamping create_quote is
--      deferred pending Arin coordination (see tasks.md Backlog, which also
--      records its unscoped email dedupe as a high-priority finding).
--
-- NOT VALID + VALIDATE as two statements: the Dashboard auto-commits per
-- statement, and VALIDATE takes only SHARE UPDATE EXCLUSIVE, so the scan of
-- existing rows never blocks live writes.
--
-- ----------------------------------------------------------------------------
-- (1) Precondition: every existing non-NULL value is already in-vocabulary.
--
--   select created_via, count(*) from people group by 1 order by 1;
--
-- EVIDENCE (actual output, 14 Aug 2026):
--   inbox_ingest | 1
--   NULL         | 67
--   (no other values — 'inbox_assisted'/'manual' absent as expected: T012's
--    fixtures were torn down and no manual create has run since Commit C1)
-- ----------------------------------------------------------------------------

alter table people
  add constraint people_created_via_allowed
  check (created_via is null
         or created_via in ('inbox_ingest', 'inbox_assisted', 'manual'))
  not valid;

alter table people validate constraint people_created_via_allowed;

-- ----------------------------------------------------------------------------
-- (2) Read-back: constraint exists and validated over all legacy rows
--     (VALIDATE succeeding over the existing NULL rows IS the NULL-legality
--     proof — no positive insert probe needed on the live org).
--
--   select conname, convalidated
--   from pg_constraint
--   where conrelid = 'public.people'::regclass
--     and conname = 'people_created_via_allowed';
--
-- EVIDENCE (actual output, 14 Aug 2026):
--   people_created_via_allowed | convalidated = true
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- (3) Negative probe: out-of-vocabulary value is rejected. Safe on the live
--     org — the INSERT FAILS, so nothing persists (Dashboard auto-commit
--     commits nothing on error).
--
--   insert into people (organization_id, first_name, last_name, created_via)
--   values ('<SM org uuid>', 'constraint', 'probe', 'bogus');
--
-- EVIDENCE (actual output, 14 Aug 2026):
--   ERROR 23514 new row for relation "people" violates check constraint
--   "people_created_via_allowed" — DETAIL shows created_via='bogus';
--   nothing persisted (statement failed, auto-commit committed nothing)
-- ----------------------------------------------------------------------------
