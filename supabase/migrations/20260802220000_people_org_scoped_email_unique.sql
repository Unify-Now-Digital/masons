-- ============================================================================
-- people: replace GLOBAL email uniqueness with org-scoped uniqueness
--
-- RECORD of an already-applied migration. Applied 02 Aug 2026 by Giorgi in the
-- Supabase Dashboard SQL editor, statement by statement. This file is the
-- record of truth only — do NOT db-push / re-run it.
--
-- Why: the global unique constraint people_email_key made a person's email
-- unique across ALL orgs, so an SM person insert 23505'd whenever the same
-- email existed in Churchill (hit live in the sidebar S5 flow, 02 Aug 2026 —
-- see specs/sidebar-order-invoice-from-conversation/verification-evidence.md
-- AC-6). Multi-tenant correctness requires uniqueness per (organization_id,
-- lower(email)).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) Preflight: no duplicate (organization_id, lower(email)) pairs that would
--     block the new unique index.
--
--   SELECT organization_id, lower(email) AS email_lower, count(*)
--   FROM people
--   WHERE email IS NOT NULL
--   GROUP BY organization_id, lower(email)
--   HAVING count(*) > 1;
--
-- EVIDENCE (actual output): 0 rows.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- (2) Pre-state: confirm people_email_key is a UNIQUE constraint (not a bare
--     index), so it must be dropped via ALTER TABLE ... DROP CONSTRAINT.
--
--   SELECT conname, contype
--   FROM pg_constraint
--   WHERE conrelid = 'public.people'::regclass AND conname = 'people_email_key';
--
-- EVIDENCE (actual output): people_email_key | u
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- (3) Create the org-scoped unique index FIRST (so there is no window with no
--     uniqueness at all). Partial: NULL emails stay non-unique.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX people_org_email_key
  ON people (organization_id, lower(email))
  WHERE email IS NOT NULL;

-- ----------------------------------------------------------------------------
-- (4) Drop the global unique constraint. Dropping the constraint removed its
--     backing index automatically; the defensive DROP INDEX branch that
--     followed errored with 42704 (undefined_object) AS EXPECTED and was a
--     no-op — recorded here for completeness, not a failure.
-- ----------------------------------------------------------------------------
ALTER TABLE people DROP CONSTRAINT people_email_key;

--   DROP INDEX people_email_key;
-- EVIDENCE (actual output): ERROR 42704 (undefined_object) — index already
-- gone with the constraint, as expected.

-- ----------------------------------------------------------------------------
-- (5) Post-state: index inventory on people(email).
--
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'people' AND indexdef ILIKE '%email%';
--
-- EVIDENCE (actual output):
--   people_org_email_key   — UNIQUE (organization_id, lower(email)) WHERE email IS NOT NULL
--   people_email_lower_idx — pre-existing plain lookup index, kept
--   idx_people_email       — pre-existing plain lookup index, kept
-- people_email_key no longer present.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- (6) Functional proof: an email that exists in Churchill inserted into SM
--     successfully (the exact collision that 23505'd before this migration),
--     then the test row was deleted.
--
--   INSERT INTO people (organization_id, first_name, last_name, email)
--   VALUES ('3770972d-1bbd-417b-b413-297e844db285', '<test>', '', '<churchill-colliding email>')
--   RETURNING id;
--
-- EVIDENCE (actual output): id 4a252ab4-… — insert succeeded.
--
--   DELETE FROM people
--   WHERE id = '4a252ab4-…'
--     AND organization_id = '3770972d-1bbd-417b-b413-297e844db285';
--
-- EVIDENCE: test row deleted (1 row).
-- ----------------------------------------------------------------------------

-- Follow-ups unlocked by this migration (tracked outside this file):
-- - Re-verify sidebar S5 email-handle case (verification-evidence.md AC-6 note).
-- - The 23505-specific toast in PersonOrdersPanel's catch ("known limitation
--   pending a database fix") is now stale for this scenario — candidate for
--   removal/reword in a future commit.
-- - people_email_lower_idx / idx_people_email look redundant with each other —
--   left untouched here (one concern per migration); consolidation is backlog.
