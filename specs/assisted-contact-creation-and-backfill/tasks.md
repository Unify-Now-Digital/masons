# Tasks: Assisted Contact Creation + Backfill (Commit C)

**Input**: `specs/assisted-contact-creation-and-backfill/` — spec.md, plan.md, research.md
(R1–R8), data-model.md, contracts/{frontend-changes.md, backfill-sm-contacts.md},
quickstart.md. Generated 14 Aug 2026 against working tree f61ba12 (clean).

Ground rules (apply to every task — same working agreements as Commit B):
- No task deploys anything before its Deploy-marked task. No task runs git — Giorgi performs
  all commits/pushes and runs all gates. Conditional approvals block until an explicit go.
- After every edit: grep-confirm the change on disk (exact-match) before moving on; stop on
  any failed exact match.
- Line numbers are anchors (re-verified 14 Aug 2026), not addresses — re-grep before editing;
  earlier tasks in the same file shift later anchors.
- Under the diff-approval protocol execution is one reviewed diff at a time, so [P] marks
  parallel-eligibility (different files, no dependency), not concurrent execution.

Commit boundaries (from plan.md Phase 2, one concern each):
1. **Commit C1 — frontend** (T002–T011): stamping + assisted-create primary action +
   Change-link fix + FR-E1. Lands US1, US3, and US4's writer half.
2. **Commit C2 — constraint** (T014–T016): FR-B3 final audit + `created_via` CHECK migration.
3. **Commit C3 — backfill** (T018–T025): one-off edge function, dry-run → approval → execute →
   evidence → deployment deleted.

Post-generation rulings (Giorgi, 14 Aug 2026):
- **R5 accepted** — backfill rows carry `created_via='inbox_ingest'`; backfill-evidence.md is
  the provenance record distinguishing backfill from live ingest.
- **C4 residual accepted** — modal opens when candidates arrive; T013 must explicitly confirm
  prompt opening. If slow in practice, open-immediately-with-loading becomes a FOLLOW-UP task,
  not part of T009.
- **T012 amended** — opens with an end-to-end ingest retest; single teardown at session end
  (see task text).

---

## Phase 1: Preflight

- [x] **T001 — Anchor re-verification (record-only, no edits)** (RUN 14 Aug 2026 — zero
  drift; all 8 anchor groups verbatim at their recorded lines. Located at run time:
  QuickCreatePersonDialog builds `toCustomerInsert({ ...values, address/city/country: "" })`
  at :60–:65 and calls `createCustomer(payload, {` at :66 — T005's edit lands on the :60
  payload. CreateCustomerDrawer's call is `createCustomer(payload, {` at :56, right under the
  :55 payload anchor. `useCreateCustomer` callers repo-wide: exactly the 3 components
  (+ definition :108 + index.ts re-export). addToPipeline.api.ts contains NO `created_via` or
  `is_test` anywhere (people insert at :70). tsc/lint baselines NOT re-run per Giorgi's
  instruction — greps only; baselines are T011's gate.)
  Grep-confirm each anchor below still matches before any edit; record drift here.
  - `src/modules/customers/hooks/useCustomers.ts:19` — `export type CustomerInsert = Omit<Customer, "id" | "created_at" | "updated_at">;`
  - `src/modules/inbox/components/AddToCustomersDialog.tsx:154` — `createCustomer(toCustomerInsert(values), {`
  - `src/modules/customers/components/CreateCustomerDrawer.tsx:55` — `const payload = toCustomerInsert(values);`
  - `src/modules/invoicing/components/QuickCreatePersonDialog.tsx` — its `createCustomer(` call (anchor not pre-verified; locate at task time)
  - `src/modules/jobsPipeline/api/addToPipeline.api.ts:68–:79` — `resolvePersonId` insert object (no `created_via`, no `is_test`)
  - `src/modules/inbox/components/CustomerConversationView.tsx:333–:339` — primary/secondary action props; `:334–:336` — `if (!canLink) return;`
  - `src/modules/inbox/components/ConversationView.tsx:318–:319` — `actionButtonLabel={isUnlinked ? 'Link person' : 'Change link'}`; `:292–:300` — LinkConversationModal with no `onCreateNew`
  - `src/modules/inbox/components/PersonOrdersPanel.tsx:128–:130` — stale `people_email_key` comment; `:133–:141` — "another organization" toast
  Also confirm baseline gates are still: tsc-app 55, lint 10 err/16 warn.

---

## Phase 2: Foundational — provenance stamping (US4 writer half; blocks the CHECK migration and US1's stamp verification)

- [x] **T002 [US4] — CustomerInsert gains optional created_via** (contract C1)
  (APPLIED + grep-confirmed 14 Aug: :19 exact; src-wide `created_via` = 4 lines as predicted
  — 3 pre-existing database.types.ts + this one; single CustomerInsert declaration.)
  File: `src/modules/customers/hooks/useCustomers.ts` (:19)
  Change: `export type CustomerInsert = Omit<Customer, "id" | "created_at" | "updated_at"> &
  { created_via?: "inbox_assisted" | "manual" };`
  Stays the same: `Customer` interface, `createCustomer` body (payload already spreads
  through to the insert), `CustomerUpdate` line untouched. Note: `CustomerUpdate =
  Partial<CustomerInsert>` now *permits* `created_via` on updates, but no update call site
  sends it (`toCustomerUpdate` unchanged) — acceptable; the DB CHECK is the backstop.
  Grep-confirm: `created_via?: "inbox_assisted" | "manual"` → exactly 1 line in file.

- [x] **T003 [US1] — AddToCustomersDialog stamps 'inbox_assisted'** (FR-A2)
  (APPLIED + grep-confirmed 14 Aug: :154 exact-match verbatim; `created_via: "inbox_assisted"`
  = 1 line repo-src-wide; src-wide `created_via` = 5 lines as predicted; 1 createCustomer
  call site in file.)
  File: `src/modules/inbox/components/AddToCustomersDialog.tsx` (:154)
  Change: `createCustomer(toCustomerInsert(values), {` →
  `createCustomer({ ...toCustomerInsert(values), created_via: "inbox_assisted" }, {`
  Stays the same: duplicate handling, `linkTo`, both toasts, the dialog's UI.
  Grep-confirm: `created_via: "inbox_assisted"` → exactly 1 line in repo (this one).

- [x] **T004 [P] [US4] — CreateCustomerDrawer stamps 'manual'** (FR-A2)
  (APPLIED + grep-confirmed 14 Aug: :55 verbatim incl. `as const`; src `created_via` = 6;
  1 createCustomer call.)
  File: `src/modules/customers/components/CreateCustomerDrawer.tsx` (:55)
  Change: `const payload = toCustomerInsert(values);` →
  `const payload = { ...toCustomerInsert(values), created_via: "manual" as const };`
  (adjust to the file's actual usage if payload is built differently — re-grep first).
  Stays the same: everything else in the drawer.

- [x] **T005 [P] [US4] — QuickCreatePersonDialog stamps 'manual'** (FR-A2)
  (APPLIED + grep-confirmed 14 Aug: :60/:65 verbatim; `created_via: "manual"` = 2 lines
  repo-src-wide at the two predicted sites; 1 createCustomer call.)
  File: `src/modules/invoicing/components/QuickCreatePersonDialog.tsx`
  Change: locate its `createCustomer(` call (imports `useCreateCustomer` at :41); spread
  `created_via: "manual"` into the insert payload, same pattern as T004.
  Stays the same: dialog behavior. R3's audit says T003–T005 cover ALL `useCreateCustomer`
  callers — re-grep `useCreateCustomer` repo-wide to confirm still exactly 3 components.

- [x] **T006 [P] [US4] — resolvePersonId stamps 'manual' + is_test:false** (FR-B2, contract C2)
  (APPLIED + grep-confirmed 14 Aug: `created_via: 'manual'` at :76 = sole single-quoted line
  in src; `is_test: false,` at :77 = sole is_test in file; `.insert({` ×2 — people :70, jobs
  shifted :117→:119 as predicted; src `created_via` = 8 total, writer set complete.)
  File: `src/modules/jobsPipeline/api/addToPipeline.api.ts` (:68–:79)
  Change: the `.insert({ organization_id, first_name, last_name, email, phone })` object gains
  `created_via: 'manual'` and `is_test: false`.
  Stays the same: the match-first branch (:52–:64), `classifyHandle`, error handling — only
  the create branch is touched.
  Grep-confirm: `created_via: 'manual'` appears in this file; insert object has 7 keys.

---

## Phase 3: US1 — Assisted create-from-thread (P1) 🎯 MVP

**Goal**: one-action contact creation from any unlinked thread, stamped `inbox_assisted`,
auto-linking all the handle's unlinked conversations. **Independent test**: quickstart US1.

- [x] **T007 [US1] — Grouped view: assisted create becomes the primary action** (FR-A4/A5, contract C3)
  (APPLIED + grep-confirmed 14 Aug: :333/:342/:343 verbatim; `if (!canLink) return;` sole
  occurrence preserved at :339 — linked branch only, T009's target; setAddToCustomersOpen ×2
  (:268/:336), setLinkModalOpen(true) ×2 (:340/:343), 'Link person' ×1. Design note recorded
  at proposal: unlinked branch exits BEFORE the canLink guard — gating it would recreate the
  circular trap for fallback-path unlinked selections; secondary Link-person is now ungated,
  incidentally un-deadening it on the fallback path, same philosophy as T009.)
  File: `src/modules/inbox/components/CustomerConversationView.tsx` (:333–:339)
  Change: for unlinked selections swap primary/secondary —
  `actionButtonLabel={linkedPersonId ? 'Change link' : 'Add to Customers'}`;
  `onActionClick`: linked → `setLinkModalOpen(true)`, unlinked → `setAddToCustomersOpen(true)`;
  `secondaryActionButtonLabel={linkedPersonId ? undefined : 'Link person'}`;
  `onSecondaryActionClick` → `setLinkModalOpen(true)`.
  Stays the same: linked selections' primary stays Change-link with no secondary (spec
  scenario 5); the dialog already receives ALL of the group's ids (`bulkConversationIds`,
  :282) so FR-A3's link-all behavior needs no dialog change; tertiary mute action untouched;
  no gating on mute state anywhere (FR-A5). Do NOT touch the `if (!canLink) return;` line in
  this task — that is T009's single-concern diff.

- [x] **T008 [US1] — Ungrouped view: wire AddToCustomersDialog + action swap** (FR-A4, contract C3)
  (APPLIED + grep-confirmed 14 Aug: import :11, state :69, onCreateNew :302, dialog :307–:316,
  primary ternary :334, secondary :342/:343 — counts verified (AddToCustomersDialog ×2,
  setAddToCustomersOpen ×4, setLinkModalOpen(true) ×2, 'Link person' ×1, onCreateNew ×1).
  PREDICTION-MISS #1 (Giorgi ruling): proposal's grep-2 predicted 5 lines for
  'addToCustomersOpen' but the case-sensitive pattern matches only the bare state variable
  (2 lines: :69, :308) — setter sites are 'setAddToCustomersOpen'. Count the PATTERN, not the
  concept;
  wc -l 386→410, net +24 as predicted. No onCompleted passed — useLinkConversations'
  invalidation flips the view; no canLink concept in this file.)
  File: `src/modules/inbox/components/ConversationView.tsx`
  Change: (a) import `AddToCustomersDialog`; add `const [addToCustomersOpen,
  setAddToCustomersOpen] = useState(false);` (b) render the dialog next to
  LinkConversationModal (:292–:300):
  `open={addToCustomersOpen}`, `onOpenChange={setAddToCustomersOpen}`,
  `prefill={conversation.channel === 'email' ? { email: conversation.primary_handle.toLowerCase().trim() } : { phone: conversation.primary_handle }}`,
  `conversationIds={[conversation.id]}`; (c) actions (:318–:319):
  `actionButtonLabel={isUnlinked ? 'Add to Customers' : 'Change link'}`;
  `onActionClick`: isUnlinked → open dialog, else → `setLinkModalOpen(true)`;
  `secondaryActionButtonLabel={isUnlinked ? 'Link person' : undefined}`;
  `onSecondaryActionClick` → `setLinkModalOpen(true)`; (d) LinkConversationModal gains
  `onCreateNew={() => { setLinkModalOpen(false); setAddToCustomersOpen(true); }}` (parity
  with grouped view).
  Note (R4 ruling): `isUnlinked` already treats `link_state !== 'linked'` (incl. ambiguous)
  as unlinked (:255) — ambiguous threads get the same primary; the dialog's duplicate surface
  is the guard.
  Stays the same: pipeline actions, thread rendering, composer.

---

## Phase 4: US3 — Working Change-link button (P3; ships in Commit C1 so the correction path predates the backfill)

**Goal**: Change-link opens on first click. **Independent test**: quickstart US3.

- [x] **T009 [US3] — Delete the circular canLink gate** (FR-D1, contract C4)
  (APPLIED + grep-confirmed 14 Aug: `if (!canLink) return;` = 0 repo-wide; `canLink` = 3 lines
  unshifted (:164/:253/:275); setLinkModalOpen(true) at :339/:342 (−1 shift); wc -l 415→414.
  All predictions exact.)
  File: `src/modules/inbox/components/CustomerConversationView.tsx` (was :334–:336; T007
  shifts anchors — re-grep `if (!canLink) return;`)
  Change: delete the `if (!canLink) return;` line from the linked-branch onClick. The click
  then sets `linkModalOpen`, which enables the candidate query (:134–:137), and
  `open={linkModalOpen && canLink}` (:253) opens the modal when ids arrive.
  Stays the same: query enablement, `canLink` derivation, modal props. Accepted residual
  (R2): linked person with zero open conversations still no-ops — do not "fix".
  Grep-confirm: `if (!canLink) return;` → 0 matches in repo.

---

## Phase 5: FR-E1 polish (rides Commit C1)

- [x] **T010 [P] — Correct stale index comment + adjacent stale toast** (FR-E1, contract C5, R8)
  (APPLIED + grep-confirmed 14 Aug, after Giorgi's conditional-approval check passed:
  index name `people_org_email_key` confirmed at migration :44, timestamp 20260802220000
  confirmed sole 20260802 migration. Post-apply: stale patterns 0 src-wide; new comment :128,
  `isDuplicateEmailConflict` ×2 (:131/:135), new toast string :136; wc -l 345 unchanged.
  All predictions exact.)
  File: `src/modules/inbox/components/PersonOrdersPanel.tsx` (:128–:130 comment, :133–:141 toast)
  Change: rewrite the comment to state: 23505 here now means a SAME-ORG duplicate under the
  org-scoped unique index `people_org_email_key` (`(organization_id, lower(email))`, migration
  `20260802220000_people_org_scoped_email_unique.sql`); the global `people_email_key` no
  longer exists. Reword the toast description accordingly (e.g. "A customer with this email
  already exists in this organization." — drop "another organization" and "known limitation
  pending a database fix").
  Stays the same: the 23505 detection logic itself (`isCrossOrgEmailConflict` variable may be
  renamed to `isDuplicateEmailConflict` for truthfulness — include in the same diff).

- [ ] **T011 — Commit C1 gate + handoff (Giorgi runs)**
  No file changes. `npx tsc --noEmit -p tsconfig.app.json` → exactly 55 pre-existing errors,
  0 new. `npm run lint` → baseline 10 errors / 16 warnings, nothing new. Grep sweep:
  `created_via` in `src/` → exactly the 4 stamped call sites (T003–T006) + the type (T002).
  No edge-function graphs touched in C1 — no deno gate needed. Giorgi commits **Commit C1**.

- [ ] **T012 [US1] — US1 live verification (Giorgi, disposable-SM-fixture pattern; amended 14 Aug)**
  Session opens with an **end-to-end ingest retest**: fresh gmail fixture address → email the
  SM inbox → sync → auto-create verified (`created_via='inbox_ingest'`, conversation linked)
  AND the person visible on the People page. **Not torn down mid-test** — this person is
  reused as T013's relink target.
  Then quickstart US1 steps 1–7: grouped-view assisted create (read-back:
  `created_via='inbox_assisted'`, all of the handle's conversations linked); ungrouped-view
  phone-handle create; muted thread — action present, works, mute row unchanged; linked
  thread shows no assisted primary; duplicate path links without creating. Record results
  here. **Single teardown at session end** (after T013) per the approved reference-check →
  `DELETE … RETURNING id` → read-back-zero protocol, covering both fixture people and their
  conversations.

- [ ] **T013 [US3] — US3 live verification (Giorgi)**
  Quickstart US3: first click on Change-link opens the modal, candidates load, relink
  completes, view updates — using T012's ingest-retest person as the relink target. Must
  **explicitly confirm the modal opens promptly** (C4-residual ruling: it opens when the
  candidate query resolves; if slow in practice, open-immediately-with-loading is raised as a
  follow-up task, NOT folded into T009). Record results here; T012's session-end teardown
  follows.

---

## Phase 6: US4 — Provenance integrity: CHECK constraint (P4, Commit C2)

**Goal**: DB enforces the `created_via` vocabulary. **Independent test**: quickstart US4.

- [ ] **T014 [US4] — FR-B3 final writer audit (record-only, no edits)**
  Re-sweep beyond R6's preliminary grep before the constraint is applied:
  (a) `from('people')` + `.insert`/`.upsert` repo-wide (expect exactly 3 —
  autoLinkConversation.ts, useCustomers.ts, addToPipeline.api.ts, all now stamping);
  (b) `insert into people` / `INSERT INTO people` across `supabase/` — expect only historical
  apply-once migration records (record each as historical, not a live writer);
  (c) db functions/triggers: grep migrations for `people` inside `create function` /
  `create trigger` bodies — expect the updated_at + activity-log + is_customer triggers
  (UPDATE-side, not INSERT writers);
  (d) `rpc(` calls in `src/` that could write people — expect none.
  Record the writer table (writer → stamp | conscious-NULL) HERE as the FR-B3 artifact.
  The spec's "SM website enquiry path" = GHL webhook → ghlConversationSync → attemptAutoLink
  (already stamped) — record it as such, not a fourth writer.

- [ ] **T015 [US4] — Author the CHECK migration** (FR-B1, contract C6, data-model.md)
  File (new): `supabase/migrations/<YYYYMMDDHHmmss>_people_created_via_check.sql`
  Content: header comment (record-of-truth, applied-by-hand notice, evidence placeholders),
  then exactly:
  ```sql
  alter table people
    add constraint people_created_via_allowed
    check (created_via is null
           or created_via in ('inbox_ingest', 'inbox_assisted', 'manual'))
    not valid;

  alter table people validate constraint people_created_via_allowed;
  ```
  Evidence placeholders for apply time: (1) precondition
  `select created_via, count(*) from people group by 1;` + actual output (must be subset of
  the allowed set + NULL); (2) `select convalidated from pg_constraint where
  conname = 'people_created_via_allowed';` + output; (3) negative probe output (23514).
  No `db push` — file is the record; Giorgi runs it in the Dashboard.

- [ ] **T016 [US4] — Apply migration + evidence (Giorgi, Dashboard SQL editor)**
  Statement order (Dashboard auto-commits each): precondition SELECT (paste output into
  T015's file) → `add constraint … not valid` → `validate constraint` → convalidated
  read-back (paste) → negative probe: an INSERT with `created_via='bogus'` must FAIL with
  23514 (nothing persists on failure — safe on live org; paste the error). Legacy-NULL
  acceptance is proven by VALIDATE succeeding over the existing NULL rows — no positive
  insert probe needed. Giorgi commits **Commit C2** (migration file with pasted evidence).

- [ ] **T017 [US4] — US4 live verification (Giorgi)**
  Quickstart US4 steps 1–2: People-page create → `created_via='manual'`; invoicing
  quick-create → `'manual'`; add-to-pipeline on a person-less conversation →
  `resolvePersonId` row `created_via='manual'`, `is_test=false`. Read-backs recorded here;
  disposable rows torn down per protocol. (Can fold into T012's fixture session if C1 and C2
  are verified together — Giorgi's call.)

---

## Phase 7: US2 — SM historical backfill (P2, Commit C3; requires US1 live as the safety net)

**Goal**: email-shaped gate-passing SM unlinked conversations get created+linked people with
per-row evidence. **Independent test**: quickstart US2.

- [ ] **T018 [US2] — Author backfill-sm-contacts edge function** (contract backfill-sm-contacts.md)
  File (new): `supabase/functions/backfill-sm-contacts/index.ts`
  Implement the contract exactly: `Deno.serve`; POST only (405 otherwise); body
  `{ organization_id, mode: 'dry-run' | 'execute' }` with mode defaulting to `'dry-run'`;
  400 on missing/blank org or unknown mode; service-role client; every query `.eq(
  'organization_id', organizationId)` (AC-001 — org comes ONLY from the body).
  Candidate predicate: `person_id is null` AND `link_state = 'unlinked'` AND
  `primary_handle` contains `@` AND `channel != 'web'`. mutedSet loaded once
  (`inbox_muted_senders`, `unmuted_at is null`). Dry-run: per-handle groups with
  `shouldAutoCreatePerson(handle, mutedSet)` verdicts + existing-person probe + excluded
  counts — NO writes. Execute: serial by (handle, conversation id), call the LIVE
  `attemptAutoLink(admin, id, channelFromShape, handle, orgId, { createIfMissing: true,
  mutedSet })` imported from `../_shared/autoLinkConversation.ts`; derive per-row outcome by
  re-reading the conversation (+ `link_meta.created` distinguishes created vs linked-existing).
  Imports: `_shared/autoLinkConversation.ts`, `_shared/mutedSenderPatterns.ts` —
  **UNMODIFIED** (AC-005; any edit to _shared is out of spec).
  Response shapes: exactly the contract's JSON.

- [ ] **T019 [US2] — Backfill deno gate**
  No file changes. `deno check supabase/functions/backfill-sm-contacts/index.ts` → clean
  (zero-baseline; the imported _shared graphs were clean at T027/Commit B). tsc-app gate
  unaffected (edge functions invisible to tsc). Stop here for Giorgi's diff review of T018.

- [ ] **T020 [US2] — Deploy (Giorgi)**
  `supabase functions deploy backfill-sm-contacts` — **plain deploy, JWT verification stays
  ON** (no `--no-verify-jwt`; only Giorgi's service-role Bearer may invoke it).

- [ ] **T021 [US2] — Dry-run + candidate review (Giorgi) — HARD STOP**
  POST `{ "organization_id": "<SM>", "mode": "dry-run" }` with service-role Bearer. Paste the
  full JSON into `specs/assisted-contact-creation-and-backfill/backfill-evidence.md` (new
  file, created here). Sanity checks: ~30 creatable handles (indicative); zero `web`/phone
  rows among candidates; staff/robot/business handles show `gate_pass: false`.
  **No execute until Giorgi explicitly approves the reviewed list (FR-C4).**

- [ ] **T022 [US2] — Execute (Giorgi, after explicit go)**
  Same POST with `"mode": "execute"`. Paste the per-row results JSON into
  backfill-evidence.md. Any `error` outcomes → stop and assess before proceeding.

- [ ] **T023 [US2] — Read-backs + idempotency re-run (Giorgi)**
  Quickstart US2 step 4 SELECTs (people by created_via; unlinked email-shaped residue =
  gate-fails only; `channel='web'` linked-count unchanged vs pre-backfill; zero phone-handle
  conversations gained person_id) — outputs into backfill-evidence.md. Then re-POST execute:
  expect `people_created: 0`, all rows `skipped_already_linked` (spec US2 scenario 4) —
  output into backfill-evidence.md.

- [ ] **T024 [US2] — Delete the deployed function (Giorgi)**
  `supabase functions delete backfill-sm-contacts`. The SOURCE stays in the repo as the
  record of what ran (mirrors migration-file discipline); only the deployment is removed.

- [ ] **T025 — Commit C3 handoff (Giorgi)**
  Gates: tsc-app 55 / lint 10-16 unchanged (no src/ edits in this phase — confirm with
  `git status`); deno check clean (T019). Giorgi commits **Commit C3** (function source +
  backfill-evidence.md + this tasks.md's recorded results).

---

## Dependencies & Execution Order

- Phase 2 (T002–T006) blocks: T003 needs T002 (same type); T004–T006 independent [P] after
  T002. All of Phase 2 blocks T016 (constraint applied only after writers stamp — order is
  belt-and-braces; NULL stays legal regardless, R7).
- T007 → T009 sequential (same file, single-concern diffs). T008, T010 independent [P].
- T011 (Commit C1) requires T002–T010. T012–T013 verification after C1 is live.
- Phase 6: T014 → T015 → T016 → T017 sequential. Can start any time after Phase 2; lands as
  Commit C2 after Commit C1 by convention.
- Phase 7 strictly after US1 is live (T012 passed — the assisted path is the safety net for
  gate-excluded handles) and sequential throughout: T018 → T019 → T020 → T021 → **approval**
  → T022 → T023 → T024 → T025.
- MVP = Phases 1–5 (Commit C1): US1 + US3 delivered and verifiable without any DB or backend
  change.

## Parallel guidance

[P]-eligible groups (different files): {T004, T005, T006} after T002; {T008, T010} alongside
the T007→T009 chain. Under Giorgi's diff-approval protocol these still execute one reviewed
diff at a time — [P] only means no ordering constraint between them, so review order is free.

## Verification gates (every commit)

- `npx tsc --noEmit -p tsconfig.app.json` → exactly **55** pre-existing errors, 0 new (bare
  `npx tsc --noEmit` checks nothing).
- `npm run lint` → baseline **10 errors / 16 warnings**, nothing new.
- `deno check` on touched edge-function graphs → zero-baseline (proof-send untouched this
  feature; if checked anyway its verbatim 4-error baseline applies).
- Grep-confirm on disk after every edit; stop on failed exact match.
- Giorgi runs all gates, git operations, deploys, Dashboard SQL, and function invocations.
