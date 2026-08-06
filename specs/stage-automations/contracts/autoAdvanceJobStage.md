# Contract: `autoAdvanceJobStage`

Module: `src/modules/jobsPipeline/api/autoAdvanceStage.api.ts`
Public import path: `@/modules/jobsPipeline` (via `index.ts` — deep imports forbidden)

## Signature

```ts
export type AutoAdvanceTargetStage = 'quoted' | 'invoiced';

export async function autoAdvanceJobStage(args: {
  organizationId: string;
  jobId: string;
  targetStage: AutoAdvanceTargetStage;
}): Promise<boolean>;
```

## Behavior

Issues exactly one atomic guarded UPDATE (no prior fetch):

```ts
supabase
  .from('jobs')
  .update({ stage: targetStage })
  .eq('id', jobId)
  .eq('organization_id', organizationId)
  .is('exit_reason', null)
  .in('stage', earlierStages)   // BEFORE_PAID_STAGES.slice(0, indexOf(targetStage))
  .select('id')
```

| Outcome | Return / throw |
|---|---|
| Exactly one row updated (job existed in org, not exited, stage strictly earlier than target on the before-paid axis) | `true` |
| Zero rows updated — job not found, wrong org, exited, post-paid stage, at-or-past target | `false` (reasons deliberately indistinguishable; all are silent no-ops) |
| Transport/Postgres error | **throws** — caller is responsible for containment |

Guarantees:
- **Forward-only & idempotent**: repeated fires with the same target return `false` after the first success.
- **Never touches**: `exit_reason`, `paid_at`, any other column; never moves post-paid jobs; never calls or duplicates `moveJobStage` (no adjacency rule — jumps like `enquired → invoiced` are correct here; the D4 invoiced-gate is satisfied by construction and not re-checked).
- **Hook-free**: plain async function; no React, no `queryClient`, no toasts, no logging.

## Caller obligations (the three hook points)

1. Call only **after** creation has succeeded (onSuccess), only when the created row has a non-null `job_id`, with the caller's `organizationId` (already narrowed non-null in all three hooks).
2. **Containment (FR-010)**: `void autoAdvanceJobStage(...).then(...).catch(err => console.warn(...))` — the rejection must never reach the mutation promise chain; the created order/invoice always survives. No toast.
3. **Invalidation on advance only**: when resolved `true`, invalidate `jobsPipelineKeys.active(orgId)` and `jobsPipelineKeys.afterPaid(orgId)`.
4. Per-hook targets:

| Hook | Target | Extra cache work in the same branch |
|---|---|---|
| `useCreateOrder` | `'quoted'` | `ordersKeys.byJob` (already present) |
| `useCreateOrderFromQuote` | `'quoted'` | `ordersKeys.byJob` (added for parity) |
| `useCreateInvoice` | `'invoiced'` | `jobsPipelineKeys.invoiceSummaries(orgId)` unconditionally (totals/gate summary changed even on no-op) |

## Non-callers

Nothing else may call this function. In particular: boards/drag-drop (manual moves stay on `moveJobStage`), exits/reopens, website/webhook paths (out of scope until the DB-trigger follow-up).
