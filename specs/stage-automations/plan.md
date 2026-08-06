# Implementation Plan: Stage Automations — order-created → quoted, invoice-created → invoiced

**Branch**: `feature/stage-automations` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/stage-automations/spec.md`

## Summary

Auto-advance a job's pipeline stage when an order (→ `quoted`) or invoice (→ `invoiced`) is created against it, entirely client-side in the three creation mutations' onSuccess paths. The core mechanism is one hook-free async function, `autoAdvanceJobStage`, in the jobsPipeline module: it issues a **single atomic guarded UPDATE** that encodes every no-op condition (wrong org, job not found, exited, post-paid, at-or-past target) as a WHERE predicate, and distinguishes advance from no-op by reading the updated-rows count. Callers invalidate pipeline caches only when an advance actually happened; automation failure never fails the creation.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite (SWC)
**Primary Dependencies**: `@tanstack/react-query` v5, `supabase-js` v2 (shared client `@/shared/lib/supabase`, intentionally `createClient<any>` — hand-written module types are the operative contract)
**Storage**: Supabase Postgres, `jobs.stage` — **no schema changes** (AC-001)
**Testing**: manual test matrix on a test org (no unit-test infra in this repo); type gate `npx tsc --noEmit -p tsconfig.app.json` at the **55-error baseline, zero new**
**Target Platform**: browser SPA
**Project Type**: web app, feature-module architecture (`src/modules/<feature>/`)
**Performance Goals**: n/a — one extra UPDATE + at most three cache invalidations per creation
**Constraints** (from /plan arguments):
- Core function is a **plain async api function** in jobsPipeline — hook-free, no `queryClient` inside it; query invalidation lives in the calling mutations' onSuccess.
- The **atomic guarded UPDATE is the correctness mechanism** (see D1 for exact query shape and rows-affected read).
- **Do not modify** `moveJobStage`, the boards, or `fetchActiveJobs`.
- Per-edit approval; **no `git add`/`commit` by Claude Code** — Giorgi commits.
- Sequence: core function + tests-by-hand first, then the three hook points.
**Scale/Scope**: 1 new api file (~40 lines), 2 hook files edited, 1 `index.ts` export addition; 2 live orgs (Churchill, Sears Melvin — no data writes in this feature beyond the automation itself acting on future creations)

**Ground-truth corrections vs the spec** (full trail in [research.md](./research.md)):
- The quote-conversion hook is **`useCreateOrderFromQuote`** (`src/modules/orders/hooks/useOrders.ts:223`), not "useConvertQuoteToOrder". Its onSuccess currently has **no** `job_id` branch — one is added.
- The spec's fetch-then-check contract (FR-005…FR-008) is implemented as WHERE predicates on a single UPDATE — semantics identical, strictly stronger under concurrency (multi-fire drawer case, US4).

## Constitution Check

- **Dual router constraint**: PASS — no routing/navigation changes.
- **Module boundaries**: PASS — stage semantics stay in `src/modules/jobsPipeline/`; orders/invoicing consume only via the `@/modules/jobsPipeline` public surface (`index.ts` gains `autoAdvanceJobStage`, `AutoAdvanceTargetStage`, `jobsPipelineKeys`). No cross-feature deep imports.
- **Supabase + RLS**: PASS — uses existing `jobs` RLS; every predicate is org-scoped (`.eq('organization_id', …)`); UI checks are not security.
- **Secrets**: PASS — no secrets, no edge functions.
- **Additive-first**: PASS — purely additive: one new file, new exports, new branches inside existing onSuccess handlers. No schema change; `moveJobStage`/boards/`fetchActiveJobs` untouched.

## Project Structure

### Documentation (this feature)

```text
specs/stage-automations/
├── spec.md              # Feature specification (/specify output)
├── plan.md              # This file
├── research.md          # Phase 0 output — ground truth + decision trail
├── data-model.md        # Phase 1 output — jobs.stage semantics + predicate mapping
├── quickstart.md        # Phase 1 output — hand-test matrix + demo script
├── contracts/
│   └── autoAdvanceJobStage.md   # Phase 1 output — function + caller contract
└── tasks.md             # Phase 2 output (/tasks command — NOT created by /plan)
```

### Source Code (repository root)

```text
src/modules/jobsPipeline/
├── api/
│   ├── autoAdvanceStage.api.ts   # NEW — core function + AutoAdvanceTargetStage type
│   ├── jobsPipelineKeys.ts       # unchanged (newly re-exported through index.ts)
│   └── jobsPipeline.api.ts       # NOT modified (moveJobStage, fetchActiveJobs live here)
├── index.ts                      # EDIT — export autoAdvanceJobStage, its type, jobsPipelineKeys
src/modules/orders/hooks/useOrders.ts        # EDIT — useCreateOrder + useCreateOrderFromQuote onSuccess
src/modules/invoicing/hooks/useInvoices.ts   # EDIT — useCreateInvoice onSuccess
```

**Structure Decision**: single web app with feature modules under `src/modules/`. The core function lives in jobsPipeline because that module owns stage semantics (FR-003, AC-002); it gets its own api file so the file containing the do-not-touch functions is never edited.

## Design Decisions

### D1 — Core function: exact shape, exact query

New file `src/modules/jobsPipeline/api/autoAdvanceStage.api.ts`:

```ts
import { supabase } from '@/shared/lib/supabase';
import { BEFORE_PAID_STAGES } from '../types/jobsPipeline.types';

/** The two blessed automation targets — other stages are unrepresentable (FR-004). */
export type AutoAdvanceTargetStage = 'quoted' | 'invoiced';

/**
 * Forward-only, before-paid-only stage automation (spec FR-005..FR-009).
 * All no-op conditions are WHERE predicates on one atomic UPDATE — no
 * read-then-write race. Returns true iff the job actually advanced.
 * NOT moveJobStage: deliberately no adjacency rule, jumps are expected.
 */
export async function autoAdvanceJobStage(args: {
  organizationId: string;
  jobId: string;
  targetStage: AutoAdvanceTargetStage;
}): Promise<boolean> {
  const { organizationId, jobId, targetStage } = args;
  // Stages strictly earlier than the target on the before-paid axis:
  // 'quoted' → ['enquired'];  'invoiced' → ['enquired', 'quoted'].
  const earlierStages = BEFORE_PAID_STAGES.slice(0, BEFORE_PAID_STAGES.indexOf(targetStage));

  const { data, error } = await supabase
    .from('jobs')
    .update({ stage: targetStage })
    .eq('id', jobId)
    .eq('organization_id', organizationId)   // org-guarded (FR-005, AC-003)
    .is('exit_reason', null)                 // exited jobs never auto-move (FR-006)
    .in('stage', earlierStages as unknown as string[]) // before-paid + strictly earlier (FR-007/FR-008)
    .select('id');

  if (error) throw error;
  return (data ?? []).length > 0;
}
```

**Rows-affected read**: `.select('id')` on the UPDATE returns the updated rows; `length > 0` = advanced, empty array = some predicate failed — job not found, wrong org, exited, post-paid, or already at/past target. These are indistinguishable by design: all are silent no-ops (FR-005). The boolean lets callers skip board invalidation on the common no-op path.

**Why this beats fetch-then-check**: the spec's FR-005/6/7/8 read as fetch → inspect → update. Collapsing them into WHERE predicates makes the whole contract one atomic statement — under the US4 multi-fire case (drawer creates invoice then inline order), Postgres row locking serializes the two UPDATEs and forward-only predicates guarantee the net result is `invoiced` regardless of interleaving. Semantics are identical for every single-fire case.

**Error contract**: the function throws on transport/DB errors; swallowing happens at call sites (D3), keeping the function itself hand-testable.

The `as unknown as string[]` cast matches the existing module pattern (`fetchAfterPaidJobs`, jobsPipeline.api.ts:38) — the shared client is `any`-typed, the hand-written types are the contract.

### D2 — Export split (module public surface)

`src/modules/jobsPipeline/index.ts` gains exactly three exports:

```ts
export { autoAdvanceJobStage } from './api/autoAdvanceStage.api';
export type { AutoAdvanceTargetStage } from './api/autoAdvanceStage.api';
export { jobsPipelineKeys } from './api/jobsPipelineKeys';
```

Callers need the module's query keys to invalidate in their own onSuccess (per constraint). Exporting `jobsPipelineKeys` mirrors how the orders module already exposes `ordersKeys`. **Rejected alternative**: an `invalidatePipelineQueries(queryClient, orgId)` helper — extra indirection, still needs a public export, and hides which caches move from the reader of the calling hook.

### D3 — Call-site pattern (identical at all three hook points)

Fire-and-forget after creation success, inside the `job_id`-present branch:

```ts
// inside onSuccess(data), organizationId already narrowed non-null
if (data.job_id) {
  const jobId = data.job_id;
  void autoAdvanceJobStage({ organizationId, jobId, targetStage: 'quoted' })
    .then((advanced) => {
      if (!advanced) return;
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.active(organizationId) });
      queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.afterPaid(organizationId) });
    })
    .catch((err) => {
      console.warn('[jobsPipeline] auto-advance failed (creation succeeded)', err);
    });
}
```

**Failure isolation (FR-010)**: `void` + `.catch` — a rejection can never propagate into the mutation promise chain, so `mutateAsync` callers (CreateInvoiceDrawer's try/catch at line 341) never see creation fail because of the automation. Surface is a quiet `console.warn`, **no toast** — a background failure toast during the demo would read as "invoice failed" when it didn't. Invalidation runs only on `advanced === true`, skipping board refetches for the common no-op path (second invoice, post-paid job).

**Per-hook specifics**:

1. **`useCreateOrder`** (`useOrders.ts:189`, onSuccess :198): add the automation inside the existing `if (data.job_id)` branch (:211, which already invalidates `ordersKeys.byJob`). Target `'quoted'`. Import `autoAdvanceJobStage, jobsPipelineKeys` from `@/modules/jobsPipeline`.
2. **`useCreateOrderFromQuote`** (`useOrders.ts:223`, onSuccess :231): add a new `if (data.job_id)` branch containing (a) `ordersKeys.byJob` invalidation — parity with `useCreateOrder`, currently missing — and (b) the same `'quoted'` automation. Orders without `job_id` never enter the branch (FR-011, US3 no-op scenario).
3. **`useCreateInvoice`** (`useInvoices.ts:38`, onSuccess :49): change `onSuccess: ()` to `onSuccess: (data)` (the api's `createInvoice` returns the full row via `.select().single()`, and the `Invoice` type carries `job_id`). Inside a new `if (data.job_id)` branch: target `'invoiced'`, plus invalidate `jobsPipelineKeys.invoiceSummaries(organizationId)` unconditionally within the branch — a fresh job-linked invoice changes card totals and the D4-gate summary even when the stage doesn't move.

### D4 — Interactions called out so review doesn't flag them

- **D4 invoiced-gate**: the board's manual move into `invoiced` probes for a linked invoice (`moveJobStage`, jobsPipeline.api.ts:157-168). The automation deliberately does **not** re-run that probe: it advances to `invoiced` *because* an invoice was just created on the job — the gate's intent is satisfied by construction. `moveJobStage` is not modified.
- **Jump moves**: `enquired → invoiced` in one hop is expected; `autoAdvanceJobStage` intentionally has no same-axis-adjacency rule. It is not, and must not call, `moveJobStage`.
- **US4 multi-fire (drawer)**: observed sequencing — invoice awaited first (CreateInvoiceDrawer.tsx:343), inline order created after (:431) — so `invoiced` typically lands first and the later `quoted` fire no-ops via `.in('stage', ['enquired'])`. Reverse or concurrent order converges to `invoiced` too (atomic forward-only statements, row lock serializes).

## Phases

**Phase 0 — Research**: complete → [research.md](./research.md) (ground-truthed hook points, return shapes, keys, gate location, drawer sequencing, decision trail).

**Phase 1 — Design artifacts**: complete → [data-model.md](./data-model.md) (predicate ↔ FR mapping, no schema change), [contracts/autoAdvanceJobStage.md](./contracts/autoAdvanceJobStage.md) (function + caller contract), [quickstart.md](./quickstart.md) (hand-test matrix, E2E matrix, demo script).

**Phase 2 — Tasks**: produced by `/tasks`, expected shape (per the mandated sequence):
- **A. Core first**: create `autoAdvanceStage.api.ts` + `index.ts` exports → tsc gate → hand-test the guard matrix on a test org (quickstart §2) before any hook is wired.
- **B. Hook points**, one edit each with per-edit approval, tsc gate after each: `useCreateOrder` → `useCreateOrderFromQuote` → `useCreateInvoice`.
- **C. Verification**: full E2E matrix (quickstart §3), `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json` at 55-error baseline, demo walkthrough (quickstart §4). Giorgi commits; staging merge only after full verification.

## Post-implementation findings (2026-08-07, Unit 3 live run)

- **Stripe-on-every-invoice**: every drawer-created invoice creates a **live Stripe invoice**; the
  "Mason-only invoice" premise in the /tasks seed is false at the product level. Three Stripe
  invoices were created during the test matrix and voided by Giorgi in the live Stripe dashboard.
  Consequence for all future work: any test plan that creates invoices must include Stripe voids in
  its cleanup, and "no Stripe objects" is not an achievable constraint via the drawer.
- **Untracked-row catch**: the no-`job_id` order flow created an invoice that wasn't in the run's
  tracking manifest; the cleanup pack's A-phase reference checks caught it before deletion —
  reference-check-before-DELETE stays mandatory.
- **`RETURNING id` standard**: the Supabase Dashboard SQL editor shows no rows-affected count on a
  plain DELETE; `DELETE … RETURNING id` is now the standard cleanup pattern (returned ids are the
  evidence, matched against the manifest).

## Complexity Tracking

No constitution violations — table intentionally empty.

## Progress Tracking

- [x] Phase 0: research.md generated
- [x] Phase 1: data-model.md, contracts/, quickstart.md generated
- [x] Constitution Check: PASS (initial and post-design re-check)
- [ ] Phase 2: tasks.md (/tasks command)
