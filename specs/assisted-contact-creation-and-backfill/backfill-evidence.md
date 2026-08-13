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

<!-- VERBATIM: paste dry-run #1 response JSON here -->
```json
<PASTE dry-run #1 JSON>
```

**Review findings (Giorgi)**: dry-run #1 caught candidate #4, a compound multi-recipient
`primary_handle` ("arinmelvin@gmail.com, matthew_sears90@hotmail.com,
kotchlamazashvili.giorgi@gmail.com") from GHL system mail "New Admin Added to Sub-Account"
(conv 7f988a79) — it passed the gate via domain extraction on the comma-joined string.
Actioned before re-run: excluded via UI Hide sender; mute row verified (unmuted_at null),
so dry-run #2's fresh gate drops it.

## 2. Dry-run #2 (T021, post-mute — the REVIEWED/APPROVED candidate list)

<!-- VERBATIM: paste dry-run #2 response JSON here -->
```json
<PASTE dry-run #2 JSON>
```

**Approval**: Giorgi reviewed this list and gave the explicit go for execute (FR-C4 gate).

## 3. Execute (T022)

<!-- VERBATIM: paste execute response JSON here -->
```json
<PASTE execute JSON>
```

**Summary (from the payload above)**: 28 `created_and_linked` + 6 `linked_existing`,
0 errors, 0 `skipped_already_linked`. Per the contract amendment, results were diffed
against the reviewed dry-run #2 list: execute results match dry-run #2 exactly — same 28
handles, same 34 conversation ids, no additions, no drops (Giorgi, 14 Aug).

## 4. Read-backs (T023)

<!-- VERBATIM outputs as given by Giorgi, 14 Aug 2026. The exact SQL text of each
     query is still to be pasted (evidence discipline: verifying query + output). -->
```sql
<PASTE people-created read-back query text>
```
Output (Giorgi, verbatim): count 28, min 2026-08-13 22:46:14.606446+00,
max 2026-08-13 22:46:23.74156+00.
28 people created in a single 9-second window (created_via='inbox_ingest').

```sql
<PASTE unlinked-residual query text>
```
Output (Giorgi, verbatim): 388.
Residual unlinked (gate-fail/phone/web/ambiguous population — untouched by design).

```sql
<PASTE web-channel guard query text>
```
Output (Giorgi, verbatim): 0.
Zero `channel='web'` conversations gained a link from this run; zero phone-handle
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
