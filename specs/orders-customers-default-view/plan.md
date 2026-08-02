# Implementation Plan: Orders Page Default View — Customers Only

**Branch**: `feature/orders-customers-default-view` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/orders-customers-default-view/spec.md`

## Summary

Replace the Orders page tab row ("All orders / In progress / Ready to install / Completed") with
**Customers / Enquiries / All / Unassigned**, defaulting to Customers. Grouping is derived at read
time from the `orders.job_id → jobs.stage` join (PostgREST embedded to-one join added to the
existing list fetch) — no stage column on orders, no sync code. The Client badge in
`orderColumnDefinitions.tsx` is rederived from the same join (deprecating `person.is_customer`
there), and a paid indicator is driven by `jobs.paid_at`. Pipeline board untouched. Demo-gating:
default filter + tabs only (P1+P2).

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite (SWC)
**Primary Dependencies**: TanStack React Query, supabase-js (PostgREST embedded joins), shadcn/ui, Tailwind
**Storage**: Supabase Postgres — existing `orders` and `jobs` tables; **no schema change, no migration**
**Testing**: `npx tsc -p tsconfig.app.json --noEmit` (baseline: 55 pre-existing errors, 0 new allowed); manual verification against Sears Melvin expected result (6 customer orders)
**Target Platform**: Web (existing app shell)
**Project Type**: Web frontend feature change, single module
**Performance Goals**: N/A — org order lists are tens of rows; client-side grouping after one org-scoped fetch
**Constraints**: Demo 2026-08-04 — P1 (default = Customers) + P2 (tabs) are demo-gating; P3 (badge + paid indicator) is same-PR polish, not gating. Old status-based views return later as a secondary filter (out of scope). No writes to any org's data.
**Scale/Scope**: 6 files touched in `src/modules/orders/` + 1 additive export in `src/modules/jobsPipeline/index.ts`

### Resolutions incorporated (2026-08-03)

- **FR-011**: New tabs REPLACE the old tab row. "All" = every org order regardless of job linkage.
- **Orphaned `job_id`** (embed returns null row): treated as **Unassigned** — same code path as `job_id IS NULL`, since the embedded `job` object is null either way.
- All other spec assumptions stand (exit-reason jobs shown per their stage; Unassigned hides `is_test` rows via the existing global test-data mode).

## Constitution Check

- **Dual router constraint**: PASS — no routing/navigation change; all edits inside the existing `OrdersPage` route component.
- **Module boundaries**: PASS — feature work stays in `src/modules/orders/`. The `JobStage` type is consumed via jobsPipeline's **public surface** (`src/modules/jobsPipeline/index.ts` gains `export type { JobStage }` — additive, type-only, no runtime dependency). No deep imports.
- **Supabase + RLS**: PASS — read-only change. The embedded `jobs` join is filtered by existing org-scoped RLS; the outer query keeps `.eq('organization_id', …)`. Tab filters are presentation grouping, not security.
- **Secrets**: PASS — no edge functions, no privileged operations.
- **Additive-first**: The tab-row replacement removes the old status-tab UI (per explicit FR-011 decision). Mitigation: the underlying helpers/data are unchanged, the old views are planned to return as a secondary filter, and rollback is a single-commit revert. `person.is_customer` is deprecated **only** as the badge's data source in `orderColumnDefinitions.tsx` — the field, the fetch embed, and other consumers are untouched.

## Project Structure

### Documentation (this feature)

```text
specs/orders-customers-default-view/
├── spec.md              # Feature specification (updated with FR-011 resolution)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── orders-list-query.md   # List-fetch + grouping contract
└── tasks.md             # Phase 2 output (/tasks command — NOT created by /plan)
```

### Source Code (repository root)

```text
src/modules/orders/
├── api/orders.api.ts                      # MODIFY: fetchOrders select adds job embed
├── types/orders.types.ts                  # MODIFY: Order gains embedded `job` shape
├── utils/orderTransform.ts                # MODIFY: UIOrder gains jobStage/jobPaidAt/group
├── utils/orderGrouping.ts                 # NEW: stage sets + getOrderGroup predicate
├── components/orderColumnDefinitions.tsx  # MODIFY: Client badge from group; paid indicator
└── pages/OrdersPage.tsx                   # MODIFY: new tab row, default 'customers'

src/modules/jobsPipeline/
└── index.ts                               # MODIFY (additive): export type { JobStage }
```

**Structure Decision**: All behavior change is confined to the orders module; the only
cross-module touch is a type-only export added to jobsPipeline's existing public surface so the
stage vocabulary has exactly one source of truth
(`src/modules/jobsPipeline/types/jobsPipeline.types.ts`, itself mirroring the DB CHECK
constraint in `supabase/migrations/20260801210000_jobs_pipeline_schema.sql`).

## Implementation Design

### 1. Data: embed the job in the list fetch (P1 prerequisite)

`fetchOrders` (`src/modules/orders/api/orders.api.ts:28`) select gains one embed:

```
*, order_additional_options(cost), quote:quotes!quote_id(product_name),
person:people!person_id(is_customer), job:jobs!job_id(stage, paid_at, exit_reason)
```

- To-one FK embed (`orders.job_id → jobs.id`); returns `job: { stage, paid_at, exit_reason } | null`.
- Orphaned/RLS-filtered `job_id` yields `job: null` → identical handling to `job_id IS NULL` (Unassigned), which implements the confirmed edge-case decision with zero extra code.
- `exit_reason` is fetched for completeness/debugging but MUST NOT affect grouping (FR-002).
- Only `fetchOrders` (the list used by OrdersPage) changes; the other fetchers keep their shapes.

### 2. Types

`Order` (`src/modules/orders/types/orders.types.ts`) gains:

```ts
/** Embedded from jobs!job_id in the list fetch; null when unlinked or join returns no row. */
job?: { stage: JobStage; paid_at: string | null; exit_reason: string | null } | null;
```

with `import type { JobStage } from '@/modules/jobsPipeline'` (new public-surface export).
Confirm `normalizeOrder` passes the embedded object through untouched (it must not strip unknown keys).

### 3. Grouping predicate (single source for tabs AND badge)

New `src/modules/orders/utils/orderGrouping.ts`:

```ts
export const CUSTOMER_STAGES: readonly JobStage[] =
  ['invoiced', 'confirmed', 'in_production', 'fixed', 'complete'];
export const ENQUIRY_STAGES: readonly JobStage[] = ['enquired', 'quoted'];

export type OrderGroup = 'customers' | 'enquiries' | 'unassigned';

export function getOrderGroup(job: { stage: JobStage } | null | undefined): OrderGroup;
// null/undefined → 'unassigned'; ENQUIRY_STAGES → 'enquiries'; else 'customers'
```

`transformOrderForUI` computes and carries `group`, `jobStage`, `jobPaidAt` on `UIOrder`, so the
tab filter and the Client badge consume the identical derivation (SC-003 by construction).

### 4. Tabs (P1 + P2, demo-gating)

`OrdersPage.tsx`:

- Tab array becomes `[customers: 'Customers', enquiries: 'Enquiries', all: 'All', unassigned: 'Unassigned']` (display order per FR-011 resolution).
- `useState("all")` → `useState("customers")`. Tab state is component-local (not persisted, not in URL), so the stale-saved-state edge case is structurally impossible — verified against current code.
- `matchesTab`: `all` → true; otherwise `order.group === activeTab`.
- Delete the now-unused `isInProgress` / `isCompleted` helpers; keep `isReadyForInstall` (still used by the stats chips, which are out of scope and unchanged).
- Search, cemetery filter, stats row, kanban stub, sidebar/drawers: untouched.

### 5. Client badge + paid indicator (P3, not demo-gating)

`orderColumnDefinitions.tsx`, `customerType` column — cell render only; id/label/width/position untouched:

- Badge: `order.group === 'customers'` → green "Customer"; `'enquiries'` → grey "Enquiry"; `'unassigned'` → grey "Unassigned". Replaces `order.person?.is_customer` (add `@deprecated` note at the old accessor site; the `person` embed itself stays for other consumers).
- Paid indicator: when `order.jobPaidAt` is non-null, render a small green "Paid" pill beside the badge (`jobs.paid_at`, manual marking included). Independent of stage per spec edge case.

### 6. Test rows in Unassigned

Already handled: `useOrdersList` passes `excludeTest` from the global test-data mode, filtering
`is_test` at fetch time. Unassigned therefore shows 4 real Sears Melvin rows by default; toggling
"show test data" reveals the 3 test rows app-wide — consistent with existing behavior, no new code.

## Verification (maps to Success Criteria)

1. `npx tsc -p tsconfig.app.json --noEmit` — no new errors over the 55-error baseline.
2. Dev server as Sears Melvin: default tab is Customers with exactly 6 orders — Barnett, Marshall, Henry, Campbell (Paid pill), Dean, Jalloh (no Paid pill) (SC-001).
3. Enquiries + Unassigned + Customers row counts sum to the All count; Unassigned shows 4 rows with test data hidden (SC-002).
4. No badge/tab contradiction — same predicate feeds both (SC-003, by construction; spot-check rows).
5. Pipeline board unchanged (no jobsPipeline runtime edits — type-only export).

## Complexity Tracking

No constitution violations to justify. The single flagged item — removing the old tab row — is an
explicit product decision (FR-011) with a stated return path (secondary filter, later) and
single-commit rollback.

## Progress Tracking

- [x] Phase 0: research.md — approach decisions and alternatives
- [x] Phase 1: data-model.md, contracts/orders-list-query.md, quickstart.md
- [x] Phase 2: tasks.md — generated by `/tasks` on 2026-08-03
- [x] Constitution check: PASS (initial and post-design)
