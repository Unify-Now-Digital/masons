-- 20260810_people_created_via.sql
-- Forward-only record: applied via Dashboard SQL editor 10 Aug 2026.
--
-- Adds origin tracking for FR-4 (customer creation on ingest — spec at
-- specs/customer-creation-on-ingest/spec.md, plan step B5). Single
-- writer initially ('inbox_ingest' from attemptAutoLink); no value
-- CHECK constraint until a second writer exists (FR-6 assisted create
-- → 'inbox_assisted' is the natural moment to add one).
--
-- Read-back at apply time (col_description; non-null result also
-- proves the column exists — the ordinal_position subquery only
-- resolves against a live column):
--   [
--     {
--       "col_description": "Origin of the row: inbox_ingest =
--        auto-created by attemptAutoLink; null = pre-feature or
--        manual."
--     }
--   ]

ALTER TABLE people
ADD COLUMN created_via text;

COMMENT ON COLUMN people.created_via IS
  'Origin of the row: inbox_ingest = auto-created by attemptAutoLink; null = pre-feature or manual.';