# Feature Specification: Assisted Contact Creation + Backfill

**Trunk**: `staging` (repo convention — PRs and merges target staging)
**Created**: 2026-08-14
**Status**: Draft
**Input**: User description: "Assisted contact creation + backfill (Commit C of customer-creation-on-ingest)" — full description in the /specify invocation; summarized throughout this spec.

## Context

Commit C of the customer-creation-on-ingest initiative. Auto-creation on ingest is live
(`created_via='inbox_ingest'`, commit `cf8b66a`, deployed 13 Aug 2026, fixture-verified in both
orgs). The FR-5 gate deliberately fails closed for business-domain senders, so some legitimate
senders never get a contact automatically. This feature delivers (a) the staff-driven safety net
for those conversations and (b) the one-time historical backfill for Sears Melvin, plus two small
correctness fixes found during the 13 Aug investigation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assisted create-from-thread (Priority: P1)

A staff member viewing any unlinked conversation in the unified inbox can create a contact from
that thread in one action. The existing AddToCustomersDialog opens prefilled with the handle's
email/phone; on save the new person is stamped `created_via='inbox_assisted'` and the
conversation is automatically linked to them (`link_state='linked'`, respecting the FR-1 CHECK
constraint from Commit A/B); in the grouped view, all of the handle's unlinked conversations are
linked, not only the open one. The action is the visible primary action on unlinked threads in both
grouped and ungrouped inbox views, and remains available on muted/hidden unlinked conversations —
mute vetoes *auto*-create only; an assisted create is a deliberate staff decision.

**Why this priority**: This is the safety net for the fail-closed FR-5 gate. Business-domain
senders (and any future gate exclusions) currently have no one-action path to a linked contact;
without it, staff work around the inbox and provenance is lost.

**Independent Test**: Open an unlinked conversation (including a muted one), click the primary
create action, save the prefilled dialog, and verify: person row exists with
`created_via='inbox_assisted'`, conversation has `person_id` set and `link_state='linked'`, and
the thread now renders as linked in both grouped and ungrouped views.

**Acceptance Scenarios**:

1. **Given** an unlinked conversation with an email handle, **When** staff clicks the primary
   create action and saves the dialog, **Then** a person is created with
   `created_via='inbox_assisted'` and the conversation is linked to them
   (`link_state='linked'`) without violating the FR-1 CHECK constraint.
2. **Given** an unlinked conversation with a phone handle, **When** staff uses assisted create,
   **Then** the dialog prefills the phone number and the same stamp-and-link behavior applies.
3. **Given** a muted or hidden unlinked conversation, **When** staff opens it, **Then** the
   assisted-create action is still available and works identically.
4. **Given** the grouped inbox view and the ungrouped view, **When** an unlinked thread is
   displayed in either, **Then** the assisted-create action is the visible primary action.
5. **Given** a conversation already linked to a person, **When** staff views it, **Then** the
   assisted-create primary action is not offered (linking changes go through Change-link).
6. **Given** the grouped view where multiple unlinked conversations share the handle, **When**
   staff completes assisted create from one of them, **Then** all of that handle's unlinked
   conversations are linked to the new person.

---

### User Story 2 - Historical backfill of SM unlinked conversations (Priority: P2)

A one-time pass over Sears Melvin's existing unlinked conversations auto-creates people for
handles that pass the live `shouldAutoCreatePerson` gate AND are email-shaped (~30 candidates).
Each created person is linked to its conversation(s). Phone and GHL-stub conversations are
excluded per the 13 Aug ruling (GHL merge incomplete) — those remain assisted-only via User
Story 1. Staff handles are excluded by the gate itself.

**Why this priority**: Clears the historical debt so the inbox reflects reality, but only after
the assisted path exists (US1) so the exclusions have a manual route.

**Independent Test**: Produce the candidate list by running the real gate per handle (not a SQL
approximation), review it before execution, execute, then verify per-row: person created with
expected provenance, conversation(s) linked, and no phone/GHL-stub/staff handle was touched.

**Acceptance Scenarios**:

1. **Given** SM's unlinked conversations, **When** candidates are computed, **Then** each
   candidate was evaluated by the live `shouldAutoCreatePerson` gate per handle and is
   email-shaped; the list is presented for review before any write.
2. **Given** the reviewed candidate list, **When** the backfill executes, **Then** every created
   person links its conversation(s) and per-row results (created/linked/skipped/error) are
   recorded as evidence.
3. **Given** a phone-handle or GHL-stub unlinked conversation, **When** the backfill runs,
   **Then** it is untouched.
4. **Given** the backfill has completed once, **When** it is invoked again, **Then** it creates
   no duplicates (idempotent or guarded against re-run).

---

### User Story 3 - Working Change-link button (Priority: P3)

A staff member in CustomerConversationView can use the Change-link button to relink a
conversation. Today the button is dead: a circular enable-gate (the candidate query is enabled
only when the modal is open; `canLink` is derived from that query; the onClick that opens the
modal is gated on `canLink`) means the modal can never open. Root cause and exact lines were
identified 13 Aug in the investigation record.

**Why this priority**: Restores an existing, expected control; it also becomes the correction
path for any wrong link produced by US1/US2.

**Independent Test**: From CustomerConversationView, click Change-link on a conversation and
verify the modal opens, candidates load, and a relink completes.

**Acceptance Scenarios**:

1. **Given** a linked conversation in CustomerConversationView, **When** staff clicks
   Change-link, **Then** the modal opens and candidate people load.
2. **Given** the open modal, **When** staff selects a different person, **Then** the
   conversation is relinked and the view updates.

---

### User Story 4 - Provenance integrity across all writers (Priority: P4)

With a second writer now stamping `created_via`, the database enforces the vocabulary: a CHECK
constraint on `people.created_via` allows `('inbox_ingest','inbox_assisted','manual')` plus NULL
for legacy rows. `resolvePersonId` (which currently stamps neither field) is updated to stamp
`created_via='manual'` and `is_test:false`, so all audited writers are marked.

**Why this priority**: Enables trustworthy audit/reporting on contact provenance; low user-facing
urgency but should land with or before US1 so `inbox_assisted` rows are constraint-checked from
day one.

**Independent Test**: Attempt an insert with an invalid `created_via` value (rejected); create a
person via `resolvePersonId` and verify `created_via='manual'` and `is_test=false`; verify legacy
NULL rows still pass.

**Acceptance Scenarios**:

1. **Given** the constraint is applied, **When** any writer inserts a person with a
   `created_via` value outside the allowed set, **Then** the database rejects it.
2. **Given** legacy rows with NULL `created_via`, **When** the constraint is applied, **Then**
   it validates cleanly with no data rewrite required.
3. **Given** a person created through `resolvePersonId`, **When** the row is inspected, **Then**
   `created_via='manual'` and `is_test=false`.

---

### Edge Cases

- Unlinked conversation whose handle already matches an existing person (e.g. created since the
  conversation arrived): assisted create should surface/dedupe rather than create a duplicate —
  AddToCustomersDialog's existing duplicate handling applies; the link must still complete.
- Multiple unlinked conversations sharing one handle: backfill must create one person and link
  all of that handle's conversations, not one person per conversation.
- Assisted create raced by an ingest auto-create on the same handle: unique/org-scoped
  constraints must resolve to a single person; the conversation must end linked either way.
- Backfill candidate whose conversation gets manually linked between review and execution: the
  execution pass must skip it (re-check link state at write time).
- Dialog save succeeds but the link write fails: the outcome must be visible to staff (not a
  silently still-unlinked thread with an orphaned new contact).
- Muted conversation created via assisted action: creating/linking must not unmute or otherwise
  change mute state.
- CHECK constraint applied while any in-flight writer still inserts unstamped rows: deploy order
  must ensure all audited writers stamp before the constraint is enforced (NULL remains allowed,
  so legacy inserts fail only if they write an invalid non-NULL value).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-A1**: Staff MUST be able to create a contact from any unlinked conversation in one action,
  via the existing AddToCustomersDialog prefilled with the handle's email/phone.
- **FR-A2**: The `created_via` stamp MUST depend on entry point: `'inbox_assisted'` only when
  the dialog is opened from a conversation; the People-page/manual entry path stamps
  `'manual'`.
- **FR-A3**: On save, the system MUST auto-link the conversation to the new person with
  `link_state='linked'`, respecting the FR-1 CHECK constraint on conversations. In the grouped
  view, assisted create MUST link ALL of the handle's unlinked conversations, not only the open
  one (mirror of the backfill multi-conversation edge case).
- **FR-A4**: The assisted-create action MUST be the visible primary action on unlinked threads in
  both grouped and ungrouped inbox views.
- **FR-A5**: The action MUST be available on muted/hidden unlinked conversations (mute vetoes
  auto-create only).
- **FR-B1**: A CHECK constraint on `people.created_via` MUST allow exactly
  `('inbox_ingest','inbox_assisted','manual')` and NULL (legacy rows).
- **FR-B2**: `resolvePersonId` MUST stamp `created_via='manual'` and `is_test:false` on the
  people it creates, so it joins the audited writer set (completeness of that set is FR-B3's
  concern).
- **FR-B3**: Before the CHECK constraint is applied, a repo-wide audit of ALL `people` insert
  call sites MUST be recorded. Known so far: `attemptAutoLink` (T016), `resolvePersonId`,
  AddToCustomersDialog's own insert, and the SM website enquiry path; the audit finds the rest.
  Each writer MUST either stamp a valid `created_via` or be recorded as conscious-NULL.
- **FR-C1**: A one-time backfill over SM's unlinked conversations MUST auto-create people only
  for handles that pass the live `shouldAutoCreatePerson` gate AND are email-shaped (~30
  candidates); the real gate MUST be run per handle — no SQL approximation.
- **FR-C2**: Phone and GHL-stub conversations MUST be excluded from the backfill (13 Aug ruling;
  GHL merge incomplete) and remain assisted-only.
- **FR-C3**: Each backfill-created person MUST be linked to its conversation(s).
- **FR-C4**: Evidence standard — the candidate list MUST be reviewed before execution, and
  per-row results MUST be recorded.
- **FR-D1**: The Change-link button in CustomerConversationView MUST work: break the circular
  enable-gate (query enabled only when modal open → `canLink` derived from query → onClick gated
  on `canLink`) identified 13 Aug.
- **FR-E1**: The stale comment at `PersonOrdersPanel.tsx:128` claiming a global
  `people_email_key` index MUST be corrected to reflect the org-scoped index that landed 12 Aug.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Multi-tenancy)**: All reads/writes are org-scoped. The backfill targets Sears Melvin
  only; Sears Melvin is LIVE with real orders — no writes without explicit per-change approval,
  diffs shown first, per the repo guardrails.
- **AC-002 (Module boundaries)**: Feature code lives in `src/modules/inbox/` (and
  `src/modules/` peers already touched by Commits A/B); no deep imports of other modules'
  internals.
- **AC-003 (RLS as boundary)**: Authorization is enforced in the database via RLS; UI checks are
  not security.
- **AC-004 (Migration discipline)**: The CHECK constraint ships as a migration file in
  `supabase/migrations/` but is applied by hand via the Dashboard SQL editor; no
  `supabase db push`. Backfill evidence (rows affected, read-back SELECT output) is recorded in
  the migration/script comment block at apply time.
- **AC-005 (Gate reuse)**: The backfill MUST invoke the same `shouldAutoCreatePerson` code path
  the live ingest uses — a reimplementation or SQL approximation of the gate is out of spec.

### Key Entities

- **Person (`people`)**: Contact record; gains an enforced `created_via` vocabulary
  (`inbox_ingest` | `inbox_assisted` | `manual` | NULL legacy) and consistent `is_test`
  stamping across all audited writers.
- **Conversation**: Inbox thread with a handle (email/phone), `person_id`, `link_state`
  (governed by the FR-1 CHECK constraint), and mute/hidden flags. Unlinked conversations are the
  subject of US1 and US2.
- **Handle**: The email address or phone number identifying a conversation's counterparty; the
  unit the auto-create gate evaluates.
- **Backfill run record**: The evidence artifact — reviewed candidate list plus per-row outcomes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From an unlinked thread, staff can produce a linked contact in a single dialog
  interaction (one click to open, one save), including on muted threads.
- **SC-002**: 100% of people created by audited writers after this feature ships have non-NULL
  `created_via` (writers recorded as conscious-NULL per FR-B3 are the documented exception);
  the database rejects any value outside the allowed set.
- **SC-003**: After the backfill, every SM unlinked conversation whose handle passes the live
  gate and is email-shaped (~30) is linked to a person; zero phone/GHL-stub conversations were
  modified; per-row evidence exists for every candidate.
- **SC-004**: The Change-link modal opens and completes a relink on first click in
  CustomerConversationView.
- **SC-005**: No duplicate people created by the assisted path or backfill for handles that
  already have a person in the same org.

## Assumptions

- The FR-1 CHECK constraint on conversations (link_state consistency) from Commit A/B is live in
  both orgs and its shape is known; assisted linking writes must satisfy it as-is.
- The live `shouldAutoCreatePerson` gate is callable outside the ingest path (or can be made so
  without changing its behavior) for the backfill's per-handle evaluation.
- The ~30 candidate estimate is indicative, not a contract; the reviewed list is authoritative.
- Churchill needs no backfill in this commit (its email-domain TODO is explicitly out of scope).
- The 13 Aug investigation record's line-level findings for the Change-link bug are still
  accurate on the current branch.

## Plan-Phase Verification Items

- Verify AddToCustomersDialog's existing prefill and duplicate handling actually behave as
  described — this was asserted but never verified in the 13 Aug investigation. Must be
  confirmed (or scoped as a fix) during planning before FR-A1 and the duplicate-handling edge
  case can rely on it.

## Open Questions

- **OQ-1 [NEEDS CLARIFICATION]**: Do auto-created contacts — digit-named phone contacts
  especially — need a visible pending-review marker on the People page now, or is that deferred
  to a later commit?
- **OQ-2 [NEEDS CLARIFICATION]**: Does the backfill run as a SQL script (Dashboard, with pasted
  evidence) or as an edge-function invocation (gate code runs natively, evidence captured from
  logs)? The AC-005 gate-reuse constraint favors the edge-function route but does not decide it.

## Out of Scope

- GHL message-body ingestion.
- `yourofficeandpa` handling (pending classification).
- Churchill email-domain TODO.
- Phone/GHL-stub backfill (assisted-only per 13 Aug ruling).
