-- Copy Churchill's permit-forms library to Sears Melvin.
--
-- CONTEXT
--   Sears Melvin needed Churchill's full nationwide permit-forms library (it had
--   only 5 locally created forms). Copied each distinct form (by name) with a fresh
--   uuid and organization_id re-pointed at Sears Melvin. cemetery_id and
--   google_drive_file_id were NULL on all 177 source rows, so they are not part of
--   the copy.
--
-- APPLIED 2026-07-20 via the Supabase Dashboard SQL editor (per migration
-- discipline; not via db push). This file records that change so committed state
-- matches the database. NOTE: the statement as applied was the bare
-- INSERT ... SELECT below WITHOUT the "WHERE NOT EXISTS" guard; the guard is added
-- in this file so a replay against a database already containing the 2026-07-20
-- batch is a no-op (no double-copy).
--
-- EVIDENCE (verified outputs recorded at apply time)
--
--   Dry-run count (SELECT form of the INSERT, pre-apply): 176
--     Source had 177 rows; DISTINCT ON (name) removed 1 duplicate name:
--     "Rutland (Oakham) Memorial Application.pdf".
--
--   Post-apply batch read-back — one batch, 176 rows, single timestamp:
--     SELECT created_at, count(*) FROM public.permit_forms
--     WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
--     GROUP BY created_at ORDER BY count(*) DESC;
--     -> all 176 inserted rows: created_at = 2026-07-20 21:40:13.984645+00
--
--   Post-apply org counts:
--     SELECT organization_id, count(*) FROM public.permit_forms
--     GROUP BY organization_id;
--     -> [{ "organization_id": "a05ee759-c096-49d8-bebe-fb326b9ba9bc", "count": 177 },
--         { "organization_id": "3770972d-1bbd-417b-b413-297e844db285", "count": 181 }]
--     Churchill (source) untouched at 177. Sears Melvin totals 181: the 176-row copy
--     batch above plus Sears Melvin's original 5 hand-created forms (created_at
--     2026-04-23 14:55:15 — the Edmonton / Great Northern / New Southgate /
--     Southgate / Tottenham set, verified in the pre-copy inventory), which do not
--     carry the batch timestamp and are outside this migration's scope.
--
-- ROLLBACK (targets exactly the inserted batch via its single created_at; leaves
-- the 5 non-batch Sears Melvin rows in place):
--   DELETE FROM public.permit_forms
--   WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
--     AND created_at = '2026-07-20 21:40:13.984645+00';

INSERT INTO public.permit_forms (id, name, link, note, organization_id, created_at, updated_at)
SELECT gen_random_uuid(), name, link, note,
       '3770972d-1bbd-417b-b413-297e844db285', now(), now()
FROM (
  SELECT DISTINCT ON (name) name, link, note
  FROM public.permit_forms
  WHERE organization_id = 'a05ee759-c096-49d8-bebe-fb326b9ba9bc'
  ORDER BY name, created_at
) t
WHERE NOT EXISTS (
  SELECT 1 FROM public.permit_forms
  WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    AND created_at = '2026-07-20 21:40:13.984645+00'
);
