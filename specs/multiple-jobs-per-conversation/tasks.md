# Tasks: Multiple jobs per conversation — job picker + job-scoped sidebar

**Input**: Design documents from `specs/multiple-jobs-per-conversation/`
**Prerequisites**: plan.md, spec.md (FR-7 as amended 2026-08-09), research.md, data-model.md,
contracts/components.md, quickstart.md

**Tests**: No automated test tasks — spec verification is `tsc` baseline (exactly 55) +
`quickstart.md` manual acceptance. All tasks are frontend-only inside `src/modules/inbox/`
except the additive `ConversationHeader` prop. **Scope fence**: no task may touch
`supabase/`, `jobsPipeline.api` signatures, `autoAdvanceStage`, or schema.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Record pre-change baseline: `npx tsc --noEmit -p tsconfig.app.json` must report
      exactly 55 errors and `npm run lint` must be clean on `feature/multi-job-picker`
      before any edit. Paste both counts into the PR description later.

---

## Phase 2: Foundational (blocks all stories)

- [ ] T002 [P] Create `src/modules/inbox/utils/jobPickerLabels.ts` — pure functions per
      contracts §2 / data-model: `effectiveJobId(jobs, selectedJobId)` (FR-2 rule, the ONLY
      implementation), `buildOrdersByJobId(orders)` (skip `job_id === null`, keep newest per
      job), `buildJobPickerEntries(jobs, ordersByJobId)` (Job-N by `created_at` asc,
      tie-break `id` asc; label `"Job N — <orderLabel> — <stageLabel>"` /
      `"Job N — <stageLabel>"` using `formatOrderTypeLabel` + `formatStageLabel`).
- [ ] T003 [P] Add additive optional prop `pipelineHintSlot?: React.ReactNode` to
      `src/modules/inbox/components/ConversationHeader.tsx` — when set, renders in place of
      the `pipelineHintLabel` chip (`:51-55`); when unset, behavior byte-identical.
      `ConversationView` (flat inbox) needs zero edits.
- [ ] T004 Create `src/modules/inbox/components/JobPicker.tsx` per contracts §1 (depends
      T002): props `{ jobs, ordersByJobId, selectedJobId, onSelectJob }`; renders only at
      `jobs.length >= 2` is the PARENT's responsibility — component itself just renders the
      dropdown. Trigger chip reuses the `pipelineHintLabel` chip classes; entries newest
      first (fetch order, no re-sort); exited entries get the Exited pill and stay
      selectable; built on existing shadcn dropdown primitives.

**Checkpoint**: foundation compiles (tsc still exactly 55) — story work can begin.

---

## Phase 3: User Story 1 — Switch between jobs; job-scoped sidebar + Unassigned (P1) 🎯 MVP

**Goal**: picker in header; sidebar scoped to selected job; orphan orders visible in
Unassigned subsection (FR-1..4, FR-7 amended).
**Independent Test**: quickstart US-1 (read-only, SM 4-job person) + FR-7 orphan check
(ORD-000232 visible and clickable).

- [ ] T005 [US1] `src/modules/inbox/pages/UnifiedInboxPage.tsx` (contracts §6): add
      `selectedJobId` state; reset to `null` on `activeConversationIds` key change; reset
      `selectedOrderId` when `selectedJobId` changes; thread
      `selectedJobId`/`onSelectJob={setSelectedJobId}` into `CustomerConversationView`
      (`:1306`) and `selectedJobId` into `PersonOrdersPanel` (`:1350`).
- [ ] T006 [US1] `src/modules/inbox/components/CustomerConversationView.tsx` (contracts §4):
      accept `selectedJobId`/`onSelectJob`; replace `latestActiveJob` (`:118`) with
      `effectiveJob` via `effectiveJobId`; build `ordersByJobId` from
      `useOrdersByPersonId(linkedPersonId)`; header wiring — `jobs.length >= 2` →
      `pipelineHintSlot={<JobPicker …/>}`, else today's `pipelineHintLabel` string from
      `effectiveJob` (D2: 0–1 jobs pixel-identical to current).
- [ ] T007 [US1] `src/modules/inbox/components/PersonOrdersPanel.tsx` — display scoping
      (contracts §5, first slice; same file as T009 → sequential): accept `selectedJobId`;
      derive `effectiveJob` via shared `effectiveJobId` (replaces `:52`); **swap the
      `useOrdersByJobId` argument** (`:69`) to `effectiveJob?.id ?? null` (FR-4 mechanism —
      no new client-side filtering for the job list); rendered list + `OrderContextSummary`
      switch to `jobOrders`; add the **Unassigned subsection** (FR-7 amended):
      `orders.filter(o => o.job_id === null)` below the job-scoped list in every selection
      state, own `SECTION_LABEL` heading, same `InboxOrderListRow` rows, selectable for
      viewing, no create actions; empty-state guard `:181` → `!personId && !effectiveJob`;
      `onOrdersCountChange` (`:83`) → `jobOrders.length + unassignedOrders.length ||
      (effectiveJob ? 1 : 0)`; zero-jobs conversations keep today's person-wide path.
- [ ] T008 [US1] Verify: `npx tsc --noEmit -p tsconfig.app.json` exactly 55; `npm run lint`;
      quickstart US-1 steps 1–4 (read-only) + FR-7 orphan check + single-job/zero-jobs edge
      cases (D2/SC-003 visual parity).

**Checkpoint**: picker + scoped sidebar demoable read-only — MVP.

---

## Phase 4: User Story 2 — Create order/invoice against selected job (P1)

**Goal**: creation targets the selected job explicitly (FR-5); D6/D7 gating.
**Independent Test**: quickstart US-2 (disposable SM fixture — live-org writes need
per-run approval; Stripe invoice void in cleanup).

- [ ] T009 [US2] `PersonOrdersPanel.tsx` — creation targeting (contracts §5, second slice;
      depends T007): `CreateOrderDrawer.initialJobId` (`:279`) and
      `CreateInvoiceDrawer.jobId` (`:290`) → `effectiveJob?.id ?? null`; `handleNewOrder`
      guard (`:91`) → `effectiveJob` + active check; `jobAction` guard (`:155`) → creation
      buttons only when `effectiveJob && !effectiveJob.exit_reason` (D7 — exited selection
      shows orders, no buttons; unassigned subsection never gets create actions); S5 probe
      (`:61`) → `effectiveJob.conversation_id` (D6). No drawer/API/automation changes.
- [ ] T010 [US2] Verify: quickstart US-2 fixture run (⚠️ requires explicit user approval —
      live SM writes + Stripe void in cleanup; record created ids + `DELETE…RETURNING`
      output in quickstart run record). SELECTs confirm SC-002 (order + invoice carry the
      selected job's id) and single-job regression (Job-2-only phase).

**Checkpoint**: creation provably job-targeted.

---

## Phase 5: User Story 3 — New job lands selected (P2)

**Goal**: FR-6 — after "New job", picker selects the created job.
**Independent Test**: quickstart US-3 (same fixture run as T010).

- [ ] T011 [US3] `CustomerConversationView.tsx` (depends T006): "New job" click (`:296-302`)
      → `addToPipeline.mutate(args, { onSuccess: (r) => onSelectJob(r.jobId) })` using the
      existing `AddToPipelineResult.jobId`; `useAddToPipeline` hook itself unmodified
      (hook-level invalidation + toast still fire).
      **Review checklist (added at T005 approval)**: verify the FR-6 post-create sequence —
      select new job → the page's job-switch effect cascades `selectedOrderId` to null →
      `onOrderCreated` sets the new order — does not leave the created order deselected or
      race (the cascade must not fire AFTER a subsequent order selection lands).

**Checkpoint**: US-3 verifiable inside the T010 fixture run.

---

## Phase 6: User Story 4 — Exited jobs reachable (P2)

**Goal**: exited jobs selectable with Exited pill; display-only when selected (US-4 + D7).
No new code expected — behavior emerges from T004 (pill, selectable) + T007 (orders shown) +
T009 (buttons gated); this phase is verification-only.

- [ ] T012 [US4] Verify: quickstart US-4 + all-jobs-exited edge case (default = newest job,
      orders visible, no creation buttons). If any gap is found, fix belongs in the
      originating task's file — do not add new surfaces.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T013 Full quickstart edge-case + regression sweep (flat-view parity, selected-job
      no-orders empty state, no `updated_at` in any touched payload — confirm no
      `inbox_conversations` writes were added); final `npx tsc --noEmit -p tsconfig.app.json`
      **exactly 55** (SC-004) + `npm run lint`; update plan.md Progress Tracking; stage
      diff review before any merge to `staging` (PR targets `staging` per repo convention).

---

## Backlog (recorded post-T010/T012, 2026-08-10 — out of this feature's scope)

- B1: Pipeline exit does not invalidate the inbox conversations-jobs query — exited state
  reached the inbox picker/panel only after hard refresh during D7/US-4 verification.
  Candidate fix: `useExitJob.onSuccess` additionally invalidates
  `jobsPipelineKeys.conversationJobs` (or the inbox root), mirroring `useAddToPipeline`.
- B2: OQ-3 evidence from live teardown: order↔invoice linkage is `orders.invoice_id`
  (FK `orders_invoice_id_fkey`, enforced, no cascade); `invoices.order_id` stays null.

---

## Dependencies & Execution Order

- T001 → T002/T003 [P together] → T004 → stories.
- US1: T005, T006 (parallel-capable after T004, different files) → T007 → T008.
- US2: T009 (after T007 — same file) → T010 (needs user approval).
- US3: T011 (after T006; verified within T010's fixture).
- US4: T012 (after T009).
- Polish: T013 last.
- Same-file chains (no [P]): T007 → T009 (`PersonOrdersPanel.tsx`); T006 → T011
  (`CustomerConversationView.tsx`).

## Implementation Strategy

MVP = Phases 1–3 (read-only demoable, zero live-data risk). Phases 4–6 add creation
targeting and are verified in one fixture run (T010) to minimize live-SM writes. Commit per
task or logical group; every commit keeps tsc at exactly 55.
