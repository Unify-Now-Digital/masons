# Contracts: After-payment board

**Date**: 2026-08-06 | **Plan**: [../plan.md](../plan.md)

## Query contract — `fetchAfterPaidJobs(organizationId)`

`src/modules/jobsPipeline/api/jobsPipeline.api.ts` (NEW, sibling of `fetchActiveJobs`)

```ts
supabase.from('jobs')
  .select(JOB_SELECT)                      // existing constant, unchanged
  .eq('organization_id', organizationId)
  .is('exit_reason', null)
  .in('stage', AFTER_PAID_STAGES as unknown as string[])
  .order('created_at', { ascending: false })
```

**Guarantees**:
1. `fetchActiveJobs` is byte-identical to `staging` — empty diff is the parity proof (D1).
2. No `paid_at` predicate: stage is the only membership gate (FR-004); a `paid_at NULL`
   post-paid row is returned (FR-005).
3. Org-scoped explicitly, RLS as the actual boundary.
4. Returns `PipelineJob[]` with the same embeds as the before-paid fetch.

## Hook contract — `useAfterPaidPipeline()`

`src/modules/jobsPipeline/hooks/useAfterPaidPipeline.ts` (NEW)

```ts
interface AfterPaidPipelineViewModel {
  columns: Record<AfterPaidStage, PipelineJob[]>;   // all four keys always present
  invoiceSummaries: Map<string, JobInvoiceSummary>;
  isLoading: boolean; isError: boolean; error: unknown;
}
```

**Guarantees**:
1. Query keys: `jobsPipelineKeys.afterPaid(orgId)` for jobs;
   `jobsPipelineKeys.invoiceSummaries(orgId)` **reused** for invoice totals (shared cache
   entry with the before board — no duplicate network call).
2. Grouping iterates fetched rows into `AFTER_PAID_STAGES` buckets keyed by `job.stage`.
   Because the query filters on the same list, **every fetched row lands in a bucket** —
   structurally no dropped rows (data-model invariant 2).
3. Disabled until `organizationId` resolves (mirrors `useJobsPipeline`).

## Validation contract — `moveJobStage` (axis rules)

`src/modules/jobsPipeline/api/jobsPipeline.api.ts` (MODIFIED lines ~116-127)

Signature: `fromStage`/`toStage` widen `BeforePaidStage` → `JobStage`. Validation:

```ts
axis(s) = BEFORE_PAID_STAGES if s ∈ BEFORE_PAID_STAGES
        | AFTER_PAID_STAGES  if s ∈ AFTER_PAID_STAGES
valid(from, to) ⇔ axis(from) = axis(to) ∧ |idx_axis(to) − idx_axis(from)| = 1
```

**Rejection table** (all throw `Invalid stage move` before any DB write):

| from → to | Verdict | Why |
|---|---|---|
| `quoted → invoiced` | allowed (gate probe) | same axis, adjacent — existing behavior |
| `confirmed → in_production` (and reverse) | allowed | same axis, adjacent |
| `invoiced → confirmed` | **rejected** | axes differ |
| `confirmed → invoiced` | **rejected** | axes differ (symmetric test — both directions) |
| `confirmed → fixed` | rejected | same axis, not adjacent |

**Guarantees**:
1. One validation implementation — no duplicated adjacency logic anywhere.
2. Invoiced-gate probe (`toStage === 'invoiced'` → fresh invoice existence check +
   `InvoicedGateError`) unchanged and unreachable from the after axis.
3. UPDATE remains org-scoped (`.eq('organization_id', …)`).
4. `useMoveJobStage`: arg types widened to `JobStage`; `onSuccess` invalidates `active`
   **and** `afterPaid`; error toasts unchanged.

## Component contract — `StageBoard` (presentational)

`src/modules/jobsPipeline/components/StageBoard.tsx` (NEW — extraction of PipelineBoard render logic)

```ts
interface StageBoardProps {
  stages: readonly JobStage[];                       // column order = array order
  columns: Partial<Record<JobStage, PipelineJob[]>>;
  invoiceSummaries: Map<string, JobInvoiceSummary>;
  isLoading: boolean; isError: boolean; error: unknown;
  onMove?: (job: PipelineJob, direction: 1 | -1) => void;  // absent ⇒ no move buttons
  isMoving?: boolean;
  moveForwardGate?: (job: PipelineJob, nextStage: JobStage) => string | null; // reason or null
  cardWarning?: (job: PipelineJob) => string | null; // FR-005 hook, after board only
  onExitJob?: (job: PipelineJob) => void;
  emptyState: { title: string; hint: string };
}
```

**Guarantees**:
1. Labels via `formatStageLabel(stage)` only — the `STAGE_LABEL` record is deleted (FR-013;
   outputs verified identical for enquired/quoted/invoiced).
2. Skeleton/grid column count derives from `stages.length` (3 ⇒ `lg:grid-cols-3`,
   4 ⇒ `lg:grid-cols-4`); loading/error/empty treatments keep the existing markup and
   `gardens-*` classes.
3. First column never gets `onMoveBack`; last never gets `onMoveForward` — backward exit
   from `confirmed` is impossible in the UI (FR-009) and rejected by the API anyway.
4. `PipelineBoard` (before container) passes: `stages=BEFORE_PAID_STAGES`, its existing
   hook data, the invoice gate as `moveForwardGate` ("Needs a linked invoice"), no
   `cardWarning`. Rendered element tree identical to today's board.
5. `AfterPaidBoard` (NEW container) passes: `stages=AFTER_PAID_STAGES`,
   `useAfterPaidPipeline` data, no gate, `cardWarning` = "Not marked paid" iff
   `job.paid_at === null`, empty state copy for the after board. Move/exit wiring arrives
   in the P2/P3 commits (P1 renders cards only).

## Component contract — `PipelineJobCard`

MODIFIED: one optional prop `warningLabel?: string`. When set, renders an amber `Pill`
(existing gardens primitive) alongside the existing `stage_status` pill. No other change;
before-board call sites don't pass it.

## Component contract — `ExitJobModal`

MODIFIED: no new prop — the modal derives the phase from the job it was given:
`phase = AFTER_PAID_STAGES.includes(job.stage) ? 'after' : 'before'`. The job's own stage
is the single source of truth, so no caller can pass a mismatched phase.

| phase | Reasons offered | wake_at rule |
|---|---|---|
| `before` | lost / closed / dormant (existing array literal unchanged) | dormant ⇒ wake date required (unchanged) |
| `after` | **on_hold / cancelled only** (spec FR-011 as amended) | unreachable — dormant not offered |

`exitJob` + `useExitJob` widen `reason` to `JobExitReason`; the dormant→wake_at guard in
`exitJob` stays. `useExitJob`/`useReopenJob` add `afterPaid` invalidation.

## Page contract — `JobsPipelinePage`

- View state: `'before' | 'after' | 'exited'` (was `'active' | 'exited'`).
- Tab labels: `Before payment (N)` / `After payment (M)` / `Exited` — N/M are sums of each
  board's columns from page-level hook calls (cache-deduped, D6). Due-dormant badge on the
  Exited tab preserved exactly (FR-015).
- Subtitle no longer claims the page is before-payment-only (FR-001).
- `ExitJobModal` needs no page changes beyond the existing `onExitJob` plumbing, which the
  after board reuses; the modal derives its reason set from the job's stage.
