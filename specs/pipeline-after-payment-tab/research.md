# Research: Pipeline After-Payment Tab

**Date**: 2026-08-06 | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

All decisions below were made by reading the current `src/modules/jobsPipeline/` code on
branch `feature/pipeline-after-payment-tab` (parent: `staging` @ `deb733c`). No live-data
reads were needed beyond those already recorded in the spec (06 Aug distribution).

## D1 — Sibling hook, not a parameterized `useJobsPipeline`

**Decision**: New `useAfterPaidPipeline` hook + new `fetchAfterPaidJobs` API function.
`useJobsPipeline` and `fetchActiveJobs` are not modified — not even cosmetically.

**Rationale**: The plan constraint requires the before-paid board's behavior to be
*provably* unchanged. A byte-identical hook and fetch is the strongest possible proof —
`git diff` on `useJobsPipeline.ts` is empty. Parameterizing the existing hook
(`useJobsPipeline(stages)`) would force a review of every call site and re-verification of
the query, for zero reuse gain: the two hooks share `fetchJobInvoiceSummaries` (same query
key → shared React Query cache entry, no duplicate network call) and the grouping loop is
four lines.

**Alternative rejected**: One hook with a `stages` parameter — touched the live board's
data path days before the Friday demo, and the "shared" code is too small to justify it.

## D2 — The before-paid gate is `paid_at`, not stage (discovered conflict)

**Finding**: `fetchActiveJobs` (`jobsPipeline.api.ts:16-26`) filters
`.is('exit_reason', null).is('paid_at', null)` — the *query* excludes paid jobs; the hook's
grouping then drops post-paid *stages*. So today's before-paid board gate is effectively
`paid_at IS NULL AND stage IN BEFORE_PAID_STAGES`.

**Consequence**: Spec acceptance scenario US1-3 ("`paid_at` set but stage still `invoiced`
→ appears on the before-payment board") does **not** hold in current code — such a row is
invisible on the before-paid board (query excludes it) *and* on the new after-paid board
(stage not post-paid). Live read 06 Aug: **zero** such rows exist (invoiced jobs are all
unpaid), so this is a latent gap, not a live bug.

**Decision**: `fetchActiveJobs` stays untouched in this feature (the plan constraint
explicitly pins "same query shape, same grouping, same exclusions"). The gap is recorded
as **Open Decision OD-1 in plan.md** for Giorgi: an optional post-demo one-line change
swapping `.is('paid_at', null)` for `.in('stage', BEFORE_PAID_STAGES)`, which is provably
a rendering no-op on all current live rows (zero rows differ between the two predicates
today) and would make US1-3/SC-002 hold exactly. Not required for P1; not applied without
explicit approval.

**Membership gates as implemented by this feature**:
- Before-paid board (unchanged): `exit_reason IS NULL AND paid_at IS NULL`, grouped into
  `BEFORE_PAID_STAGES` columns (post-paid-stage rows fetched but not rendered — existing
  behavior).
- After-paid board (new): `exit_reason IS NULL AND stage IN AFTER_PAID_STAGES`. **No
  `paid_at` filter** — stage is the gate (spec FR-004), and a post-paid-stage row with
  `paid_at NULL` is fetched and rendered with a warning (FR-005). No row can appear on
  both boards: the before board renders only before-paid stages, the after board fetches
  only after-paid stages.

## D3 — Board reuse: extract a presentational `StageBoard`

**Decision**: Extract the render logic of `PipelineBoard.tsx` into a presentational
`StageBoard` component parameterized by stage list; `PipelineBoard` (before-paid) and a
new `AfterPaidBoard` become thin containers that call their own data hook and pass config.

**Rationale**: Spec AC-002 forbids a copy-pasted second board. The differences between the
two boards are exactly configuration: stage list (3 vs 4 → grid/skeleton column count),
invoice-gate on forward-move into `invoiced` (before only), unpaid-warning badge (after
only), empty-state copy. Everything else (loading skeleton, error panel, column mapping,
move-button wiring, exit wiring) is identical and lives once in `StageBoard`.

**Parity proof for the before-paid board**: after refactor, `PipelineBoard` renders the
same element tree with the same class names; labels switch from the local `STAGE_LABEL`
record to `formatStageLabel`, which produces identical strings for the three stages
('Enquired'/'Quoted'/'Invoiced' — verified against `display.ts:53-56`'s implementation).
The `STAGE_LABEL` record is deleted (spec FR-013 consolidation, confirmed in-scope).

**Alternative rejected**: Leaving `PipelineBoard` untouched and giving `AfterPaidBoard` its
own copy of the render logic — direct AC-002 violation, and the two copies would drift.

## D4 — Move validation: axis lookup, not a stages parameter at call sites

**Decision**: `moveJobStage` keeps its signature shape but widens `fromStage`/`toStage` to
`JobStage` and validates via an axis lookup:

```ts
const stageAxis = (s: JobStage) =>
  (BEFORE_PAID_STAGES as readonly string[]).includes(s) ? BEFORE_PAID_STAGES
  : (AFTER_PAID_STAGES as readonly string[]).includes(s) ? AFTER_PAID_STAGES
  : null;
// valid ⇔ axis(from) !== null && axis(from) === axis(to)
//         && |idx(to) − idx(from)| === 1 within that axis
```

**Rationale**: One validation, no duplication, and cross-axis rejection falls out
structurally: `invoiced → confirmed` fails because `axis(invoiced) === BEFORE ≠ AFTER ===
axis(confirmed)`, and the axis-equality test is symmetric, so `confirmed → invoiced` fails
identically (plan constraint: rejected from both directions). Passing the stage list as a
caller argument was rejected — a caller could pass the wrong list and legalize a cross-axis
move; deriving the axis from the stage makes the invalid state unrepresentable.

The Invoiced-gate probe (`toStage === 'invoiced'` → fresh invoice check) is untouched; it
is only reachable within the before axis. `useMoveJobStage` widens its arg types and adds
`afterPaid` key invalidation alongside `active`.

## D5 — Exit modal: `phase` prop selects the reason set

**Decision**: `ExitJobModal` derives a phase from the job it was handed —
`AFTER_PAID_STAGES.includes(job.stage) ? 'after' : 'before'` — rather than taking a caller
prop (the job's stage is the single source of truth; a prop could be wired wrong).
`'before'` renders the existing three reasons (lost/closed/dormant — array literal
unchanged); `'after'` renders on_hold/cancelled **only**. `exitJob` and `useExitJob`
widen `reason` from `PrePaidExitReason` to `JobExitReason`; the dormant→wake_at guard in
`exitJob` stays and remains reachable only from the before path (dormant is not offered
post-paid, so the wake-date input is unreachable on the after path by construction).

**Spec delta (recorded)**: Spec FR-011 as originally written said the after-paid flow
offers all five reasons. The plan arguments narrow it: **after-paid offers on_hold and
cancelled only**. This matches the existing type-level design (`PrePaidExitReason` comment:
"on_hold/cancelled are post-paid exits") and is the version implemented. Spec FR-011,
US3 scenario 1, and SC-004 are amended accordingly.

`useExitJob` and `useReopenJob` add `afterPaid` invalidation (reopening a post-paid job
must restore it to the after tab; exiting one must remove it).

## D6 — Tab counts: page-level hook calls, cache-deduped

**Decision**: `JobsPipelinePage` calls both `useJobsPipeline` and `useAfterPaidPipeline`
to derive the two tab totals (sum of each hook's columns). The boards keep calling their
own hooks internally; React Query deduplicates by query key, so there is no extra network
traffic — the page and the visible board share one cache entry per query.

**Alternative rejected**: Lifting data fetching to the page and passing columns down —
changes `PipelineBoard`'s existing contract with the page for no benefit.

## D7 — FR-005 unpaid-warning rendering

**Decision**: `PipelineJobCard` gains an optional `warningLabel?: string` prop rendered as
an amber `Pill` (existing `@/shared/components/gardens` primitive, same as the
`stage_status` pill — no new visual language). `AfterPaidBoard` passes
`warningLabel="Not marked paid"` when `job.paid_at === null`. The before-paid container
never passes it, so the before board is unaffected. Ships dark (zero qualifying rows
live); testable with a test-org fixture.

## Existing patterns reused (verified present)

| Item | Location | Use |
|---|---|---|
| `PipelineColumn` | `components/PipelineColumn.tsx` | Column shell, unchanged |
| `PipelineJobCard` | `components/PipelineJobCard.tsx` | Card + move/exit buttons (one optional prop added) |
| `formatStageLabel` | `utils/display.ts:53` | All seven stage labels, both boards |
| `fetchJobInvoiceSummaries` | `api/jobsPipeline.api.ts:39` | Shared invoice totals, same query key |
| `useMoveJobStage` / `useExitJob` / `useReopenJob` | `hooks/useJobMutations.ts` | Parameterized, not duplicated |
| `jobsPipelineKeys` | `api/jobsPipelineKeys.ts` | + `afterPaid` key |
| Tab switcher + due-dormant badge | `pages/JobsPipelinePage.tsx:27-43` | Extended to three views, badge preserved |
| `gardens-*` tokens, `Pill`, skeleton/error/empty patterns | throughout module | No new visual language |
