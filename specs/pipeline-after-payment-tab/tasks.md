# Tasks: Pipeline After-Payment Tab

**Input**: Design documents from `/specs/pipeline-after-payment-tab/`
**Prerequisites**: plan.md, spec.md, research.md (D1–D7), data-model.md, contracts/after-paid-board.md, quickstart.md

**Tests**: No automated test suite exists in this repo — verification is the tsc gate plus
the manual walkthroughs in `quickstart.md`. Verification tasks reference quickstart
sections; they are real tasks, not optional.

**Organization**: Tasks are grouped into the five **one-concern commit units** from plan.md
Phase 2. Each unit = one commit by Giorgi. Units map to user stories: Unit 3 delivers US1+US4
(P1, Friday demo), Unit 4 delivers US2 (P2), Unit 5 delivers US3 (P3).

## Workflow rules (apply to every task)

- **Per-edit approval**: propose the diff, wait for approval, then apply. No unapproved edits.
- **No `git add` / `git commit` by Claude Code** — Giorgi stages and commits, one unit per commit.
- **tsc gate closes every unit**: `npx tsc --noEmit -p tsconfig.app.json` → exactly the 55
  baseline errors, zero new (quickstart Gate 0). A unit is not done until its gate task passes.
- **OD-1 is NOT in this feature**: `fetchActiveJobs`'s `paid_at` gate stays untouched.
  Post-demo, separate approval (plan.md OD-1). Do not "fix it while you're in the file."
- All work in `src/modules/jobsPipeline/` only. `gardens-*` tokens only, no new visual language.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency within the unit — may be proposed together.
- **[Story]**: US1–US4 from spec.md; FND = foundational, no story.

---

## Unit 1 — Foundations (Commit 1: "After-paid stage axis: types, key, fetch, hook")

**Purpose**: All new data-path pieces, zero behavior change to anything rendered.
**Blocks**: everything else.

- [X] T001 [FND] Add the after-paid axis to
  `src/modules/jobsPipeline/types/jobsPipeline.types.ts`: `AFTER_PAID_STAGES = ['confirmed',
  'in_production', 'fixed', 'complete'] as const` (sibling directly below
  `BEFORE_PAID_STAGES`, which MUST NOT change), `AfterPaidStage` derived type, and
  `PostPaidExitReason = 'on_hold' | 'cancelled'` next to `PrePaidExitReason`. Mirror the
  existing comment style (data-model.md "Stage axes").
- [X] T002 [P] [FND] Add `afterPaid: (organizationId: string | null) => ['jobsPipeline',
  'afterPaid', organizationId] as const` to
  `src/modules/jobsPipeline/api/jobsPipelineKeys.ts` (after `active`).
- [X] T003 [FND] Add `fetchAfterPaidJobs(organizationId)` to
  `src/modules/jobsPipeline/api/jobsPipeline.api.ts` as a sibling of `fetchActiveJobs`, per
  the query contract in contracts/after-paid-board.md: same `JOB_SELECT`,
  `.eq('organization_id', …)`, `.is('exit_reason', null)`, `.in('stage',
  AFTER_PAID_STAGES)`, `.order('created_at', { ascending: false })`. **No `paid_at`
  predicate** (FR-004/FR-005). `fetchActiveJobs` itself: zero changes (D1). Depends on T001.
- [X] T004 [FND] Create `src/modules/jobsPipeline/hooks/useAfterPaidPipeline.ts` per the
  hook contract: queries `jobsPipelineKeys.afterPaid(orgId)` → `fetchAfterPaidJobs` and
  **reuses** `jobsPipelineKeys.invoiceSummaries(orgId)` → `fetchJobInvoiceSummaries`
  (shared cache entry); groups rows into `Record<AfterPaidStage, PipelineJob[]>` with all
  four keys always present; `enabled: !!organizationId`; returns
  `{ columns, invoiceSummaries, isLoading, isError, error }` mirroring
  `useJobsPipeline.ts`'s shape. `useJobsPipeline.ts`: zero changes. Depends on T001–T003.
- [X] T005 [FND] **Gate**: run `npx tsc --noEmit -p tsconfig.app.json` — 55 baseline, zero
  new (quickstart Gate 0). Confirm `git diff` shows no change to `useJobsPipeline.ts` or
  `fetchActiveJobs`. → Giorgi commits Unit 1.

**Checkpoint**: new data path exists, nothing visible changed anywhere in the app.

---

## Unit 2 — StageBoard extraction (Commit 2: "Extract StageBoard; before board unchanged")

**Purpose**: Fulfil AC-002 (no copy-pasted board) and FR-013 (label consolidation).
**⚠️ This is the only unit that touches the working before-paid board two days before the
demo.** Verification is a real runtime parity check, not tsc alone. **Fallback if parity
fails: Giorgi reverts this commit; do not patch forward under demo pressure** — the P1 path
can be rebuilt on an untouched `PipelineBoard` afterwards if it comes to that.

- [X] T006 [FND] Create `src/modules/jobsPipeline/components/StageBoard.tsx` — the
  presentational board per the `StageBoard` contract: props `{ stages, columns,
  invoiceSummaries, isLoading, isError, error, onMove?, isMoving?, moveForwardGate?,
  cardWarning?, onExitJob?, emptyState }`. Lift the loading-skeleton, error-panel,
  empty-state, and column-map markup from `PipelineBoard.tsx` **verbatim** (same
  `gardens-*` classes); column labels via `formatStageLabel(stage)`; grid + skeleton column
  count from `stages.length` (3 → `lg:grid-cols-3`, 4 → `lg:grid-cols-4`); first column no
  move-back, last no move-forward; forward button disabled state/reason from
  `moveForwardGate`; card warning pill from `cardWarning` (prop added in T012, pass
  nothing until then). Depends on T005.
- [X] T007 [FND] Convert `src/modules/jobsPipeline/components/PipelineBoard.tsx` into a
  thin container: keep `useJobsPipeline()` + `useMoveJobStage()` + the `move()` helper and
  invoice-gate logic exactly as-is, render `<StageBoard stages={BEFORE_PAID_STAGES} …>` with
  `moveForwardGate` returning `'Needs a linked invoice'` when the next stage is `invoiced`
  and the job has no invoice summary. **Delete the local `STAGE_LABEL` record** (line 13) —
  labels now come from `formatStageLabel` (FR-013; outputs verified identical in research
  D3). Existing props contract with `JobsPipelinePage` (`onExitJob`) unchanged. Depends on T006.
- [X] T008 [FND] **Gate**: tsc (Gate 0) passes, 55 baseline zero new.
- [ ] T009 [FND] **Runtime parity check** (quickstart Gate 1 — Giorgi drives, live orgs
  read-only): with `npm run dev` as Sears Melvin, verify against the before-paid board:
  (a) three columns Enquired / Quoted / Invoiced with counts 21 / 17 / 2;
  (b) move buttons present and correctly bounded (no back on Enquired, no forward on Invoiced);
  (c) invoice gate: a quoted job without an invoice shows the disabled forward button with
  "Needs a linked invoice";
  (d) exit (door) buttons open the exit modal;
  (e) card invoice totals still render on invoiced cards;
  (f) Exited tab and due-dormant badge unchanged;
  (g) `git diff staging -- src/modules/jobsPipeline/hooks/useJobsPipeline.ts` is empty and
  `fetchActiveJobs` is untouched.
  **If any check fails → revert the Unit 2 changes entirely; do not patch forward.**
  → Giorgi commits Unit 2.

**Checkpoint**: before board pixel/behavior-identical, now rendered through StageBoard.

---

## Unit 3 — 🎯 P1: After payment tab visible (Commit 3: "After payment tab") — US1 + US4

**Goal**: The Friday demo. Three tabs; 8 Sears Melvin paid customers visible under
Confirmed; tab totals; no moves/exits on the new board yet.
**Independent Test**: quickstart "P1 — the demo path" in full.

- [X] T010 [US1] Create `src/modules/jobsPipeline/components/AfterPaidBoard.tsx` — thin
  container per contract: `useAfterPaidPipeline()` → `<StageBoard
  stages={AFTER_PAID_STAGES} …>`; **no `onMove`** yet (cards render without arrows — moves
  arrive in Unit 4); `onExitJob` prop accepted and passed through but the page may wire it
  in Unit 5; `cardWarning` = `'Not marked paid'` iff `job.paid_at === null` (FR-005);
  empty state copy: title "No jobs after payment yet", hint "Jobs appear here once
  confirmed after payment." (match existing empty-state tone). Depends on T009.
- [X] T011 [US4] Rework `src/modules/jobsPipeline/pages/JobsPipelinePage.tsx`: view state
  `'before' | 'after' | 'exited'`; call `useJobsPipeline()` and `useAfterPaidPipeline()` at
  page level (cache-deduped, D6) and derive totals as the sum of each hook's columns; tab
  labels `Before payment (N)` / `After payment (M)` / `Exited` — keep the exact existing
  switcher markup/classes and the due-dormant badge on Exited (FR-015; drop the
  `capitalize` reliance since labels are now explicit strings); render `PipelineBoard` /
  `AfterPaidBoard` / `ExitedJobsList` by view; update the subtitle so it no longer claims
  before-payment-only (FR-001) — e.g. "Jobs from first enquiry to completion." Depends on T010.
- [X] T012 [US1] Add optional `warningLabel?: string` prop to
  `src/modules/jobsPipeline/components/PipelineJobCard.tsx` per contract: renders an amber
  `Pill` (existing `@/shared/components/gardens` primitive) next to the `stage_status`
  pill when set; no other changes; wire `StageBoard`'s `cardWarning` result into it.
  (Sequential with T010/T011 only via StageBoard prop pass-through — different file, [P]
  eligible with T011.) Depends on T010.
- [X] T013 [US1] **Gate**: tsc (Gate 0) — 55 baseline, zero new.
- [ ] T014 [US1] **Verification — quickstart "P1 — the demo path"**: Sears Melvin shows
  tabs Before payment (40) / After payment (8) / Exited; four columns with the 8 named
  customers (Barnett, Marshall, Henry, Campbell, Hazrati, Lindsey, Faith, Dean) under
  Confirmed and 0 elsewhere; no warning pills; cards open their conversations; Churchill
  shows the empty state. → Giorgi commits Unit 3. **Demo-ready checkpoint — nothing past
  this point is needed for Friday.**

---

## Unit 4 — P2: Manual moves (Commit 4: "Axis-validated moves on the after board") — US2

**Goal**: Forward/back moves within the four post-paid columns; cross-axis structurally
rejected both directions.
**Independent Test**: quickstart "P2 — moves" (test org only).

- [ ] T015 [US2] Parameterize move validation in
  `src/modules/jobsPipeline/api/jobsPipeline.api.ts` (`moveJobStage`, currently lines
  116-127) per the validation contract (D4): widen `fromStage`/`toStage` to `JobStage`;
  add a module-private `stageAxis(stage)` helper returning `BEFORE_PAID_STAGES` /
  `AFTER_PAID_STAGES` / `null`; valid ⇔ `axis(from) !== null && axis(from) === axis(to) &&
  |idx(to) − idx(from)| === 1` within that axis; keep the `Invalid stage move` error text
  and the Invoiced-gate probe (`toStage === 'invoiced'`) exactly as-is; org-scoped UPDATE
  unchanged. One implementation — no duplicated adjacency logic anywhere. Depends on T014.
- [ ] T016 [US2] Widen `useMoveJobStage` in
  `src/modules/jobsPipeline/hooks/useJobMutations.ts`: mutation args
  `fromStage`/`toStage: JobStage` (import replaces `BeforePaidStage` there); `onSuccess`
  invalidates `jobsPipelineKeys.afterPaid(organizationId)` in addition to `active`; toasts
  unchanged. Depends on T015.
- [ ] T017 [US2] **Belt — caller review** (seed constraint): the T015/T016 widening removes
  compile-time protection from before-paid call sites; D4's runtime axis check is the
  behavioral guard, this review is the belt. Grep every caller:
  `grep -rn "useMoveJobStage\|moveJobStage" src/` — for each call site confirm before-paid
  callers still pass only before-paid stages (expected callers: `PipelineBoard.tsx` move
  helper deriving from `BEFORE_PAID_STAGES` indices, plus the new `AfterPaidBoard`/
  `StageBoard` path deriving from `AFTER_PAID_STAGES`). Record the caller list and verdict
  in the task notes/PR description. Any caller computing a stage outside its own axis is a
  blocker for this unit. Depends on T016.
- [ ] T018 [US2] Wire moves on the after board: `AfterPaidBoard.tsx` gains
  `useMoveJobStage()` and passes `onMove`/`isMoving` to `StageBoard` (same `move(job,
  direction)` pattern as `PipelineBoard`, indices against `AFTER_PAID_STAGES`). Confirmed
  column shows no back arrow (FR-009 — StageBoard's first-column rule), Complete no
  forward arrow (FR-007). Depends on T016.
- [ ] T019 [US2] **Gate**: tsc (Gate 0) — 55 baseline, zero new.
- [ ] T020 [US2] **Verification — quickstart "P2 — moves"** (test org only, never live
  orgs): forward chain confirmed→…→complete persists across reloads; back chain works;
  no back arrow on Confirmed, no forward on Complete; cross-axis `invoiced→confirmed` and
  `confirmed→invoiced` both throw `Invalid stage move` with no DB write; buttons disabled
  while pending; tab counts update after each move. → Giorgi commits Unit 4.

---

## Unit 5 — P3: Post-paid exits (Commit 5: "Phase-split exit reasons") — US3

**Goal**: Exit from the after board with on_hold/cancelled only; pre-paid flow untouched.
**Independent Test**: quickstart "P3 — exits" (test org only).

- [ ] T021 [US3] Widen `exitJob` in `src/modules/jobsPipeline/api/jobsPipeline.api.ts`:
  `reason: JobExitReason` (was `PrePaidExitReason`); the dormant→wake_at guard stays
  exactly as-is. Depends on T014 (independent of Unit 4; may run in parallel with it if
  Giorgi prefers, but sequential units keep commits clean).
- [ ] T022 [US3] Update `src/modules/jobsPipeline/hooks/useJobMutations.ts`: `useExitJob`
  arg `reason: JobExitReason`; add `afterPaid` invalidation to **both** `useExitJob` and
  `useReopenJob` `onSuccess` (reopening a post-paid job must restore it to the after tab —
  data-model invalidation matrix). Depends on T021.
- [ ] T023 [US3] Phase-split `src/modules/jobsPipeline/components/ExitJobModal.tsx` per
  contract: derive `phase = AFTER_PAID_STAGES.includes(job.stage) ? 'after' : 'before'`
  from the job itself (no new prop); `'before'` renders the existing `REASONS` array
  literal **unchanged**; `'after'` renders a new `POST_PAID_REASONS` array — `on_hold`
  "On hold" (hint e.g. "Paused after payment — pick up later.") and `cancelled`
  "Cancelled" (hint e.g. "Order cancelled after payment.") — **only** (FR-011 as amended);
  wake-date input logic untouched (unreachable on the after path since dormant isn't
  offered); reason state type widens to `JobExitReason`. Depends on T022.
- [ ] T024 [US3] Wire exits on the after board: `JobsPipelinePage` passes its existing
  `setExitingJob` as `onExitJob` to `AfterPaidBoard` (same plumbing as `PipelineBoard`);
  confirm the shared `ExitJobModal` instance at page level serves both boards. Depends on T023.
- [ ] T025 [US3] **Gate**: tsc (Gate 0) — 55 baseline, zero new.
- [ ] T026 [US3] **Verification — quickstart "P3 — exits"** (test org only): after-board
  exit offers On hold / Cancelled only, never a wake-date field; cancelled job moves to
  Exited with a date; reopen returns it to the **After payment** board; before-board exit
  still offers Lost/Closed/Dormant with wake date required for Dormant (regression);
  FR-005 dark path — test-org job at `confirmed` with `paid_at` NULL shows the amber
  "Not marked paid" pill. → Giorgi commits Unit 5.

---

## Phase 6 — Final validation (no code changes)

- [ ] T027 Run the full quickstart merge checklist: Gate 0 on final state; Gate 1 parity
  still holds; P1 on both live orgs (read-only); P2+P3 in test org; SC-002 spot check
  (Before + After + Exited counts = org total job count).
- [ ] T028 Confirm out-of-scope boundaries held: no Orders-module diffs, no
  `useJobsPipeline.ts`/`fetchActiveJobs` diffs (OD-1 untouched), no schema/edge-function
  changes, `index.ts` public surface unchanged. `git diff staging --stat` should list only
  the ~9 files in plan.md's source tree plus `specs/`.
- [ ] T029 Flag for Giorgi (decisions, not tasks): OD-1 (post-demo, separate approval);
  and if Arin asks Friday for confirmed→invoiced backward moves, record it as a follow-up
  with confirmation dialog (FR-009 note) — do not build it.

---

## Dependencies & Execution Order

```
Unit 1 (T001→T005) ── blocks everything
Unit 2 (T006→T009) ── parity-gated; revert-don't-patch on failure
Unit 3 (T010→T014) ── 🎯 P1 demoable HERE (Friday deadline)
Unit 4 (T015→T020) ── P2; T017 belt review is blocking within the unit
Unit 5 (T021→T026) ── P3; independent of Unit 4 in code, sequential for clean commits
Phase 6 (T027→T029) ── after all units
```

- Within Unit 1: T002 is [P] with T001; T003/T004 sequential (same-file/api dependency).
- Within Unit 3: T011 and T012 touch different files and may be proposed together after
  T010; the unit's gate/verification tasks are always last.
- Units are strictly sequential in commit order — per-edit approval and one-concern
  commits make cross-unit parallelism a non-goal here.

## Parallel Example (Unit 3, after T010 is applied)

```
Propose together for approval:
  T011: JobsPipelinePage three-way switcher + totals + subtitle
  T012: PipelineJobCard warningLabel prop
```

## Implementation Strategy

**MVP first, hard deadline**: Units 1–3 are the Friday-critical path — stop and validate
at T014 (demo-ready checkpoint) before touching Units 4–5. If time runs short, the demo
ships on Unit 3 alone: cards visible, counts right, no moves/exits on the new board — that
is the headline moment (8 paid customers visible again). Units 4–5 can land after the call.
