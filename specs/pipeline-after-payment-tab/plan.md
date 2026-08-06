# Implementation Plan: Pipeline After-Payment Tab

**Branch**: `feature/pipeline-after-payment-tab` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/pipeline-after-payment-tab/spec.md`

## Summary

Add an **After payment** board to the Jobs Pipeline page — four columns (Confirmed, In
production, Fixed, Complete) gated on `stage IN AFTER_PAID_STAGES` — alongside the existing
before-payment board and Exited view, with manual moves, phase-appropriate exit actions, and
tab totals. Technical approach: sibling data path (`fetchAfterPaidJobs` +
`useAfterPaidPipeline`) leaving the before-paid query byte-identical; extract the board
render logic into a stage-list-parameterized presentational `StageBoard`; parameterize move
validation by stage *axis* (structurally rejecting cross-axis moves both directions) and
the exit modal by phase. Frontend-only; no schema, dashboard, or edge-function work.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite (SWC)
**Primary Dependencies**: TanStack React Query, shadcn/ui + `gardens-*` design tokens, Supabase JS client
**Storage**: Supabase Postgres — existing `jobs` table only; **no schema changes** (CHECK-constrained stage vocabulary already covers all seven stages)
**Testing**: `npx tsc --noEmit -p tsconfig.app.json` — baseline exactly **55** pre-existing errors, **zero new** (`vite build` does not typecheck); manual verification per `quickstart.md`
**Target Platform**: Web (existing dashboard SPA), org-scoped via RLS + explicit `organization_id` filters
**Project Type**: Feature module inside existing SPA — all work in `src/modules/jobsPipeline/`
**Performance Goals**: N/A beyond existing board (≤ ~50 rows/org today; one extra cached query per page view)
**Constraints**:
- Per-edit approval; diffs proposed before applying; **no `git add`/`git commit`** — Giorgi stages and commits himself, one concern per commit
- Before-paid board provably unchanged: `fetchActiveJobs` / `useJobsPipeline` untouched (same query shape, grouping, exclusions); refactored `PipelineBoard` renders an identical element tree
- Move adjacency validation parameterized in `moveJobStage` (`jobsPipeline.api.ts:119-124` today), not duplicated; cross-axis `invoiced↔confirmed` rejected from both directions
- Exit modal parameterized by phase: before-paid set unchanged (lost/closed/dormant + wake_at rule), after-paid offers **on_hold/cancelled only**
- `gardens-*` tokens and existing board styling patterns only; no new visual language
**Scale/Scope**: ~9 files touched in one module; P1 (tab + 8 visible Sears Melvin cards) must be demoable **Friday** — sequenced to land before P2/P3

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design — no violations.*

- **Dual router constraint**: PASS — no routing changes. The tab switcher is component state
  inside the existing `JobsPipelinePage` route; `src/app/` and `src/pages/` untouched.
- **Module boundaries**: PASS — every touched file is in `src/modules/jobsPipeline/`. No
  cross-feature imports added; `index.ts` public surface unchanged (page-internal feature).
  Explicitly: **no Orders-page change** (spec AC-001).
- **Supabase + RLS**: PASS — read/update of existing `jobs`/`invoices` rows through existing
  RLS policies; every new query keeps the explicit `.eq('organization_id', …)` filter
  matching module convention. No new tables, policies, or privileged operations.
- **Secrets**: PASS — no edge functions, webhooks, or keys involved.
- **Additive-first**: PASS — additive UI + one internal refactor (board render extraction)
  whose output parity is asserted in `research.md` D3 and verified via `quickstart.md`.
  No destructive schema/UI changes; exit/reopen flows preserved.

## Project Structure

### Documentation (this feature)

```text
specs/pipeline-after-payment-tab/
├── spec.md              # Feature spec (amended: FR-011 reason set narrowed — see below)
├── plan.md              # This file
├── research.md          # Phase 0 — decisions D1–D7
├── data-model.md        # Phase 1 — jobs fields, stage axes, gates, invariants
├── quickstart.md        # Phase 1 — manual verification walkthrough (P1/P2/P3 + gates)
├── contracts/
│   └── after-paid-board.md  # Phase 1 — query/hook/validation/component contracts
└── tasks.md             # Phase 2 output (/tasks command — NOT created by /plan)
```

### Source Code (repository root)

```text
src/modules/jobsPipeline/
├── types/jobsPipeline.types.ts   # + AFTER_PAID_STAGES, AfterPaidStage, PostPaidExitReason
├── api/
│   ├── jobsPipelineKeys.ts       # + afterPaid(organizationId) key
│   └── jobsPipeline.api.ts       # + fetchAfterPaidJobs; moveJobStage axis validation;
│                                 #   exitJob reason widened to JobExitReason
├── hooks/
│   ├── useJobsPipeline.ts        # UNTOUCHED (D1 — provably unchanged)
│   ├── useAfterPaidPipeline.ts   # NEW — sibling hook (stage-gated fetch + shared invoice summaries)
│   └── useJobMutations.ts        # widen move/exit arg types; + afterPaid invalidations
│                                 #   (useMoveJobStage, useExitJob, useReopenJob)
├── components/
│   ├── StageBoard.tsx            # NEW — presentational board parameterized by stage list
│   ├── PipelineBoard.tsx         # becomes thin container over StageBoard; STAGE_LABEL
│   │                             #   record deleted → formatStageLabel (FR-013)
│   ├── AfterPaidBoard.tsx        # NEW — thin container: useAfterPaidPipeline → StageBoard
│   ├── PipelineJobCard.tsx       # + optional warningLabel prop (amber Pill, FR-005)
│   ├── PipelineColumn.tsx        # UNTOUCHED
│   └── ExitJobModal.tsx          # reason set derived from job.stage axis (no new prop)
├── utils/display.ts              # UNTOUCHED (formatStageLabel already generic)
└── pages/JobsPipelinePage.tsx    # three-way switcher + tab totals + subtitle copy
```

**Structure Decision**: All changes stay inside the `jobsPipeline` module per constitution;
the page composes two thin board containers over one shared presentational `StageBoard`.
Data fetching stays in module hooks (React Query), keys extended additively.

## Complexity Tracking

No constitutional violations to justify. The only structural addition is the `StageBoard`
extraction, which *removes* prospective duplication (spec AC-002) rather than adding a layer.

## Phase 0 — Research (complete)

Output: [research.md](research.md). Decisions:

- **D1**: Sibling hook `useAfterPaidPipeline` + `fetchAfterPaidJobs`; `useJobsPipeline` /
  `fetchActiveJobs` byte-identical (strongest "provably unchanged" evidence: empty diff).
- **D2**: Discovered the before-paid query gates on `paid_at IS NULL`, not stage — spec
  scenario US1-3 does not hold in current code (see **OD-1** below). After-paid fetch gates
  purely on stage (FR-004) with no `paid_at` filter, so FR-005 rows surface with a warning.
- **D3**: Extract presentational `StageBoard`; `PipelineBoard`/`AfterPaidBoard` become thin
  containers. Label consolidation onto `formatStageLabel` (FR-013) rides the extraction —
  outputs verified identical for the three before-paid stages.
- **D4**: Move validation derives the stage *axis* from the stage itself (not a caller-
  supplied list) — cross-axis moves are structurally unrepresentable, both directions.
- **D5**: `ExitJobModal` derives phase from `job.stage`; after-paid reasons
  **on_hold/cancelled only** (spec FR-011 amended); wake_at rule intact and only reachable
  pre-paid.
- **D6**: Tab totals from page-level hook calls, deduped by React Query cache keys.
- **D7**: Unpaid warning = optional amber `Pill` via new `warningLabel` card prop.

## Phase 1 — Design artifacts (complete)

- [data-model.md](data-model.md) — `jobs` fields in play, the two stage axes, membership
  gates per view, exit-axis rules, invariants (no row on two boards; no row silently
  dropped from the after board).
- [contracts/after-paid-board.md](contracts/after-paid-board.md) — query contract for
  `fetchAfterPaidJobs`, hook contract for `useAfterPaidPipeline`, validation contract for
  `moveJobStage` (axis rules + rejection table), component contracts for `StageBoard`,
  `ExitJobModal(phase)`, `PipelineJobCard(warningLabel)`, page tab contract.
- [quickstart.md](quickstart.md) — manual verification: P1 demo path (8 Sears Melvin cards,
  Churchill empty state), P2 move walkthrough incl. rejected cross-axis moves, P3 exit
  walkthrough, tsc gate, before-board parity checklist.

## Phase 2 — Task planning approach (described only; /tasks generates tasks.md)

Tasks will be generated from the contracts in dependency order, grouped into
**one-concern-per-commit** units matching Giorgi's staging workflow, sequenced so the P1
story is demoable at the earliest possible commit:

1. **Foundations** (no behavior change): types (`AFTER_PAID_STAGES`, `AfterPaidStage`,
   `PostPaidExitReason`), `afterPaid` query key, `fetchAfterPaidJobs`,
   `useAfterPaidPipeline`. tsc gate.
2. **Board extraction** (before-board parity commit): `StageBoard` + `PipelineBoard`
   conversion + `STAGE_LABEL` → `formatStageLabel` consolidation. tsc gate + parity check.
3. **P1 lands — demoable**: `AfterPaidBoard` (cards only, no move buttons yet, unpaid
   warning wired) + `JobsPipelinePage` three-way switcher, tab totals, subtitle copy.
   Friday demo needs nothing past this point.
4. **P2**: `moveJobStage` axis validation + `useMoveJobStage` widening/invalidation + wire
   move buttons on the after board.
5. **P3**: `ExitJobModal` phase prop + `exitJob`/`useExitJob` widening + `useReopenJob`
   invalidation + wire exits on the after board.

Each unit ends with the tsc gate (55 baseline, zero new) and the relevant quickstart
section. Diffs proposed per edit for approval; no commits by Claude.

## Open decision for Giorgi (does not block anything above)

**OD-1 — Align the before-paid fetch to the stage gate.** `fetchActiveJobs` currently
excludes rows with `paid_at` set, so a hypothetical mid-transition row (stage `invoiced`,
`paid_at` set) is invisible on *both* boards — spec US1-3/SC-002 assume it stays on the
before-paid board. Zero such rows exist in live data (06 Aug read), and the plan constraint
pins the before-paid query unchanged, so this feature ships without touching it. The fix is
a one-line swap (`.is('paid_at', null)` → `.in('stage', BEFORE_PAID_STAGES)`) that is a
provable rendering no-op on all current rows. Recommend as a separate post-demo commit —
apply only on your explicit approval.

## Progress Tracking

- [x] Phase 0: Research complete (research.md — D1–D7, no NEEDS CLARIFICATION remaining)
- [x] Phase 1: Design complete (data-model.md, contracts/, quickstart.md)
- [x] Constitution Check: PASS (initial + post-design re-check; no violations)
- [x] Spec amendment recorded: FR-011/US3/SC-004 narrowed to on_hold/cancelled post-paid
- [x] Phase 2: tasks.md generated (29 tasks, 5 commit units + final validation)
- [ ] Implementation — awaiting task approval workflow
