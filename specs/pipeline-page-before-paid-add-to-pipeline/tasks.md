# Tasks: Pipeline Page (Before Paid) + Add to Pipeline

**Input**: Design documents from `specs/pipeline-page-before-paid-add-to-pipeline/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)

**Tests**: No automated test tasks — the repo has no UI test harness and the spec's verification
gates are `tsc -p tsconfig.app.json` (59-error baseline), lint, and the manual script in
`quickstart.md`. Verification tasks appear in Phase 6.

**Organization**: Grouped by user story (US1 board, US2 exits, US3 intake) after a foundational
phase both boards and intake depend on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (board), US2 (exits), US3 (add-to-pipeline)

---

## Phase 1: Setup

No setup tasks — existing app, no new dependencies, module directories are created by their first
file tasks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Everything depends on this phase (FR-012: types first).**

- [X] T001 Extend `src/shared/types/database.types.ts` with the `jobs` table entry (Row/Insert/Update/Relationships) between `invoices` (ends ~line 1691) and `memorials` (~line 1692). Field list and check-constraint values from `data-model.md §1` (include `source` value `'sms'`). Relationships per file convention (`data-model.md §5`): `jobs_organization_id_fkey → organizations`; `jobs_person_id_fkey` ×3 (`customer_scores`, `customers`, `people` — mirror `enquiries_person_id_fkey` at lines 525–587); `jobs_conversation_id_fkey → inbox_conversations`; `jobs_enquiry_id_fkey → enquiries`.
- [X] T002 Same file (sequential after T001): add `job_id: string | null` to `orders` Row (alphabetical slot between `is_test` and `latitude`) and `invoices` Row (between `issue_date` and `locked_at`), `job_id?: string | null` in both Insert/Update, plus `orders_job_id_fkey → jobs` and `invoices_job_id_fkey → jobs` Relationships entries. Do NOT touch any view types.
- [X] T003 Gate: `npx tsc -p tsconfig.app.json` → exactly the 59 pre-existing errors, zero new (types file is documentation parity; nothing consumes it via the `any`-typed client, so any new error means a syntax slip).
- [X] T004 [P] Create `src/modules/jobsPipeline/types/jobsPipeline.types.ts` — exact contents from `data-model.md §3` (`JobStage`, `BEFORE_PAID_STAGES`, `BeforePaidStage`, `JobExitReason`, `PrePaidExitReason`, `JobSource` incl. `'sms'`, `JobPersonSummary`, `JobConversationSummary`, `PipelineJob`, `JobInvoiceSummary`).
- [X] T005 [P] Create `src/modules/jobsPipeline/utils/display.ts` — `getJobDisplayName(job)` (chain per `data-model.md §4`: person first/last → email → phone → conversation `primary_handle` → '—'), `mapChannelToSource(channel)` (`email→email`, `whatsapp→whatsapp`, `ghl→ghl`, `web→website`, `sms→sms`, else `manual`), handle classifier `classifyHandle(handle)` (contains `@` → `{kind:'email', value: trimmed lowercase}`; else digits ≥7 → `{kind:'phone', last10}`; else `{kind:'unknown'}`), `normalizeEmail`/`phoneLast10` helpers copied from the matchers in `src/modules/inbox/components/AddToCustomersDialog.tsx:46-48`.
- [X] T006 [P] Create `src/modules/jobsPipeline/api/jobsPipelineKeys.ts` — key factory under the `['jobsPipeline', …]` namespace: `active(orgId)`, `invoiceSummaries(orgId)`, `exited(orgId)`, `conversationJob(conversationId)`. Never `['jobs', …]` (taken by legacy `src/modules/jobs/hooks/useJobs.ts`).
- [X] T007 Create `src/modules/jobsPipeline/api/jobsPipeline.api.ts` implementing `contracts/jobs-pipeline-data.md` exactly: `fetchActiveJobs` (Q1, embedded `person:people(...)` + `conversation:inbox_conversations(...)`), `fetchJobInvoiceSummaries` (Q2, reduce to `Map<jobId, JobInvoiceSummary>` skipping `deleted_at` rows, `Number(amount)`), `fetchExitedJobs` (Q3, `exited_at desc`), `fetchConversationJob` (Q4, `.maybeSingle()`), `moveJobStage` (M1 — validate one-step move within `BEFORE_PAID_STAGES`; fresh invoice probe before `invoiced`; payload `{ stage }` only), `exitJob` (M2 — payload `{ exit_reason, exited_at: now, wake_at: dormant ? wakeAt : null }`). Depends on T004–T006. Supabase client from `@/shared/lib/supabase`.
- [X] T008 Create `src/modules/jobsPipeline/hooks/`: `useJobsPipeline.ts` (Q1+Q2 → view-model: jobs grouped by stage into the three columns + invoice map; `useOrganization()` from `@/shared/context/OrganizationContext`, disabled until org resolves), `useExitedJobs.ts` (Q3), `useConversationJob.ts` (Q4), `useJobMutations.ts` (`useMoveJobStage`, `useExitJob` with invalidations per contract; toast on gate rejection: "No invoice linked to this job yet"). Depends on T007.
- [X] T009 Create `src/modules/jobsPipeline/index.ts` — export `JobsPipelinePage` (stub page file `src/modules/jobsPipeline/pages/JobsPipelinePage.tsx` rendering a placeholder), `useAddToPipeline` (added in T019), `useConversationJob`. Keeps the app compiling while UI lands.

**Checkpoint**: `npx tsc -p tsconfig.app.json` clean vs baseline; module compiles unused.

---

## Phase 3: User Story 1 — See and work the pre-paid pipeline (P1) 🎯 MVP

**Goal**: Three-column Before-Paid board at `/dashboard/inquiries`, cards, moves, Invoiced gate.
**Independent Test**: spec.md US1 — SM read-only: 43 jobs in correct columns, org-scoped; moves +
gate in a test org.

- [X] T010 [P] [US1] Create `src/modules/jobsPipeline/components/PipelineJobCard.tsx` — gardens styling copied from `src/modules/inquiries/components/InquiryCard.tsx:36-39,119-120` (`text-gardens-tx`, `border-gardens-bdr`, hover `bg-gardens-sidebar-hover/60`); shows `getJobDisplayName`, `stage_status` Pill (from `@/shared/components/gardens`; tolerate null/free text — `pending`, `uncontacted`), created date, invoice total via `formatGbpDecimal` from `@/shared/lib/formatters` (Invoiced column only, when summary present). Card click → `navigate('/dashboard/inbox?conversation=' + conversation.id)`; not clickable when `conversation` null. Props: `job`, `invoiceSummary?`, `onMoveForward?`, `onMoveBack?`, `onExit`, `moveForwardDisabled?` + `moveForwardDisabledReason?` (tooltip "Needs a linked invoice").
- [X] T011 [P] [US1] Create `src/modules/jobsPipeline/components/PipelineColumn.tsx` — column shell per `src/modules/inquiries/components/InquiriesBoard.tsx:44-54` (`border-gardens-bdr bg-gardens-page/60`, header `bg-gardens-sidebar/40 text-gardens-txs` with count badge); renders cards; empty-state text.
- [X] T012 [US1] Create `src/modules/jobsPipeline/components/PipelineBoard.tsx` — `lg:grid-cols-3` grid of Enquired/Quoted/Invoiced from `useJobsPipeline`; wires move handlers: forward from Quoted disabled unless `invoiceSummaries.get(job.id)?.count > 0`; loading/error/empty wrapper (pattern: `src/modules/inquiries/components/InquiriesBoardState.tsx`). Depends on T010, T011.
- [X] T013 [US1] Flesh out `src/modules/jobsPipeline/pages/JobsPipelinePage.tsx` — heading "Pipeline" (`font-head text-xl text-gardens-tx tracking-tight`, matching `InquiriesPage.tsx:23-24`), renders `PipelineBoard`; leave a view-switch slot for US2's Exited toggle. Depends on T012.
- [X] T014 [US1] Cutover in `src/app/router.tsx`: remove the inquiries lazy import (lines ~9-11), add static `import { JobsPipelinePage } from "@/modules/jobsPipeline";`, change `<Route path="inquiries" …>` (lines ~82-89) to `element={<JobsPipelinePage />}` (drop the Suspense wrapper — module is statically imported like every other route). Do NOT touch `path="pipeline"` or `path="jobs"` routes. `src/modules/inquiries/` files stay untouched.
- [X] T015 [US1] `src/components/layout/Sidebar.tsx` lines ~160-169: relabel the 'Inquiries' NavItem to 'Pipeline', keep `to: '/dashboard/inquiries'`, drop `ai: true` (keep the existing icon/slot).

**Checkpoint**: Board loads at `/dashboard/inquiries`; sidebar says Pipeline; moves work in a
test org; gate blocks Invoiced without an invoice. US1 demoable.

---

## Phase 4: User Story 2 — Exit a job from the pipeline (P2)

**Goal**: Exit modal (Lost/Closed/Dormant + required wake date) and filterable Exited list.
**Independent Test**: spec.md US2 — exit via each reason in a test org; dormant blocked without
date; job leaves board and appears in Exited view; no delete affordance anywhere.

- [X] T016 [P] [US2] Create `src/modules/jobsPipeline/components/ExitJobModal.tsx` — shadcn `Dialog` from `@/components/ui/dialog`; radio group Lost/Closed/Dormant (`PrePaidExitReason`); date picker rendered and required only for Dormant; confirm button disabled until valid; calls `useExitJob` (M2); on success closes + toast.
- [X] T017 [P] [US2] Create `src/modules/jobsPipeline/components/ExitedJobsList.tsx` — list from `useExitedJobs`, ordered `exited_at desc`; client-side exit-reason filter (All/Lost/Closed/Dormant — filter-bar style per `src/modules/inquiries/components/InquiriesFilters.tsx`); columns: display name (fallback `primary_handle`), reason, exited date, wake date (dormant); row click → conversation deep link like the card. NO delete affordance. Standalone component (parent-spec sanctioned scope cut = don't render it; board unaffected).
- [X] T018 [US2] Wire into `JobsPipelinePage.tsx`: Active | Exited segmented control in the view-switch slot; card Exit button (from T010's `onExit`) opens `ExitJobModal`. Depends on T013, T016, T017.

**Checkpoint**: Exits write `exit_reason`/`exited_at`(/`wake_at`) and satisfy both DB check
constraints; exited jobs leave the board and appear filtered in the Exited view.

---

## Phase 5: User Story 3 — Add an inbox conversation to the pipeline (P3)

**Goal**: One-click intake from inbox conversations with no job.
**Independent Test**: spec.md US3 — in a test org: (a) linked-person conversation, (b) no person +
unknown handle → person created, (c) no person + known org handle → person reused; conversation
linked; job appears Enquired/uncontacted.

- [X] T019 [US3] Create `src/modules/jobsPipeline/api/addToPipeline.api.ts` implementing `contracts/add-to-pipeline.md` exactly: (1) concurrency re-check via `fetchConversationJob` → abort "Already in pipeline"; (2) person resolve — use `conversation.person_id`, else `classifyHandle` + org-scoped `people` fetch (`.eq('organization_id', …)`, NEVER global) matched by `normalizeEmail`/`phoneLast10`, else insert person (`first_name` = email local-part or raw handle, `last_name: ''`, classified email/phone, `organization_id`); (3) insert job `{ organization_id, person_id, conversation_id, source: mapChannelToSource(channel), stage: 'enquired', stage_status: 'uncontacted' }`; (4) if person was null at entry, update conversation `{ person_id, link_state: 'linked', link_meta: {} }` — payload MUST NOT contain `updated_at`. Partial-failure toasts per contract.
- [X] T020 [US3] Add `useAddToPipeline()` to `src/modules/jobsPipeline/hooks/useJobMutations.ts` — mutation over T019 with invalidations: `conversationJob(conversation.id)`, `active(orgId)`, and `inboxKeys.all` (import from `@/modules/inbox` public surface if exported; else the literal `['inbox']` root key — check `src/modules/inbox/index.ts` first); success toast with "View pipeline" → `/dashboard/inquiries`. Confirm exported from `src/modules/jobsPipeline/index.ts` (with `useConversationJob`).
- [X] T021 [US3] Wire into `src/modules/inbox/components/ConversationView.tsx`: `useConversationJob(conversation.id)` + `useAddToPipeline()` imported from `@/modules/jobsPipeline` (public surface only); pass `secondaryActionButtonLabel="Add to pipeline"` / `onSecondaryActionClick` to the existing `ConversationHeader` (slots at `ConversationHeader.tsx:9-15,39-73`) only when the job probe resolved to null (hide while loading or when job exists). Pass `organization_id` explicitly from `useOrganization()` (the `InboxConversation` TS type omits it).

**Checkpoint**: All three stories functional; full demo path per parent spec §8.1.

---

## Phase 6: Verification & Polish

- [ ] T022 `npx tsc -p tsconfig.app.json` → 59 baseline errors, zero new; `npm run lint` clean on all touched files. (`vite build` does not typecheck — never rely on it.)
- [ ] T023 [P] Grep discipline (parent spec §7 — verify on disk): no `updated_at` in any `inbox_conversations` update payload in the new code; no `.delete()` on `jobs` anywhere; no `people` query in `src/modules/jobsPipeline/` missing `.eq('organization_id'`; no import from `@/modules/inquiries|customers/…` internals in the new module; router still has `path="pipeline"` and `path="jobs"` untouched.
- [ ] T024 Manual test-org run per `quickstart.md` Verification §2 (NEVER Churchill/Sears Melvin — AC-004): all three US3 person cases, moves both directions, Invoiced gate off→on, three exit reasons (dormant date required), Exited filter, deep link `/dashboard/inbox?conversation=<id>` from card click (must open the card's conversation group in the grouped Customers view, not the most recent thread; also verify a plain `/dashboard/inbox` visit still auto-selects the most recent — the no-param regression contract).
- [ ] T025 SM production read-only check (SC-001): board renders 43 jobs (23 Enquired / 20 Quoted), `pending` pills, names with `primary_handle` fallback where person data is sparse; click-through opens the right conversation. NO writes.
- [ ] T026 Update `specs/status_v2-implementation-spec.md` header status line (§4–5 app-build items → done for Before-Paid + Add-to-pipeline) and note the R3 legacy-`jobs`-module breakage on the §6 logged list. One-concern-per-commit throughout (parent spec §7).

---

## Dependencies & Execution Order

- **Phase 2 blocks everything**: T001→T002→T003 (one file, then gate); T004/T005/T006 in parallel; T007 after T004–T006; T008 after T007; T009 after T008.
- **US1 (Phase 3)**: T010/T011 parallel after Phase 2 → T012 → T013 → T014 → T015. MVP checkpoint.
- **US2 (Phase 4)**: T016/T017 parallel (T016 needs T008's `useExitJob`; T017 needs T008's `useExitedJobs`) → T018 (needs T013).
- **US3 (Phase 5)**: T019 after Phase 2 (independent of US1/US2 UI) → T020 → T021. Can run in parallel with Phases 3–4 by a second dev; solo order is 3→4→5 (priority order; US2's exited list is the sanctioned scope cut if Monday is tight).
- **Phase 6 last**: T022 before T024/T025; T023 parallel with T024.

## Parallel Example: after Phase 2 checkpoint

```bash
# Parallel foundation files:
Task: "T004 types/jobsPipeline.types.ts"   Task: "T005 utils/display.ts"   Task: "T006 api/jobsPipelineKeys.ts"
# Parallel across stories (two devs):
Dev A: T010→T015 (board + cutover)         Dev B: T019→T020 (intake api/hook; T021 waits for inbox file to be free)
```

## Notes

- `ConversationView.tsx` is the only file shared with an existing feature — T021 touches it alone.
- `database.types.ts` tasks (T001/T002) are sequential edits to one 5341-line file; keep them one commit.
- Commit per task or logical group; explicit `git add <path>` (parent spec §7); Giorgi pushes/merges.
