# Tasks: Orders Page Tabs Aligned with Pipeline Stages

**Input**: Design documents from `specs/orders-stage-tabs/` (plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/README.md)
**Prerequisites**: All present. No API contracts (client-only feature); no test framework in repo — verification is the tsc gate + manual SM browser check per quickstart.md.

**Ordering mandate (user, /tasks input)**: strictly sequential EDIT 1 → 4 (EDIT 1 arms the
compiler), then tsc gate (exactly 55, zero new), then SM browser verification against plan.md's
pinned distribution table. **No files beyond the plan's four; no `viewMode` changes.**
Consequently there are **no [P] tasks** — parallelism is intentionally forbidden here: the
compiler-guided migration only works if the type change lands first and each subsequent edit
resolves the errors it exposes.

**Per-edit approval**: each source edit (T001, T003–T005) requires showing the diff and getting
approval before applying, per plan constraints.

## Format: `[ID] [Story] Description` — story tags: US1 stage tabs, US2 counts/markers/empty states, US3 exited+unassigned edges

---

## Phase 1: Arm the compiler

- [X] **T001** [US1] EDIT 1 — `src/modules/orders/utils/orderGrouping.ts`
  - Widen `export type OrderGroup = JobStage | 'unassigned'` (keep the name).
  - Add `export type OrdersTab = OrderGroup | 'all'`.
  - `getOrderGroup()`: `if (!job) return 'unassigned'; return job.stage;` — still ignores
    `paid_at`/`exit_reason` (keep that doc comment).
  - Replace the superseded header comment ("Customers boundary … NOT the same axis as the
    pipeline's") with a note that this feature aligned the Orders tabs with the pipeline axis
    (spec FR-005).
  - Keep `CUSTOMER_STAGES`/`ENQUIRY_STAGES` exports (now the *badge* vocabulary) and add:
    `export const ORDERS_BEFORE_PAYMENT_TABS: readonly JobStage[] = ['enquired', 'quoted', 'invoiced'];`
    `export const ORDERS_AFTER_PAYMENT_TABS: readonly JobStage[] = ['confirmed', 'in_production', 'fixed', 'complete'];`
    with a comment that the badge partition (invoiced = customer) and the payment-section
    partition (invoiced = before payment) intentionally differ.

- [X] **T002** Checkpoint — run `npx tsc --noEmit -p tsconfig.app.json` and confirm the new
  errors beyond the 55-error baseline are **exactly** the plan's inventory: TS2367 ×3 in
  `src/modules/orders/components/orderColumnDefinitions.tsx` (lines ~161/162/166). No errors
  expected in `orderTransform.ts` or `OrdersPage.tsx` yet (R3: OrdersPage's untyped state
  compiles silently until T005 types it). Record the actual output; any unexpected site means
  an unknown consumer — stop and reassess before proceeding.

---

## Phase 2: Sequential consumer migration (compiler-guided)

- [X] **T003** [US3] EDIT 2 — `src/modules/orders/utils/orderTransform.ts`
  - Add `jobExitReason: string | null;` to `UIOrder` (near `jobStage`/`jobPaidAt`, ~line 49).
  - Populate `jobExitReason: order.job?.exit_reason ?? null,` in `transformOrderForUI`
    (~line 98). Data already in the embed (`orders.api.ts:30`); no API change.
  - `group: OrderGroup` (line 48) and `getOrderGroup(order.job)` (line 96) stay as-is — the
    widened alias propagates.

- [X] **T004** [US1+US3] EDIT 3 — `src/modules/orders/components/orderColumnDefinitions.tsx` (Client cell, lines ~156–172)
  - Import `CUSTOMER_STAGES`, `ENQUIRY_STAGES` from `../utils/orderGrouping`.
  - Resolve the three TS2367 sites by membership predicates:
    `const isCustomer = (CUSTOMER_STAGES as readonly string[]).includes(order.group);`
    `const isEnquiry = (ENQUIRY_STAGES as readonly string[]).includes(order.group);`
  - Badge output **pixel-identical** to today (FR-008): green "Customer" when
    `isCustomer && order.jobPaidAt !== null`; grey "Invoiced" when `isCustomer` and unpaid;
    grey "Enquiry" when `isEnquiry`; grey "Unassigned" otherwise.
  - Add the Exited pill: wrap cell content in `<div className="flex items-center gap-1">` and
    append `{order.jobExitReason && <Badge variant="grey">Exited</Badge>}` (reuses the same
    shared `Badge`, `src/shared/components/ui/badge.tsx`).
  - Update the authority comment to reference stage-set membership instead of group literals.

- [X] **T005** [US1+US2] EDIT 4 — `src/modules/orders/pages/OrdersPage.tsx`
  - Line 22: `useState<OrdersTab>('confirmed')` (import `OrdersTab`, stage sets from
    `../utils/orderGrouping`; `formatStageLabel` from `@/modules/jobsPipeline`). The explicit
    type is what makes any stale `"customers"` literal TS2345.
  - Line 24 `viewMode`: **do not touch.**
  - Replace the `filteredOrders` memo (lines ~125–140) with the three-step single-pass shape
    (AC-002, plan R8): `scoped` (search + cemetery only) → `tabCounts` (one `reduce` over
    `scoped`, all nine `OrdersTab` keys init 0, increment `counts[order.group]` and
    `counts.all`) → `filteredOrders` (`activeTab === 'all' ? scoped : scoped.filter(o => o.group === activeTab)`).
  - Replace the tab literal array (lines ~214–219) with the sectioned strip (R1, option a),
    inside the existing `overflow-x-auto scrollbar-hide` container, groups `flex gap-3`:
    1. label "Before payment" over `ORDERS_BEFORE_PAYMENT_TABS` buttons,
    2. label "After payment" over `ORDERS_AFTER_PAYMENT_TABS` buttons,
    3. unlabeled group: All, Unassigned.
    Label classes: `text-[9px] font-semibold uppercase tracking-wider text-gardens-txm whitespace-nowrap`.
    Buttons keep the exact current pill classes (lines 224–228). Tab config typed
    `{ value: OrdersTab; label: string }[]`; stage labels via `formatStageLabel`; every tab
    shows `({tabCounts[value]})`, count 0 included, tabs never hidden.
  - Empty state (R6): when `!isLoading && filteredOrders.length === 0`, render instead of the
    table — title `text-sm font-medium text-gardens-tx` ("No orders in {label}" / "No orders"
    on All), hint `text-xs text-gardens-txs` (mirrors `StageBoard.tsx:83–84`).
  - No stale-tab guard needed — R4 audit confirmed `activeTab` has no URL/localStorage source.

**Checkpoint**: all four files edited; no other file touched (verify `git status` shows exactly
the four paths + specs/).

---

## Phase 3: Gates & verification

- [X] **T006** tsc gate — `npx tsc --noEmit -p tsconfig.app.json` → **exactly 55 errors, zero
  new** (compare against baseline; `npm run build` passing proves nothing about types). If
  count ≠ 55, diff the error list against baseline and fix any new site before proceeding.

- [ ] **T007** [US1+US2+US3] SM browser verification — quickstart.md §2/§4 against the pinned
  distribution (plan.md table): default tab **Confirmed (8)**; counts Enquired 1 · Quoted 16 ·
  Invoiced 2 (Stoddart, jalloh) · Confirmed 8 · In production 0 · Fixed 0 · Complete 0 ·
  Unassigned 4 (all TestPill rows) · All 31; sum invariant 27+4=31 (SC-004); empty state on
  In production/Fixed/Complete; section labels attached to their groups under horizontal
  scroll; badge never contradicts tab on any row; search updates all counts; `?order=` deep
  link and cemetery filter still work.

- [X] **T008** [US3] Exited badge path — no SM row has `exit_reason` set (live read: exited=0),
  so verify by code review of the T004 cell. Optionally propose a disposable SM fixture
  (create → verify → approved `DELETE … RETURNING id`) — **requires explicit user approval
  before any write to live data; do not create it unprompted.**

---

## Dependencies & Execution Order

Strictly linear — each task blocks the next:

```text
T001 (arm compiler) → T002 (observe expected errors) → T003 → T004 → T005 → T006 (tsc 55/0) → T007 (SM browser) → T008 (Exited review)
```

- T004 depends on T003 (`jobExitReason` must exist before the pill renders) and on T001
  (stage-set imports).
- T005 depends on T001 (`OrdersTab`, section arrays); its typing step is what closes the
  compiler-guidance gap at OrdersPage (plan R3).
- No parallel execution: same-module files with a deliberate error-cascade ordering.

## Implementation Strategy

Single MVP increment — the four edits are one atomic behavior change (partial application
would ship contradicting tabs/badges, violating FR-009). Land T001–T005 as one approved
sequence, gate with T006, verify with T007, then commit the four files together
(rollback = revert that one commit). User-story traceability: US1 lands across
T001/T004/T005; US2 entirely in T005; US3 across T003/T004 (verified T007/T008).
