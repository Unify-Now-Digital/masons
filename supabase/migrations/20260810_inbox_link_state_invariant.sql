-- 20260810_inbox_link_state_invariant.sql
-- Forward-only record: applied via Dashboard SQL editor 10 Aug 2026.
--
-- Incident: one inbox_conversations row (GHL web stub) carried
-- link_state='linked' with person_id NULL. Server-side writers only ever
-- write 'unlinked'; the 'linked' writers are frontend
-- (inboxConversations.api.ts linkConversation/linkConversations), where a
-- runtime-undefined personId would be dropped from the PATCH body, flipping
-- link_state without setting person_id. Closed by CHECK constraint below.
--
-- Gate 1 (violation scan) output — exactly one row:
--   id a4ea393a-e934-4a7b-b1a2-5e508c3e3d2c
--   organization_id 3770972d-1bbd-417b-b413-297e844db285
--   link_state 'linked', person_id null, channel 'web',
--   primary_handle '+447427480641'
--
-- Gate 3 (post-repair read-back):
--   a4ea393a-e934-4a7b-b1a2-5e508c3e3d2c | unlinked | null
--
-- Gate 5 (constraint verify):
--   inbox_conversations_link_state_person_consistent | convalidated: true

UPDATE inbox_conversations
SET link_state = 'unlinked'
WHERE id = 'a4ea393a-e934-4a7b-b1a2-5e508c3e3d2c'
  AND person_id IS NULL;
-- (1 row, RETURNING verified at apply time)

ALTER TABLE inbox_conversations
ADD CONSTRAINT inbox_conversations_link_state_person_consistent
CHECK ((link_state = 'linked') = (person_id IS NOT NULL));