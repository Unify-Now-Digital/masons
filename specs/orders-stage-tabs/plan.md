# Implementation Plan: Orders Page Tabs Aligned with Pipeline Stages

**Branch**: `feature/orders-stage-tabs` | **Date**: 2026-08-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/orders-stage-tabs/spec.md` + plan-time inputs (SM live read, marker-style decision request, restated constraints)

## Summary

Replace the Orders page's three-group tabs with eight pipeline-stage tabs (plus All), default
**Confirmed**, sectioned by small uppercase "Before payment" / "After payment" labels (decision
R1). `getOrderGroup()` stays the single grouping authority; `OrderGroup` widens to
`JobStage | 'unassigned'` and the migration of its three consumers is compiler-guided —
with the explicit caveat (R3) that `OrdersPage`'s tab state must be typed `OrdersTab` in the
same change for tsc to catch the stale literals there. Badge visuals unchanged; predicate moves
to stage-set membership. Exited jobs stay in their stage tab and gain a grey `Badge` "Exited"
pill. Client-only, four files, all in `src/modules/orders/`.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite (SWC)
**Primary Dependencies**: TanStack React Query (existing `useOrdersList`), shadcn/ui `Badge`, Tailwind with `gardens-*` design tokens
**Storage**: N/A — no schema changes; reads the existing `job:jobs!job_id(stage, paid_at, exit_reason)` embed (`orders.api.ts:30`)
**Testing**: `npx tsc --noEmit -p tsconfig.app.json` (gate: exactly 55 pre-existing errors, zero new — `vite build` does NOT typecheck) + manual verification against pinned SM counts
**Target Platform**: Web (existing app)
**Project Type**: Feature-module UI change (`src/modules/orders/`)
**Performance Goals**: N/A beyond single-pass count derivation (AC-002)
**Constraints**: No changes outside `src/modules/orders/` except imports from `@/modules/jobsPipeline`'s public surface (`JobStage` type, `formatStageLabel`); `gardens-*` tokens only; per-edit approval at implement time
**Scale/Scope**: 4 files, ~31 SM orders currently visible

### Pinned expected distribution (SM org, live read 2026-08-07 — supersedes spec targets)

| Tab | Expected count | Notes |
|---|---|---|
| Enquired | 1 | |
| Quoted | 16 | |
| Invoiced | 2 | Stoddart, jalloh |
| Confirmed | 8 | default tab |
| In production | 0 | empty state |
| Fixed | 0 | empty state |
| Complete | 0 | empty state |
| Unassigned | 4 | **all 4 are `is_test` rows** (spec's "~4 real" was wrong — live read authoritative); TestPill per Task A shipped behavior |
| All | 31 | must equal sum of the above (SC-004) |

`exited = 0` in every bucket — no SM row exercises the Exited badge today; that path is verified
by tsc + code review (optional disposable SM fixture at verify time, needs approval).

## Constitution Check

- **Dual router constraint**: PASS — no routing/navigation changes; `OrdersPage` stays where the router finds it.
- **Module boundaries**: PASS — all four edited files are in `src/modules/orders/`; only imports added are from `@/modules/jobsPipeline`'s public `index.ts` (`JobStage` type — already imported today — and `formatStageLabel`, a public export). No deep imports; `BEFORE/AFTER_PAID_STAGES` are not public, so the orders module defines its own section arrays in `orderGrouping.ts` (R7).
- **Supabase + RLS**: PASS — no data-access changes; the job embed (including `exit_reason`) is already fetched. RLS-filtered joins continue to land in Unassigned (unchanged null handling).
- **Secrets**: PASS — N/A, no server-side work.
- **Additive-first**: The tab vocabulary replacement is the feature itself (spec-approved). No schema or data changes; rollback = revert the four-file commit.

## Project Structure

### Documentation (this feature)

```text
specs/orders-stage-tabs/spec.md    # spec (already on branch)
specs/orders-stage-tabs/
├── plan.md              # this file
├── research.md          # Phase 0 — decisions R1–R8 with code evidence
├── data-model.md        # Phase 1 — UIOrder/OrderGroup type changes, stage-set vocabulary
├── quickstart.md        # Phase 1 — verification script against pinned SM counts
├── contracts/           # Phase 1 — README only (no API contracts; client-only feature)
└── tasks.md             # Phase 2 — created by /tasks, NOT by /plan
```

### Source Code (files to touch — exhaustive; per-edit approval at implement time)

```text
src/modules/orders/
├── utils/orderGrouping.ts               # EDIT 1 — authority + vocabulary
├── utils/orderTransform.ts              # EDIT 2 — jobExitReason plumbing (type change propagates via alias)
├── components/orderColumnDefinitions.tsx # EDIT 3 — badge predicate → stage sets; Exited pill
└── pages/OrdersPage.tsx                 # EDIT 4 — typed tab state, sectioned tab strip, counts, empty state
```

No other files change. `SortableOrdersTable.tsx` is intentionally untouched (empty state lives
in OrdersPage, R6). The vestigial `viewMode` state at `OrdersPage.tsx:24` (declared, never
read) is **not** to be touched or removed in this feature.

**Structure Decision**: Single feature module, existing layout; no new files.

## Implementation design (edit-by-edit)

Ordering matters: EDIT 1 installs the type change *and* the `OrdersTab` union so that EDITs 3–4
are compiler-guided from the first `tsc` run.

### EDIT 1 — `src/modules/orders/utils/orderGrouping.ts`

- `export type OrderGroup = JobStage | 'unassigned'` (name kept; meaning widened).
- `export type OrdersTab = OrderGroup | 'all'` — the tab-state union OrdersPage must use (R3).
- `getOrderGroup()`: `if (!job) return 'unassigned'; return job.stage;` — continues to ignore
  `paid_at`/`exit_reason` (axes, not tabs); doc comment stays, header comment ("Customers
  boundary … NOT the same axis as the pipeline's") is **superseded** — replace with a note that
  this feature aligned the axes (spec FR-005).
- Keep `CUSTOMER_STAGES` / `ENQUIRY_STAGES` exports — now the *badge* vocabulary (predicate
  membership), no longer the tab vocabulary.
- Add ordered tab/section vocabulary (module-local mirror of the pipeline's non-public arrays,
  R7):
  ```ts
  export const ORDERS_BEFORE_PAYMENT_TABS: readonly JobStage[] = ['enquired', 'quoted', 'invoiced'];
  export const ORDERS_AFTER_PAYMENT_TABS: readonly JobStage[] = ['confirmed', 'in_production', 'fixed', 'complete'];
  ```
  with a comment that CUSTOMER/ENQUIRY partition on a different boundary (invoiced is
  "customer" but "before payment") and both are intentional.

### EDIT 2 — `src/modules/orders/utils/orderTransform.ts`

- Lines 48/96 compile unchanged under the widened alias (no error expected here — R3).
- Add `jobExitReason: string | null` to `UIOrder` and populate
  `jobExitReason: order.job?.exit_reason ?? null` (data already in the embed, R5).

### EDIT 3 — `src/modules/orders/components/orderColumnDefinitions.tsx` (lines 156–172)

- **Expected tsc errors before fix**: TS2367 at the `order.group === 'customers'` (×2) and
  `order.group === 'enquiries'` comparisons — the compiler-guided sites.
- Fix: import `CUSTOMER_STAGES`, `ENQUIRY_STAGES` from `../utils/orderGrouping`;
  `const isCustomer = (CUSTOMER_STAGES as readonly string[]).includes(order.group);`
  `const isEnquiry = (ENQUIRY_STAGES as readonly string[]).includes(order.group);`
  Badge output map **identical** to today (FR-008): green "Customer" when
  `isCustomer && order.jobPaidAt !== null`; grey "Invoiced" when `isCustomer` unpaid; grey
  "Enquiry" when `isEnquiry`; grey "Unassigned" otherwise.
- Exited pill: wrap the cell content in `flex items-center gap-1`; append
  `{order.jobExitReason && <Badge variant="grey">Exited</Badge>}` — reuses `Badge`
  (`src/shared/components/ui/badge.tsx`, `grey` = `bg-gardens-page text-gardens-txs`).
- Update the cell's authority comment to reference stage sets instead of group literals.

### EDIT 4 — `src/modules/orders/pages/OrdersPage.tsx`

- **Line 22**: `useState<OrdersTab>('confirmed')` — typing is what makes a stale `"customers"`
  literal TS2345 (R3: untyped, it would silently compile). Default = `'confirmed'` (FR-002).
- **Line 24**: `viewMode` — do not touch.
- **Lines 125–140 → single-pass counts (AC-002)**: split the memo:
  1. `scoped` = search + cemetery filter (existing logic minus tab clause);
  2. `tabCounts` = one `reduce` over `scoped` initialising all nine keys to 0 and incrementing
     `counts[order.group]` + `counts.all`;
  3. `filteredOrders` = `activeTab === 'all' ? scoped : scoped.filter(o => o.group === activeTab)`.
  Tabs, counts, and table all read the same `scoped` list — no second derivation.
- **Lines 211–233 → sectioned tab strip (R1, option a)**: inside the existing
  `overflow-x-auto scrollbar-hide` container, render three groups (`flex gap-3`):
  - "Before payment" label above `ORDERS_BEFORE_PAYMENT_TABS` buttons,
  - "After payment" label above `ORDERS_AFTER_PAYMENT_TABS` buttons,
  - unlabeled group: All, Unassigned.
  Labels: `text-[9px] font-semibold uppercase tracking-wider text-gardens-txm whitespace-nowrap`.
  Buttons keep the exact current pill classes (line 224–228). Tab labels via
  `formatStageLabel(stage)` (public jobsPipeline export); counts appended as
  `{label} ({tabCounts[value]})` on every tab, always rendered (never hidden, count 0 shown).
  Tab config array typed `{ value: OrdersTab; label: string }[]` so stale literals are TS2322.
- **Empty state (R6)**: when `!isLoading && filteredOrders.length === 0`, render instead of the
  table: title `text-sm font-medium text-gardens-tx` ("No orders in {label}" / "No orders" for
  All), hint `text-xs text-gardens-txs` — mirrors `StageBoard.tsx:83–84`.
- Stale persisted tab values: **confirmed none exist** (R4 audit: no `?tab=` param, no
  localStorage tab key; state is component-local). No guard code required.

### Expected tsc error inventory (compiler-guided migration checklist)

| Site | Expected error | Fix |
|---|---|---|
| `orderColumnDefinitions.tsx:161` (`=== 'customers'`, badge variant) | TS2367 no-overlap | stage-set membership `isCustomer` |
| `orderColumnDefinitions.tsx:162` (`=== 'customers'`, badge text) | TS2367 no-overlap | same predicate |
| `orderColumnDefinitions.tsx:166` (`=== 'enquiries'`) | TS2367 no-overlap | `isEnquiry` membership |
| `OrdersPage.tsx:22` (`useState("customers")`) | TS2345 **only after typing state `OrdersTab`** (untyped it compiles silently — typing is mandatory, same edit wave) | `useState<OrdersTab>('confirmed')` |
| `OrdersPage.tsx:132` (`order.group === activeTab`) | none (type-checks before and after) | no change beyond typed state |
| `OrdersPage.tsx:215–218` (tab literal array) | TS2322 **once array is typed `{ value: OrdersTab; … }[]`** | new sectioned tab config |
| `orderTransform.ts:48/96` | none (alias propagates) | edit only for `jobExitReason` plumbing |

Gate after all edits: `npx tsc --noEmit -p tsconfig.app.json` → **exactly 55 errors, zero new**
(baseline per memory; `vite build` proves nothing about types).

## Phase 0 — Research

Complete → [research.md](research.md). Decisions: R1 marker style (option a);
R2 pinned SM distribution incl. two spec deviations (unassigned rows are all test rows;
zero exited rows to verify against); R3 compiler-guidance mechanics (honest per-site error
analysis); R4 activeTab external-source audit (none — fallback vacuous); R5 Exited pill =
shared `Badge` grey + `jobExitReason` plumbing; R6 empty-state mirrors `StageBoard`; R7 stage
vocabulary stays module-local in `orderGrouping.ts`; R8 single-pass counts.

## Phase 1 — Design artifacts

- [data-model.md](data-model.md) — type-level changes (`OrderGroup`, `OrdersTab`, `UIOrder`,
  stage-set vocabulary); no DB entities change.
- [contracts/](contracts/) — README only: no API/edge-function contracts; client-only feature
  reading an existing embed.
- [quickstart.md](quickstart.md) — verification runbook against the pinned SM counts + tsc gate.

## Phase 2 — Task generation approach (executed by /tasks, not here)

Tasks will follow the edit ordering above (EDIT 1 → 4, then verification), one task per file
edit plus a tsc-gate task and a manual SM verification task; per-edit approval at implement
time as required by the plan constraints. `tasks.md` is intentionally **not** created by /plan.

## Complexity Tracking

No constitution violations. Empty by design.

## Progress Tracking

- [x] Phase 0: research.md complete (no NEEDS CLARIFICATION remaining)
- [x] Phase 1: data-model.md, contracts/README.md, quickstart.md generated
- [x] Constitution Check: PASS (initial and post-design re-check)
- [x] Phase 2: tasks.md generated by /tasks
- [x] Implementation (/implement) — T001–T006, T008 complete; four files, tsc-guided sites matched inventory exactly
- [ ] Verification: tsc gate PASSED (exactly 55, zero new); SM browser check vs pinned table (T007) pending manual run
