# Phase 1 Data Model: Stage Automations

**No schema changes.** This feature reads and writes existing columns of `public.jobs` only (source of truth: `supabase/migrations/20260801210000_jobs_pipeline_schema.sql`; operative TS contract: `src/modules/jobsPipeline/types/jobsPipeline.types.ts`).

## Entities touched

### Job (`public.jobs`) — the only mutated entity

| Column | Role in this feature |
|---|---|
| `id` (uuid) | Target row selector. |
| `organization_id` (uuid) | Tenancy guard on every predicate (AC-003). |
| `stage` (text, one of 7) | **The only column written.** Moves to `'quoted'` or `'invoiced'`. |
| `exit_reason` (text \| null) | Guard: non-null (exited) rows are never auto-moved (FR-006). Never written. |
| `paid_at` | Not read or written. Before-paid-axis membership is enforced via the `stage` predicate, not `paid_at` — matching how `fetchAfterPaidJobs` treats stage as the sole membership gate. |
| `updated_at` | Maintained by existing DB trigger behavior, if any; not set explicitly. |

### Order / Invoice — triggers only, never mutated

- `orders.job_id` (nullable uuid): presence on the **created** order row triggers the `'quoted'` automation.
- `invoices.job_id` (nullable uuid): presence on the **created** invoice row triggers the `'invoiced'` automation.

## Stage state machine (automation's view)

```text
before-paid axis:  enquired ──→ quoted ──→ invoiced        (BEFORE_PAID_STAGES, ordered)
after-paid axis:   confirmed → in_production → fixed → complete   (never touched)

automation edges (the ONLY automated transitions in the app):
  order-created:    enquired ──────────────→ quoted
  invoice-created:  enquired ──────────────→ invoiced   (jump — expected)
                    quoted   ──────────────→ invoiced
```

Everything else — post-paid moves, `invoiced → confirmed`, exits, reopens — remains manual and is out of scope.

## Predicate ↔ requirement mapping (the atomic guarded UPDATE)

One statement encodes the whole contract; `earlierStages = BEFORE_PAID_STAGES.slice(0, indexOf(target))`:

| Query clause | Spec requirement enforced | No-op it produces |
|---|---|---|
| `.update({ stage: targetStage })` | FR-001/FR-002 — the advance itself | — |
| `.eq('id', jobId)` | row targeting | job deleted → 0 rows |
| `.eq('organization_id', organizationId)` | FR-005 / AC-003 — org-guarded | cross-org `job_id` → 0 rows |
| `.is('exit_reason', null)` | FR-006 — exited jobs frozen | exited job → 0 rows |
| `.in('stage', earlierStages)` | FR-007 — post-paid stages absent from list; FR-008 — only strictly-earlier before-paid stages qualify (forward-only, idempotent) | post-paid, at-target, or past-target → 0 rows |
| `.select('id')` → `rows.length > 0` | FR-009's advance/no-op signal for conditional cache invalidation | — |

`earlierStages` by target: `'quoted'` → `['enquired']`; `'invoiced'` → `['enquired', 'quoted']`. The target type `AutoAdvanceTargetStage = 'quoted' | 'invoiced'` makes any other target unrepresentable (FR-004).

## Concurrency model (US4 multi-fire)

Two automation fires on the same job row (drawer: invoice awaited first, inline order after) are two atomic UPDATEs. Postgres row-level locking serializes them; forward-only predicates make every interleaving converge:

| First fire | Second fire | Result |
|---|---|---|
| invoice → `invoiced` (from `enquired`) | order → `quoted`: `'invoiced' ∉ ['enquired']` → 0 rows | `invoiced` |
| order → `quoted` (from `enquired`) | invoice → `invoiced`: `'quoted' ∈ ['enquired','quoted']` → advances | `invoiced` |

## Cache (React Query) effects

| Key | Invalidated when | By whom |
|---|---|---|
| `jobsPipelineKeys.active(orgId)` | advance returned `true` | calling mutation's onSuccess |
| `jobsPipelineKeys.afterPaid(orgId)` | advance returned `true` (uniform with spec FR-009; harmless for before-paid moves) | calling mutation's onSuccess |
| `jobsPipelineKeys.invoiceSummaries(orgId)` | invoice created with `job_id` (regardless of advance — card totals/D4 summary changed) | `useCreateInvoice` onSuccess |
| `ordersKeys.byJob(jobId, orgId)` | order created with `job_id` (existing in `useCreateOrder`; **added** to `useCreateOrderFromQuote` for parity) | order hooks' onSuccess |
