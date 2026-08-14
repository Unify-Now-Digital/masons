# Backfill evidence — backfill-sm-contacts (Commit C3)

**Run date**: 14 Aug 2026 (local, Tbilisi UTC+4) · **Timestamps in evidence are UTC** —
the DB's 2026-08-13 22:46 UTC window = 02:46 14 Aug local; same run, one clock
(Giorgi ruling, 14 Aug) · **Operator**: Giorgi (all invocations, service-role Bearer) ·
**Org**: Sears Melvin · **Function**: `backfill-sm-contacts` (source at
`supabase/functions/backfill-sm-contacts/index.ts`; deployment deleted after this record —
T024). Contract: `contracts/backfill-sm-contacts.md` (incl. the 14 Aug fresh-re-evaluation
amendment).

Evidence discipline note: every block marked VERBATIM below must be the actual tool/API
output pasted by Giorgi — summaries alone are not evidence (repo rule; see the correction
note precedent in migration 20260607152534). Claude structured this file from Giorgi's
reported results; Giorgi pastes the raw payloads.

---

## 1. Dry-run #1 (T021)

<!-- VERBATIM (whitespace deviation noted below) -->
```json
{
  "mode": "dry-run",
  "organization_id": "3770972d-1bbd-417b-b413-297e844db285",
  "candidates": [
    { "handle": "albert.62gooch@gmail.com", "conversation_ids": ["e690a7d7-f872-4cdb-a96f-fec13bfa30b0"], "gate_pass": true, "existing_person_id": null },
    { "handle": "allisont-s@hotmail.com", "conversation_ids": ["62f67a49-f928-4e8c-a3c9-98f917b449f2"], "gate_pass": true, "existing_person_id": null },
    { "handle": "annieohamadike@gmail.com", "conversation_ids": ["b785a720-6734-42a3-8873-eac20b389fc1"], "gate_pass": true, "existing_person_id": null },
    { "handle": "arinmelvin@gmail.com, matthew_sears90@hotmail.com, kotchlamazashvili.giorgi@gmail.com", "conversation_ids": ["7f988a79-926d-4946-b227-73613fb9ee0d"], "gate_pass": true, "existing_person_id": null },
    { "handle": "aylin1807@gmail.com", "conversation_ids": ["98456094-f2a5-4aed-8432-6991b2d632e9"], "gate_pass": true, "existing_person_id": null },
    { "handle": "ayomideolaifa@yahoo.co.uk", "conversation_ids": ["96a7eacb-5a69-414a-abbf-d1414968f5f5"], "gate_pass": true, "existing_person_id": null },
    { "handle": "elizabethgallagher24@icloud.com", "conversation_ids": ["1e616baa-de18-4d80-91f9-062d7b95fb27"], "gate_pass": true, "existing_person_id": null },
    { "handle": "emmadevall1979@icloud.com", "conversation_ids": ["5e7ebe4d-ab1c-456c-b157-dfbfda3ff3b5"], "gate_pass": true, "existing_person_id": null },
    { "handle": "fanchristopher@yahoo.com", "conversation_ids": ["6cd3c0d8-9733-42db-b2cd-16887187dd24"], "gate_pass": true, "existing_person_id": null },
    { "handle": "fgarip@hotmail.com", "conversation_ids": ["8755471e-4d70-405c-9166-fa9e695d61c8"], "gate_pass": true, "existing_person_id": null },
    { "handle": "garlows11@gmail.com", "conversation_ids": ["7a061fd6-23ff-414f-83e5-8133bb091822"], "gate_pass": true, "existing_person_id": null },
    { "handle": "harrytetteh@aol.com", "conversation_ids": ["8533f7b6-107c-4303-868b-b4d5bd7c65a8"], "gate_pass": true, "existing_person_id": null },
    { "handle": "juliespooner64@yahoo.co.uk", "conversation_ids": ["88045708-70ef-4f69-877a-51148018a512"], "gate_pass": true, "existing_person_id": null },
    { "handle": "kar_brown1@hotmail.co.uk", "conversation_ids": ["92c8ae2d-de92-4e54-bb21-0feedb1f30f5"], "gate_pass": true, "existing_person_id": null },
    { "handle": "karenehrose8@gmail.com", "conversation_ids": ["3aa7aa51-a0c3-466a-b5d7-50cadde944f0"], "gate_pass": true, "existing_person_id": null },
    { "handle": "karenswindells94@gmail.com", "conversation_ids": ["493b2db7-cfde-4e53-bc14-6a042117ab21","83dd55ff-095e-4c5b-9978-12a40f32206a","aeec24ff-ae96-4ec8-9935-e0bb59fb9081","d9557432-62f7-4177-aa83-97f3ddeaff40"], "gate_pass": true, "existing_person_id": null },
    { "handle": "kerizan@gmail.com", "conversation_ids": ["da767061-a3ed-4434-8d7e-aee2b851a1ab"], "gate_pass": true, "existing_person_id": null },
    { "handle": "lanabraddell@yahoo.co.uk", "conversation_ids": ["972f7dcd-1b53-439d-8c6e-2b31c45ad85d"], "gate_pass": true, "existing_person_id": null },
    { "handle": "lauracapaldi@hotmail.com", "conversation_ids": ["50b6fdef-5927-4ecd-9435-f2c1b172b341"], "gate_pass": true, "existing_person_id": null },
    { "handle": "mariakelly19632410@gmail.com", "conversation_ids": ["a5d2a00f-fc2b-43f4-b1ea-58d5e7fee197"], "gate_pass": true, "existing_person_id": null },
    { "handle": "marian378@hotmail.com", "conversation_ids": ["9ecc527a-8422-4839-94eb-ab3fe0f3c98c"], "gate_pass": true, "existing_person_id": null },
    { "handle": "mrspuddie@btinternet.com", "conversation_ids": ["896fc760-3a35-4df0-a0a1-8846916ef2da"], "gate_pass": true, "existing_person_id": null },
    { "handle": "nadydin@yahoo.com", "conversation_ids": ["11058fa6-c316-4fad-9804-44a30071f8e8","2c347362-133f-4efb-adbe-33fffe2a648f","45bb0d0b-0265-4458-b786-e8e1b8bf15c1","941612ae-58cc-4ddf-ac36-b114b502292d"], "gate_pass": true, "existing_person_id": null },
    { "handle": "rev.d.nichols@gmail.com", "conversation_ids": ["455bfd6d-ada2-474f-9fb4-c5175502eaab"], "gate_pass": true, "existing_person_id": null },
    { "handle": "shenequah1@gmail.com", "conversation_ids": ["c0ac91bd-7589-486b-8796-b42a59ee57de"], "gate_pass": true, "existing_person_id": null },
    { "handle": "sherrybrown259@outlook.com", "conversation_ids": ["cc941a1f-bbab-4eca-8b27-abd0d968b187"], "gate_pass": true, "existing_person_id": null },
    { "handle": "sister.susan@hotmail.com", "conversation_ids": ["b099ad12-8947-4f0f-a41c-da172409f43a"], "gate_pass": true, "existing_person_id": null },
    { "handle": "tinoorsi@hotmail.com", "conversation_ids": ["03d3e869-3ade-42f6-93b9-a5cd1547af2c"], "gate_pass": true, "existing_person_id": null },
    { "handle": "winniemae707@yahoo.co.uk", "conversation_ids": ["eb7bf8c7-af68-4bfb-bc58-6b960a43008b"], "gate_pass": true, "existing_person_id": null }
  ],
  "excluded_counts": { "web_stub": 166, "phone_shaped": 11, "ambiguous": 0, "gate_fail": 387 },
  "totals": { "unlinked_scanned": 599, "creatable_handles": 29, "conversations_affected": 35 }
}
```

*Verbatim deviation (whitespace only, ruled acceptable by Giorgi 14 Aug): the candidate
arrays in both dry-run blocks are compacted to one line per candidate; content is identical
to the curl output.*

**Review findings (Giorgi)**: dry-run #1 caught candidate #4, a compound multi-recipient
`primary_handle` ("arinmelvin@gmail.com, matthew_sears90@hotmail.com,
kotchlamazashvili.giorgi@gmail.com") from GHL system mail "New Admin Added to Sub-Account"
(conv 7f988a79) — it passed the gate via domain extraction on the comma-joined string.
Actioned before re-run: excluded via UI Hide sender; mute row verified (unmuted_at null),
so dry-run #2's fresh gate drops it.

## 2. Dry-run #2 (T021, post-mute — the REVIEWED/APPROVED candidate list)

<!-- VERBATIM (same whitespace deviation as §1) -->
```json
{
  "mode": "dry-run",
  "organization_id": "3770972d-1bbd-417b-b413-297e844db285",
  "candidates": [
    { "handle": "albert.62gooch@gmail.com", "conversation_ids": ["e690a7d7-f872-4cdb-a96f-fec13bfa30b0"], "gate_pass": true, "existing_person_id": null },
    { "handle": "allisont-s@hotmail.com", "conversation_ids": ["62f67a49-f928-4e8c-a3c9-98f917b449f2"], "gate_pass": true, "existing_person_id": null },
    { "handle": "annieohamadike@gmail.com", "conversation_ids": ["b785a720-6734-42a3-8873-eac20b389fc1"], "gate_pass": true, "existing_person_id": null },
    { "handle": "aylin1807@gmail.com", "conversation_ids": ["98456094-f2a5-4aed-8432-6991b2d632e9"], "gate_pass": true, "existing_person_id": null },
    { "handle": "ayomideolaifa@yahoo.co.uk", "conversation_ids": ["96a7eacb-5a69-414a-abbf-d1414968f5f5"], "gate_pass": true, "existing_person_id": null },
    { "handle": "elizabethgallagher24@icloud.com", "conversation_ids": ["1e616baa-de18-4d80-91f9-062d7b95fb27"], "gate_pass": true, "existing_person_id": null },
    { "handle": "emmadevall1979@icloud.com", "conversation_ids": ["5e7ebe4d-ab1c-456c-b157-dfbfda3ff3b5"], "gate_pass": true, "existing_person_id": null },
    { "handle": "fanchristopher@yahoo.com", "conversation_ids": ["6cd3c0d8-9733-42db-b2cd-16887187dd24"], "gate_pass": true, "existing_person_id": null },
    { "handle": "fgarip@hotmail.com", "conversation_ids": ["8755471e-4d70-405c-9166-fa9e695d61c8"], "gate_pass": true, "existing_person_id": null },
    { "handle": "garlows11@gmail.com", "conversation_ids": ["7a061fd6-23ff-414f-83e5-8133bb091822"], "gate_pass": true, "existing_person_id": null },
    { "handle": "harrytetteh@aol.com", "conversation_ids": ["8533f7b6-107c-4303-868b-b4d5bd7c65a8"], "gate_pass": true, "existing_person_id": null },
    { "handle": "juliespooner64@yahoo.co.uk", "conversation_ids": ["88045708-70ef-4f69-877a-51148018a512"], "gate_pass": true, "existing_person_id": null },
    { "handle": "kar_brown1@hotmail.co.uk", "conversation_ids": ["92c8ae2d-de92-4e54-bb21-0feedb1f30f5"], "gate_pass": true, "existing_person_id": null },
    { "handle": "karenehrose8@gmail.com", "conversation_ids": ["3aa7aa51-a0c3-466a-b5d7-50cadde944f0"], "gate_pass": true, "existing_person_id": null },
    { "handle": "karenswindells94@gmail.com", "conversation_ids": ["493b2db7-cfde-4e53-bc14-6a042117ab21","83dd55ff-095e-4c5b-9978-12a40f32206a","aeec24ff-ae96-4ec8-9935-e0bb59fb9081","d9557432-62f7-4177-aa83-97f3ddeaff40"], "gate_pass": true, "existing_person_id": null },
    { "handle": "kerizan@gmail.com", "conversation_ids": ["da767061-a3ed-4434-8d7e-aee2b851a1ab"], "gate_pass": true, "existing_person_id": null },
    { "handle": "lanabraddell@yahoo.co.uk", "conversation_ids": ["972f7dcd-1b53-439d-8c6e-2b31c45ad85d"], "gate_pass": true, "existing_person_id": null },
    { "handle": "lauracapaldi@hotmail.com", "conversation_ids": ["50b6fdef-5927-4ecd-9435-f2c1b172b341"], "gate_pass": true, "existing_person_id": null },
    { "handle": "mariakelly19632410@gmail.com", "conversation_ids": ["a5d2a00f-fc2b-43f4-b1ea-58d5e7fee197"], "gate_pass": true, "existing_person_id": null },
    { "handle": "marian378@hotmail.com", "conversation_ids": ["9ecc527a-8422-4839-94eb-ab3fe0f3c98c"], "gate_pass": true, "existing_person_id": null },
    { "handle": "mrspuddie@btinternet.com", "conversation_ids": ["896fc760-3a35-4df0-a0a1-8846916ef2da"], "gate_pass": true, "existing_person_id": null },
    { "handle": "nadydin@yahoo.com", "conversation_ids": ["11058fa6-c316-4fad-9804-44a30071f8e8","2c347362-133f-4efb-adbe-33fffe2a648f","45bb0d0b-0265-4458-b786-e8e1b8bf15c1","941612ae-58cc-4ddf-ac36-b114b502292d"], "gate_pass": true, "existing_person_id": null },
    { "handle": "rev.d.nichols@gmail.com", "conversation_ids": ["455bfd6d-ada2-474f-9fb4-c5175502eaab"], "gate_pass": true, "existing_person_id": null },
    { "handle": "shenequah1@gmail.com", "conversation_ids": ["c0ac91bd-7589-486b-8796-b42a59ee57de"], "gate_pass": true, "existing_person_id": null },
    { "handle": "sherrybrown259@outlook.com", "conversation_ids": ["cc941a1f-bbab-4eca-8b27-abd0d968b187"], "gate_pass": true, "existing_person_id": null },
    { "handle": "sister.susan@hotmail.com", "conversation_ids": ["b099ad12-8947-4f0f-a41c-da172409f43a"], "gate_pass": true, "existing_person_id": null },
    { "handle": "tinoorsi@hotmail.com", "conversation_ids": ["03d3e869-3ade-42f6-93b9-a5cd1547af2c"], "gate_pass": true, "existing_person_id": null },
    { "handle": "winniemae707@yahoo.co.uk", "conversation_ids": ["eb7bf8c7-af68-4bfb-bc58-6b960a43008b"], "gate_pass": true, "existing_person_id": null }
  ],
  "excluded_counts": { "web_stub": 166, "phone_shaped": 11, "ambiguous": 0, "gate_fail": 388 },
  "totals": { "unlinked_scanned": 599, "creatable_handles": 28, "conversations_affected": 34 }
}
```

*Delta vs §1, as expected: the compound-handle candidate is gone (muted → fresh gate drops
it), `gate_fail` 387→388, `creatable_handles` 29→28, `conversations_affected` 35→34. All
other candidates identical.*

**Approval**: Giorgi reviewed this list and gave the explicit go for execute (FR-C4 gate).

## 3. Execute (T022)

```json
{
  "mode": "execute",
  "organization_id": "3770972d-1bbd-417b-b413-297e844db285",
  "results": [
    { "conversation_id": "e690a7d7-f872-4cdb-a96f-fec13bfa30b0", "handle": "albert.62gooch@gmail.com", "outcome": "created_and_linked", "person_id": "40957be4-4db5-4961-ac44-f82d55382758", "error": null },
    { "conversation_id": "62f67a49-f928-4e8c-a3c9-98f917b449f2", "handle": "allisont-s@hotmail.com", "outcome": "created_and_linked", "person_id": "76be15fe-ffa9-4c70-9e14-9f2dae1be800", "error": null },
    { "conversation_id": "b785a720-6734-42a3-8873-eac20b389fc1", "handle": "annieohamadike@gmail.com", "outcome": "created_and_linked", "person_id": "23992b71-1813-4439-a541-4e54fe27a09e", "error": null },
    { "conversation_id": "98456094-f2a5-4aed-8432-6991b2d632e9", "handle": "aylin1807@gmail.com", "outcome": "created_and_linked", "person_id": "3c0a18a4-2d90-43df-b2fd-a684d3657759", "error": null },
    { "conversation_id": "96a7eacb-5a69-414a-abbf-d1414968f5f5", "handle": "ayomideolaifa@yahoo.co.uk", "outcome": "created_and_linked", "person_id": "e0fed95a-1703-49be-9d62-f0ff431ef9ec", "error": null },
    { "conversation_id": "1e616baa-de18-4d80-91f9-062d7b95fb27", "handle": "elizabethgallagher24@icloud.com", "outcome": "created_and_linked", "person_id": "e6a529e3-d04b-40cd-b005-2b9352fa4894", "error": null },
    { "conversation_id": "5e7ebe4d-ab1c-456c-b157-dfbfda3ff3b5", "handle": "emmadevall1979@icloud.com", "outcome": "created_and_linked", "person_id": "1efd7a41-2fce-4f34-a41d-df6a6798f09a", "error": null },
    { "conversation_id": "6cd3c0d8-9733-42db-b2cd-16887187dd24", "handle": "fanchristopher@yahoo.com", "outcome": "created_and_linked", "person_id": "1dbc1de9-99f1-4f65-8143-0c32fe6347d6", "error": null },
    { "conversation_id": "8755471e-4d70-405c-9166-fa9e695d61c8", "handle": "fgarip@hotmail.com", "outcome": "created_and_linked", "person_id": "87f7fdef-a696-4901-918a-72291294b1e2", "error": null },
    { "conversation_id": "7a061fd6-23ff-414f-83e5-8133bb091822", "handle": "garlows11@gmail.com", "outcome": "created_and_linked", "person_id": "99e2204c-f383-4eb6-8ff3-7499fe9a08dc", "error": null },
    { "conversation_id": "8533f7b6-107c-4303-868b-b4d5bd7c65a8", "handle": "harrytetteh@aol.com", "outcome": "created_and_linked", "person_id": "e0a64818-34bb-46a1-92ea-20a4742b2247", "error": null },
    { "conversation_id": "88045708-70ef-4f69-877a-51148018a512", "handle": "juliespooner64@yahoo.co.uk", "outcome": "created_and_linked", "person_id": "715a4783-8514-4570-b2b8-b75665d09644", "error": null },
    { "conversation_id": "92c8ae2d-de92-4e54-bb21-0feedb1f30f5", "handle": "kar_brown1@hotmail.co.uk", "outcome": "created_and_linked", "person_id": "6de5f327-6726-45fb-9e40-4d9d8c3b5560", "error": null },
    { "conversation_id": "3aa7aa51-a0c3-466a-b5d7-50cadde944f0", "handle": "karenehrose8@gmail.com", "outcome": "created_and_linked", "person_id": "0348672b-bc7c-40f6-98ea-42b0c32b523c", "error": null },
    { "conversation_id": "493b2db7-cfde-4e53-bc14-6a042117ab21", "handle": "karenswindells94@gmail.com", "outcome": "created_and_linked", "person_id": "bcc215bc-e025-4826-bf9b-aad6a09ab5a3", "error": null },
    { "conversation_id": "83dd55ff-095e-4c5b-9978-12a40f32206a", "handle": "karenswindells94@gmail.com", "outcome": "linked_existing", "person_id": "bcc215bc-e025-4826-bf9b-aad6a09ab5a3", "error": null },
    { "conversation_id": "aeec24ff-ae96-4ec8-9935-e0bb59fb9081", "handle": "karenswindells94@gmail.com", "outcome": "linked_existing", "person_id": "bcc215bc-e025-4826-bf9b-aad6a09ab5a3", "error": null },
    { "conversation_id": "d9557432-62f7-4177-aa83-97f3ddeaff40", "handle": "karenswindells94@gmail.com", "outcome": "linked_existing", "person_id": "bcc215bc-e025-4826-bf9b-aad6a09ab5a3", "error": null },
    { "conversation_id": "da767061-a3ed-4434-8d7e-aee2b851a1ab", "handle": "kerizan@gmail.com", "outcome": "created_and_linked", "person_id": "7e2c2de6-239d-448b-93bc-aa16cff5a627", "error": null },
    { "conversation_id": "972f7dcd-1b53-439d-8c6e-2b31c45ad85d", "handle": "lanabraddell@yahoo.co.uk", "outcome": "created_and_linked", "person_id": "bc8e1f75-145c-49d5-a9e8-d2b4020ef3fc", "error": null },
    { "conversation_id": "50b6fdef-5927-4ecd-9435-f2c1b172b341", "handle": "lauracapaldi@hotmail.com", "outcome": "created_and_linked", "person_id": "d08e7d3a-65b3-4991-a2a7-f166307cfca5", "error": null },
    { "conversation_id": "a5d2a00f-fc2b-43f4-b1ea-58d5e7fee197", "handle": "mariakelly19632410@gmail.com", "outcome": "created_and_linked", "person_id": "65997a8c-818e-489e-9a82-d77db47b41f2", "error": null },
    { "conversation_id": "9ecc527a-8422-4839-94eb-ab3fe0f3c98c", "handle": "marian378@hotmail.com", "outcome": "created_and_linked", "person_id": "edfeadfc-4b9b-4603-a025-9c7431f0a4f0", "error": null },
    { "conversation_id": "896fc760-3a35-4df0-a0a1-8846916ef2da", "handle": "mrspuddie@btinternet.com", "outcome": "created_and_linked", "person_id": "a20c4607-4eb8-419c-bb1f-f4a711604dcd", "error": null },
    { "conversation_id": "11058fa6-c316-4fad-9804-44a30071f8e8", "handle": "nadydin@yahoo.com", "outcome": "created_and_linked", "person_id": "24324624-0d5a-46fb-b22b-4579a5b233c9", "error": null },
    { "conversation_id": "2c347362-133f-4efb-adbe-33fffe2a648f", "handle": "nadydin@yahoo.com", "outcome": "linked_existing", "person_id": "24324624-0d5a-46fb-b22b-4579a5b233c9", "error": null },
    { "conversation_id": "45bb0d0b-0265-4458-b786-e8e1b8bf15c1", "handle": "nadydin@yahoo.com", "outcome": "linked_existing", "person_id": "24324624-0d5a-46fb-b22b-4579a5b233c9", "error": null },
    { "conversation_id": "941612ae-58cc-4ddf-ac36-b114b502292d", "handle": "nadydin@yahoo.com", "outcome": "linked_existing", "person_id": "24324624-0d5a-46fb-b22b-4579a5b233c9", "error": null },
    { "conversation_id": "455bfd6d-ada2-474f-9fb4-c5175502eaab", "handle": "rev.d.nichols@gmail.com", "outcome": "created_and_linked", "person_id": "b2e9b5e4-7dac-4509-8b13-9df673aefb8d", "error": null },
    { "conversation_id": "c0ac91bd-7589-486b-8796-b42a59ee57de", "handle": "shenequah1@gmail.com", "outcome": "created_and_linked", "person_id": "ad91a4f5-8a1d-46f0-b837-09d0fa0a49aa", "error": null },
    { "conversation_id": "cc941a1f-bbab-4eca-8b27-abd0d968b187", "handle": "sherrybrown259@outlook.com", "outcome": "created_and_linked", "person_id": "dee9cfd9-0665-4774-93e0-9d69ef986e38", "error": null },
    { "conversation_id": "b099ad12-8947-4f0f-a41c-da172409f43a", "handle": "sister.susan@hotmail.com", "outcome": "created_and_linked", "person_id": "4d046722-4781-47c1-88e8-874a07306c99", "error": null },
    { "conversation_id": "03d3e869-3ade-42f6-93b9-a5cd1547af2c", "handle": "tinoorsi@hotmail.com", "outcome": "created_and_linked", "person_id": "f2d09214-7835-41a8-a1d5-30bc300f950a", "error": null },
    { "conversation_id": "eb7bf8c7-af68-4bfb-bc58-6b960a43008b", "handle": "winniemae707@yahoo.co.uk", "outcome": "created_and_linked", "person_id": "a9867534-ee3a-45f8-9391-8cbe2c19453d", "error": null }
  ],
  "totals": { "people_created": 28, "conversations_linked": 34, "skipped": 0, "errors": 0 }
}
```

**Summary (from the payload above)**: 28 `created_and_linked` + 6 `linked_existing`,
0 errors, 0 `skipped_already_linked`. Per the contract amendment, results were diffed
against the reviewed dry-run #2 list: execute results match dry-run #2 exactly — same 28
handles, same 34 conversation ids, no additions, no drops (Giorgi, 14 Aug).

## 4. Read-backs (T023)

<!-- VERBATIM: queries as run by Giorgi, 14 Aug 2026, with actual outputs. -->
```sql
SELECT count(*), min(created_at), max(created_at) FROM people
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND created_via = 'inbox_ingest'
  AND created_at > now() - interval '15 minutes';
```
Output (Giorgi, verbatim): count 28, min 2026-08-13 22:46:14.606446+00,
max 2026-08-13 22:46:23.74156+00.
28 people created in a single 9-second window (created_via='inbox_ingest').

```sql
SELECT count(*) FROM inbox_conversations
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND person_id IS NULL AND link_state = 'unlinked'
  AND primary_handle LIKE '%@%' AND channel != 'web';
```
Output (Giorgi, verbatim): 388.
Residual unlinked email-shaped non-web conversations: 388 — exactly dry-run #2's
`gate_fail` count (387 original gate-fails + the muted compound handle), untouched by
design. Cross-check: candidates linked (34) + residual (388) + phone (11) + web (166) =
599 = `unlinked_scanned`.

```sql
SELECT count(*) FROM inbox_conversations c JOIN people p ON p.id = c.person_id
WHERE c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND c.channel = 'web' AND p.created_at > now() - interval '15 minutes';
```
Output (Giorgi, verbatim): 0.
Zero `channel='web'` conversations linked to freshly-created people; zero phone-handle
conversations touched.

## 5. Idempotency re-run (T023)

```json
{"mode":"execute","organization_id":"3770972d-1bbd-417b-b413-297e844db285","results":[],"totals":{"people_created":0,"conversations_linked":0,"skipped":0,"errors":0}}
```

**Result**: `people_created: 0` with an **empty candidate set**. Shape note (differs from
tasks.md T023's original wording): idempotency manifests at the PRE-FILTER, not as
`skipped_already_linked` outcomes — the first run linked every candidate conversation, so
the re-run's `person_id is null` scan finds none of them and `results` is empty. Same
guarantee (no duplicates, no re-writes), different observable shape; recorded here as the
authoritative description.

## 6. Deployment deletion (T024)

```
Deleted Function backfill-sm-contacts from project bfwohzcugtwbhhxdqgme.
```
Source retained in the repo as the record of what ran.
