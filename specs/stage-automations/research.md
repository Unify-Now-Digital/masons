# Phase 0 Research: Stage Automations

All findings ground-truthed against the working tree at branch `feature/stage-automations` (base 1512ac3) on 2026-08-07.

## R1 — Hook points: names, lines, current behavior

| Spec said | Actual | Location | Current onSuccess behavior |
|---|---|---|---|
| `useCreateOrder` :194 | ✅ `useCreateOrder` | `src/modules/orders/hooks/useOrders.ts:189` (mutationFn :194) | Has `if (data.job_id)` branch at :211 invalidating `ordersKeys.byJob`. Automation slots into this branch. |
| `useConvertQuoteToOrder` :227 | ⚠️ **`useCreateOrderFromQuote`** | `useOrders.ts:223` (mutationFn :227) | onSuccess (:231) has **no** `job_id` branch at all — only detail cache set, `ordersKeys.all`, `byInvoice`, map keys. A `job_id` branch must be added (byJob invalidation + automation). |
| `useCreateInvoice` :43 | ✅ `useCreateInvoice` | `src/modules/invoicing/hooks/useInvoices.ts:38` (mutationFn :43) | onSuccess (:49) takes **no arguments** — must become `(data)`. Invalidates `invoicesKeys.all` + `list` only. |

The spec's name "useConvertQuoteToOrder" does not exist anywhere in the codebase; `useCreateOrderFromQuote` is the quote-conversion hook. Same automation semantics apply.

## R2 — Return shapes carry `job_id`

- `createOrder` (`src/modules/orders/api/orders.api.ts:292`): `.insert(...).select('*').single()` → normalized full row. `data.job_id` available (already used at useOrders.ts:211).
- `createOrderFromQuote` (`orders.api.ts:363`): delegates to `createOrder` — same row shape.
- `createInvoice` (`src/modules/invoicing/api/invoicing.api.ts:65`): `.insert(invoice).select().single()` → full `Invoice` row; `Invoice` type declares `job_id?: string | null` (`invoicing.types.ts:6`). So switching `useCreateInvoice`'s onSuccess to `(data)` and branching on `data.job_id` needs no api change.

## R3 — jobsPipeline module ground truth

- **Stage vocabulary** (`types/jobsPipeline.types.ts`): `BEFORE_PAID_STAGES = ['enquired', 'quoted', 'invoiced'] as const`; `AFTER_PAID_STAGES = ['confirmed', 'in_production', 'fixed', 'complete'] as const`. Two ordered axes partition the seven stages.
- **Query keys** (`api/jobsPipelineKeys.ts`): `active(orgId)`, `afterPaid(orgId)`, `invoiceSummaries(orgId)`, `exited(orgId)`, `dueDormantCount(orgId)`, plus conversation keys. Namespace `'jobsPipeline'` — deliberately not `'jobs'` (legacy scheduling module owns that). **Not currently exported** through `index.ts` — D2 adds it.
- **Public surface** (`index.ts`): 7 exports today (page, 3 hooks, display util, `JobStage` type, `resolvePersonId`). Adding 3 more keeps it intentional.
- **`moveJobStage`** (`api/jobsPipeline.api.ts:139`): same-axis + adjacency validation, D4 invoiced-gate probe (:157-168 — fresh invoice existence check, throws `InvoicedGateError`), then org-guarded UPDATE **without** stage/exit predicates. Untouched by this feature; the automation must not reuse it (jumps are expected, gate satisfied by construction).
- **`fetchActiveJobs`** (:15): before-paid board rows — `exit_reason IS NULL AND paid_at IS NULL`, no stage filter. `fetchAfterPaidJobs` (:32): stage-gated via `.in('stage', AFTER_PAID_STAGES)`. Both untouched; they define which board a job renders on after the automation moves it.
- Existing cast precedent for `.in()` with const tuples: `AFTER_PAID_STAGES as unknown as string[]` (:38) — reused in the new function.

## R4 — CreateInvoiceDrawer (US4 multi-fire) ground truth

`src/modules/invoicing/components/CreateInvoiceDrawer.tsx`:
- `jobId` prop documented "written to `invoices.job_id` and onto inline-created orders" (:64).
- Invoice insert stamps `job_id: jobId ?? null` (:332); **invoice creation is awaited first** (:343, "Fast path").
- Inline order creation happens later in a background continuation, stamping the same `job_id` (:429) via `createOrderAsync` (:431).
- Drawer wraps creation in try/catch (:341) treating rejection of `createInvoiceAsync` as creation failure → automation must never reject through the mutation chain (FR-010 → D3's `void` + `.catch`).

**Sequencing consequence**: `invoiced` fires first in practice; the later `quoted` fire no-ops because `'invoiced' ∉ ['enquired']`. Any other interleaving converges to `invoiced` — both UPDATEs are atomic and forward-only; Postgres row locking serializes concurrent writers on the same job row.

## R5 — Decision: atomic guarded UPDATE over fetch-then-check

The spec contract (FR-005…FR-008) describes fetch → inspect (`exit_reason`, axis membership, index comparison) → update. Both implementations satisfy every acceptance scenario; the single UPDATE with WHERE predicates was chosen because:
1. **No TOCTOU window** — fetch-then-check could read `enquired`, lose a race to the other automation fire, then blindly overwrite `invoiced` back down (exactly the US4 hazard).
2. **One round-trip** instead of two.
3. **Rows-affected read** (`.select('id')` on the UPDATE, empty = no-op) gives callers the advanced/no-op signal FR-009 needs for conditional invalidation.

Trade-off accepted: no-op *reasons* are indistinguishable (not-found vs exited vs already-past). The spec makes them all silent no-ops anyway (FR-005), so nothing is lost.

## R6 — RLS / org-scoping

`jobs` writes elsewhere in the module (`moveJobStage`, `exitJob`, `reopenJob`) all use plain org-guarded UPDATEs under the session's RLS; the automation adds predicates but changes nothing about the security model. `UPDATE … .select()` returns rows subject to the select policy — same org-scoped visibility, so the rows-affected read is reliable. Per `specs/rls-isolation-findings.md` conventions, org scoping in the query is the app-level guard; RLS remains the boundary.

## R7 — Failure-surface choice: console.warn, no toast

FR-010 allows "log/toast quietly at most". Chosen: `console.warn` only. Rationale: the only user-visible moment for a failure toast is right after a success toast for the created invoice/order — contradictory signals during the Friday demo, and the no-op path (which is common and healthy) must stay silent anyway. A follow-up DB trigger (already a noted hardening item) is the real fix for missed advances, not louder client logging.

## R8 — Baseline verification commands

- Type gate: `npx tsc --noEmit -p tsconfig.app.json` — baseline **55 pre-existing errors** (bare `npx tsc --noEmit` checks nothing — solution-style tsconfig).
- Lint: `npm run lint`.
- `npm run build` does not typecheck — never treat a green build as the gate.

## Alternatives considered and rejected

| Alternative | Rejected because |
|---|---|
| Reuse/extend `moveJobStage` | Adjacency rule forbids jumps; invoiced-gate probe is redundant by construction; spec forbids modifying it. |
| DB trigger now | Explicitly out of scope (no schema/Dashboard work); noted hardening follow-up. |
| `invalidatePipelineQueries()` helper export | Extra indirection over exporting `jobsPipelineKeys`; hides which caches move (see D2). |
| Toast on automation failure | Contradicts the adjacent creation-success toast; console.warn suffices (R7). |
| Backfill the 1 SM `enquired`-with-order job | Out of scope per spec; separate decision. |
