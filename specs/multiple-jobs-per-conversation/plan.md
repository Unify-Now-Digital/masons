# Implementation Plan: Multiple jobs per conversation — job picker + job-scoped sidebar

**Branch**: `feature/multi-job-picker` | **Date**: 2026-08-09 | **Spec**: `spec.md` (authoritative — not restated here)
**Input**: Feature specification from `specs/multiple-jobs-per-conversation/spec.md`

## Summary

The inbox currently collapses a conversation group's jobs to the single newest active one
(`latestActiveJob` in `CustomerConversationView.tsx:118` and `PersonOrdersPanel.tsx:52`).
This plan replaces the header "In pipeline: <stage>" hint chip with a job picker listing all
jobs (FR-1), lifts a `selectedJobId` into the common parent `UnifiedInboxPage.tsx`, scopes the
right sidebar's order context/list to the selected job (FR-4/FR-7), and threads
`selectedJob.id` into the two existing creation props — `CreateOrderDrawer.initialJobId` and
`CreateInvoiceDrawer.jobId` (FR-5). Frontend-only; both props already exist and already write
`job_id` verbatim (research.md Q1). Stage automation is untouched — it keys off the row's
`job_id`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite (SWC)
**Primary Dependencies**: TanStack React Query (existing `useConversationsJobs`,
`useOrdersByPersonId`, `useOrdersByJobId`), shadcn/ui + Radix (picker UI), Tailwind
**Storage**: N/A — no schema, no migrations, no new queries; existing RLS/org-scoped fetches only
**Testing**: `npx tsc --noEmit -p tsconfig.app.json` (baseline exactly 55 errors, zero new);
manual acceptance against the SM 4-job person (US-1..US-4); `npm run lint`
**Target Platform**: existing web app, inbox route only (no routing changes)
**Project Type**: web frontend, single existing Vite project
**Performance Goals**: no new network requests on conversation open (reuse cached queries)
**Constraints**: spec Constraints section verbatim — notably no `updated_at` in any
`inbox_conversations` payload (no such payloads are touched), inbox consumes jobsPipeline via
its public index, frontend-only
**Scale/Scope**: 2 components modified, 1 page modified (state lift), 1 new picker component,
1 new pure util (job numbering/labels); ~4 files touched + 1-2 new files, all in
`src/modules/inbox/`

## Constitution Check

*GATE: checked before Phase 0 (passed); re-check after Phase 1 design.*

- **Dual router constraint**: PASS — no routing/navigation changes; feature lives inside the
  existing inbox route (spec constraint).
- **Module boundaries**: PASS — all new code in `src/modules/inbox/`; jobsPipeline consumed
  via its existing public `index.ts` exports (`useConversationsJobs`, `formatStageLabel`);
  no new cross-module exports needed. Note: `PersonOrdersPanel` already deep-imports
  `@/modules/orders/hooks/useOrders` and `CreateOrderDrawer` — pre-existing idiom, not
  expanded beyond the files already doing it.
- **Supabase + RLS**: PASS — zero new data access; existing org-scoped/RLS queries reused
  unchanged.
- **Secrets**: N/A — no edge functions, no privileged operations.
- **Additive-first**: PASS — additive UI. The one behavior change (sidebar shows the selected
  job's orders instead of all person orders) implements FR-4; FR-7's orphan exception is a
  recorded product decision with the Orders → Unassigned tab as the canonical surface.

No violations → Complexity Tracking not required.

**FR-7 amendment delta re-check (Checkpoint 2, 2026-08-09)**: PASS. The Unassigned
subsection is additive UI over the already-cached `useOrdersByPersonId` result (client-side
`job_id === null` filter, display-only) — zero new data access, no module-boundary change,
and it *strengthens* additive-first: the 9 live SM orphan orders (incl. ORD-000232, £3,600)
stay visible instead of silently vanishing. FR-4/FR-5 mechanics unchanged.

**Post-design re-check (Phase 1 complete)**: PASS unchanged. Design added one additive prop
to `ConversationHeader` (`pipelineHintSlot` — optional, other consumer untouched), zero new
data access (`useOrdersByPersonId` reused for picker labels via cache), zero hook/API
modifications (`useAddToPipeline` untouched — FR-6 uses its existing `AddToPipelineResult.jobId`
through a per-call `onSuccess`). Scope fence intact: nothing in `supabase/`, no
`jobsPipeline.api` signature change, no `autoAdvanceStage` change, no schema.

## Project Structure

### Documentation (this feature)

```text
specs/multiple-jobs-per-conversation/
├── spec.md              # authoritative (hand-finalized)
├── plan.md              # this file
├── research.md          # Phase 0 output — grep evidence for Q1/Q2 [DONE]
├── data-model.md        # Phase 1 output — client-side view model only (no DB entities)
├── quickstart.md        # Phase 1 output — manual verification walkthrough (SM 4-job person)
├── contracts/           # Phase 1 output — component prop contracts (no HTTP APIs)
└── tasks.md             # Phase 2 output (/tasks command — NOT created by /plan)
```

### Source Code (repository root)

```text
src/modules/inbox/
├── pages/
│   └── UnifiedInboxPage.tsx        # MODIFY: lift selectedJobId state; thread props into
│                                   #   CustomerConversationView (~:1306) and
│                                   #   PersonOrdersPanel (~:1350)
├── components/
│   ├── CustomerConversationView.tsx # MODIFY: replace pipelineHintLabel chip (:285) with
│   │                                #   JobPicker; keep "New job"/"Add to pipeline" button;
│   │                                #   FR-6 select-new-job-after-create
│   ├── PersonOrdersPanel.tsx        # MODIFY: replace latestActiveJob scoping (:52,:69,
│   │                                #   :279,:290) with selectedJob; job-scoped order list
│   │                                #   (FR-4/FR-7) via useOrdersByJobId
│   ├── JobPicker.tsx                # NEW: dropdown; labels per FR-3; Exited pill; newest
│   │                                #   first; single-job → static badge (edge case)
│   └── OrderContextSummary.tsx      # unchanged (renders whichever order is selected)
└── utils/
    └── jobPickerLabels.ts           # NEW: pure fns — stable "Job N" numbering (created_at
                                     #   asc), label composition, default-selection rule
                                     #   (FR-2); unit-testable without React
```

**Structure Decision**: All changes stay inside `src/modules/inbox/` (the owning module).
Selected-job state lives in `UnifiedInboxPage` (the established common parent — research.md)
and threads down as props, matching the page's existing selection-state idiom
(`selectedOrderId` / `onSelectOrder`). No context provider needed at this scale.

## Design decisions (resolving points the spec delegates to the plan)

- **D1 — FR-3 order label source** (approved at Checkpoint 1): `formatOrderTypeLabel(order.order_type)`
  of the job's linked order — the exact field + formatter behind the existing "New Memorial"
  chip (research.md Q2). Order-per-job map built client-side from the already-cached
  `useOrdersByPersonId` result (orders carry `job_id`); no new fetch. Jobs with multiple
  orders use the **newest order's label, no count** — recorded as a known v1 simplification
  pending OQ-A (nameable labels, Arin).
- **D2 — single-job edge case**: exactly one job → render the current static stage badge,
  not a one-entry dropdown. Pixel-identical to today for the common case (SC-003), zero
  regression surface. Picker appears only at ≥2 jobs.
- **D3 — zero-jobs edge case**: unchanged — no picker, existing "Add to pipeline" affordance
  stays as-is.
- **D4 — FR-2 default + reset rule**: `jobs.find(j => !j.exit_reason) ?? jobs[0]` (newest
  active, else newest — jobs arrive newest-first). Selection resets when the conversation
  group changes; a selected job id that disappears from the fetch falls back to the default.
- **D5 — FR-6 select-after-create**: after `addToPipeline` (allowAdditional) succeeds, select
  the newly created job's id (mutation result / refetched list diff — exact mechanism
  confirmed in Phase 1 contracts against `useAddToPipeline`'s return shape).
- **D6 — S5 flow (no-person conversation)**: `PersonOrdersPanel`'s person-resolution path
  (`:86-128`) keys off the *selected* job's `conversation_id` instead of
  `latestActiveJob.conversation_id` — same logic, same fallbacks, job now explicit.
- **D7 — creation gating on exited selection** (added in Phase 1): "New order" / "Create
  invoice" render only when the selected job is active (`!exit_reason`). Preserves today's
  invariant that creation targets active jobs; an exited selection (US-4) shows orders with
  no creation buttons.
- **FR-4 mechanism** (Checkpoint 1 directive): implemented by **swapping the argument** of
  the existing `useOrdersByJobId` hook (`latestActiveJob?.id` → `effectiveJob?.id`), not by
  new client-side filtering. All nine `latestActiveJob` sites in `PersonOrdersPanel`
  (`:52,:61,:69,:83,:91,:155,:181,:279,:290`) become `effectiveJob` — full mapping table in
  `contracts/components.md` §5.

## Scope fence audit (per /plan instructions)

Nothing in this plan touches `supabase/`, `jobsPipeline.api` signatures, `autoAdvanceStage`,
or any schema. `fetchConversationsJobs` is consumed as-is (its `ConversationJobSummary`
already carries `created_at` for Job-N numbering). If Phase 1 design uncovers a need to cross
this fence, work stops and the conflict is flagged instead of implemented.

## Phase plan & checkpoints

- **Phase 0 — Research**: DONE → `research.md` (Q1/Q2 answered with pasted grep output).
  **⛔ CHECKPOINT 1: user approval required before Phase 1.**
- **Phase 1 — Design artifacts**: `data-model.md` (client view model: JobSummary + numbering,
  selection state machine), `contracts/` (prop contracts for JobPicker, modified props of
  CustomerConversationView / PersonOrdersPanel / UnifiedInboxPage threading, FR-6 mechanism
  confirmed), `quickstart.md` (manual test script against SM 4-job person incl. US-2's
  SELECT verification). Re-run Constitution Check after design.
  **⛔ CHECKPOINT 2: user approval required before /tasks.**
- **Phase 2 — /tasks**: generates `tasks.md` (separate command, not part of /plan).

## Progress Tracking

- [x] Constitution Check (pre-research): PASS
- [x] Phase 0: research.md complete — Q1/Q2 confirmed with evidence
- [x] CHECKPOINT 1 approval (Giorgi, 2026-08-09) — directives: FR-4 via useOrdersByJobId
      argument swap; all nine PersonOrdersPanel latestActiveJob sites become selectedJob;
      D1 newest-order label recorded as v1 simplification pending OQ-A
- [x] Phase 1: data-model.md, contracts/components.md, quickstart.md
- [x] Constitution Check (post-design): PASS
- [x] CHECKPOINT 2 approval (Giorgi, 2026-08-09) — D7 + id tie-break accepted; FR-7 amended
      in spec.md (Unassigned subsection, display-only, from cached useOrdersByPersonId —
      9 live SM orphans incl. ORD-000232); data-model.md, contracts/components.md,
      quickstart.md updated; constitution delta re-check PASS
- [x] Phase 2: tasks.md (T001–T013, organized by user story)
- [ ] CHECKPOINT 3 approval (Giorgi) — before /implement

## Complexity Tracking

No constitution violations — table intentionally empty.
