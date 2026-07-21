-- Data fix: 2 conversations had link_state='linked' with person_id IS NULL
-- (Ofcom reserved test numbers +44 7700 900003 / +44 7700 900005,
-- WhatsApp channel, seeded test data from April 2026).
-- Applied via Dashboard SQL editor 2026-07-21.
--
-- Dry-run SELECT returned exactly 2 rows (both linked, null person_id).
-- Post-apply verify:
--   SELECT COUNT(*) FROM inbox_conversations
--   WHERE link_state = 'linked' AND person_id IS NULL;
--   => remaining_inconsistent = 0
--
-- Note: first attempt included SET link_meta = NULL and failed on a
-- NOT NULL constraint — link_meta's empty state is '{}'::jsonb, not NULL.
-- The failed statement was atomic; no partial write occurred.

UPDATE inbox_conversations
SET link_state = 'unlinked'
WHERE id IN (
  'c186ec4a-d9f5-40f1-b7bc-093e1c2986c2',
  '8f210cc9-be6c-4b9c-8c1f-f9f5e62e0684'
)
AND organization_id = '3770972d-1bbd-417b-b413-297e844db285'
AND link_state = 'linked'
AND person_id IS NULL;