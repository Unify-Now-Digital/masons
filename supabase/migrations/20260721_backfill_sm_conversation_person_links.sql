-- Backfill: link 17 SM inbox conversations to existing people by verified
-- email/phone match. Applied via Dashboard SQL editor 2026-07-21.
--
-- Dry-run: 17 rows matched, zero ambiguous (each conversation_id matched
-- exactly one person; 3 conversations → same person nikki.henry@sky.com,
-- correct many-to-one).
-- Re-verify after apply (org 3770972d-1bbd-417b-b413-297e844db285):
--   linked_to_person = 47 (was 30), still_unlinked = 264. Delta = 17. ✓

UPDATE inbox_conversations c
SET person_id = v.person_id::uuid,
    link_state = 'linked'
FROM (VALUES
  ('666d6998-dd42-420f-a1ca-db509beebdd7','d0e02853-aa20-4bbe-9490-4372b5dede09'),
  ('67ae0a22-faf8-480e-995f-ea63bbe60eba','369a09a6-0f81-4f3d-a03e-27ce0f6e1cf4'),
  ('f5b720f3-7b13-4d67-9312-d3a3f3a435dd','d523c4bd-e2b4-4d51-b5ae-8d315f784746'),
  ('931cec25-7c50-4d60-9c7f-80cb930413dc','08a96515-345b-4a43-bba0-20d0b114b88a'),
  ('6ab4c352-e2f1-4a62-8aad-0a8f50d34bad','1869c23c-6dfe-48da-b2c8-b3d01aa1cba3'),
  ('360dde9f-b2dc-4273-b5ce-bf68cf99ed61','81a47303-9339-45c3-a308-985b067d1e90'),
  ('3a3bf815-a488-4cfe-80cb-f2d33c34951d','916aa5ed-6d16-4f44-8b0b-cc3bc9482b85'),
  ('c4972dd8-a879-4266-8a80-87a24bfd0725','5c71014b-2d10-4ee4-80bc-ca3e59b1908e'),
  ('13e9ffc4-3d72-4ab0-ac3f-dd1b115e2a98','2ee7ac0b-53a9-4628-abdf-f41aa28dbd41'),
  ('e631af07-ada5-486f-a2ff-9b466c692ab7','7cf0973e-94ca-4335-b213-fae5c9814ae3'),
  ('f9368d27-3c3d-48ea-af72-ce834af0e970','7cf0973e-94ca-4335-b213-fae5c9814ae3'),
  ('4cf06afb-a131-4479-b302-e0e212b807cf','7cf0973e-94ca-4335-b213-fae5c9814ae3'),
  ('e384331e-8c96-4ebe-ae19-a76c633bce83','d8ac60a4-3ab3-42a1-a885-e3839a113841'),
  ('61d5cbab-1afa-4a12-9263-4d54e843f4b6','bec08cf7-6b73-46d3-b8b7-7bcccddc5165'),
  ('61dcdbed-b08d-4ebb-82f4-e5fdfd2c5aa8','c31e8c33-9401-436f-9af3-8ae64c42e1a0'),
  ('4a416bee-03a7-4604-bfaf-92e10383070d','9ca40844-c011-4354-8fee-ffabf4142fff'),
  ('35ed9b6d-6fd8-4cc2-91a9-37add8a26a4c','2b38f727-f24a-4743-a816-d94295a492c1')
) AS v(conversation_id, person_id)
WHERE c.id = v.conversation_id::uuid
  AND c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND c.person_id IS NULL;