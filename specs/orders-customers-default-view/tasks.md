# Tasks: Orders Page Default View — Customers Only

**Input**: Design documents from `specs/orders-customers-default-view/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/orders-list-query.md, quickstart.md

**Tests**: No automated test tasks — the spec defines verification as typecheck + the manual
quickstart fixture (this repo has no test runner wired up). Verification tasks are in Phase 6.

**Organization**: Tasks grouped by user story. US1+US2 are demo-gating (2026-08-04); US3 is polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (default = Customers), US2 (tab row), US3 (badge + paid indicator)

## Phase 1: Setup

No setup tasks — no new dependencies, no schema changes, no scaffolding. Work happens on the
existing branch `feature/orders-customers-default-view`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data plumbing + the single grouping authority that every story consumes.

**⚠️ CRITICAL**: All three user stories depend on this phase.

- [ ] T001 Export the stage vocabulary from jobsPipeline's public surface: in
      `src/modules/jobsPipeline/index.ts` add `export type { JobStage } from './types/jobsPipeline.types';`
      (type-only, additive — no runtime change, pipeline board untouched).
- [ ] T002 Add the embedded job shape to the `Order` interface in
      `src/modules/orders/types/orders.types.ts`:
      `job?: { stage: JobStage; paid_at: string | null; exit_reason: string | null } | null;`
      with `import type { JobStage } from '@/modules/jobsPipeline';` and a JSDoc line
      "Embedded from jobs!job_id in the list fetch; null when unlinked or join returns no row."
      Also add a `@deprecated for the Orders-page Client badge — derive from job.stage instead`
      note on the existing `person?: { is_customer: boolean }` field's JSDoc. (Depends: T001)
- [ ] T003 [P] Extend the list fetch in `src/modules/orders/api/orders.api.ts` `fetchOrders`:
      change the select string to
      `'*, order_additional_options(cost), quote:quotes!quote_id(product_name), person:people!person_id(is_customer), job:jobs!job_id(stage, paid_at, exit_reason)'`.
      Left embed only — do NOT use `!inner` (contract guarantee: no order row is ever dropped).
      Then read `src/modules/orders/utils/numberParsing.ts` `normalizeOrder` and confirm it passes
      the embedded `job` object through untouched (it must not strip unknown keys); adjust the
      `RawOrder` type there if it enumerates embed keys. Only `fetchOrders` changes — leave
      `fetchOrder`, `fetchOrdersByPersonId(s)`, `fetchOrdersByInvoice`, `fetchOrdersByJobId` as-is.
      (Depends: T002)
- [ ] T004 [P] Create `src/modules/orders/utils/orderGrouping.ts` per
      `contracts/orders-list-query.md`:
      `CUSTOMER_STAGES: readonly JobStage[] = ['invoiced','confirmed','in_production','fixed','complete']`,
      `ENQUIRY_STAGES: readonly JobStage[] = ['enquired','quoted']`,
      `export type OrderGroup = 'customers' | 'enquiries' | 'unassigned'`, and pure total function
      `getOrderGroup(job: { stage: JobStage } | null | undefined): OrderGroup` —
      null/undefined → `'unassigned'`; stage in ENQUIRY_STAGES → `'enquiries'`; else `'customers'`.
      Must ignore `paid_at`/`exit_reason`. Do NOT import or reuse `BEFORE_PAID_STAGES`
      (different axis: pre-paid, not pre-invoiced — see research.md R2). (Depends: T002)
- [ ] T005 Extend `UIOrder` + `transformOrderForUI` in
      `src/modules/orders/utils/orderTransform.ts`: add fields
      `group: OrderGroup`, `jobStage: JobStage | null`, `jobPaidAt: string | null`; populate via
      `group: getOrderGroup(order.job)`, `jobStage: order.job?.stage ?? null`,
      `jobPaidAt: order.job?.paid_at ?? null`. Keep the existing `person` field untouched.
      (Depends: T003, T004)

**Checkpoint**: `UIOrder.group` exists and is derived from the join — stories can start.

---

## Phase 3: User Story 1 — Orders page opens on Customers by default (Priority: P1) 🎯 MVP

**Goal**: Default view shows only customer orders (job stage ≥ invoiced).

**Independent Test**: Load Orders as Sears Melvin with test data off → Customers active, exactly
6 rows (Barnett, Marshall, Henry, Campbell, Dean, Jalloh).

- [ ] T006 [US1] In `src/modules/orders/pages/OrdersPage.tsx`: change
      `useState("all")` (line ~22) to `useState("customers")`, and replace the `matchesTab`
      expression in `filteredOrders` with group-based logic:
      `activeTab === 'all' || order.group === activeTab`. Import nothing new (group is on
      `UIOrder`). Leave search, cemetery filter, stats, sidebar/drawers untouched.
      (Depends: Phase 2)

**Checkpoint**: Default load shows customers-only (old tab labels may still render until T007 —
acceptable mid-branch state, not shippable alone).

---

## Phase 4: User Story 2 — Customers / Enquiries / All / Unassigned tab row (Priority: P2)

**Goal**: New tab row REPLACES "All orders / In progress / Ready to install / Completed" (FR-011).

**Independent Test**: Each tab filters per contract; Customers ∪ Enquiries ∪ Unassigned = All.

- [ ] T007 [US2] In `src/modules/orders/pages/OrdersPage.tsx`: replace the tab array
      (lines ~224–229) with
      `[{ value: 'customers', label: 'Customers' }, { value: 'enquiries', label: 'Enquiries' }, { value: 'all', label: 'All' }, { value: 'unassigned', label: 'Unassigned' }]`
      (display order per FR-011). Delete the now-unused `isInProgress` and `isCompleted` helpers;
      KEEP `isReadyForInstall` (still used by the stats chips). No other UI changes.
      (Depends: T006 — same file, sequential)

**Checkpoint**: Demo-gating scope (P1+P2) complete — quickstart rows 1, 2, 5, 6, 7, 8 must pass.

---

## Phase 5: User Story 3 — Client badge + paid indicator from the same join (Priority: P3)

**Goal**: Badge can never contradict the tab; paid state from `jobs.paid_at`.

**Independent Test**: Every Customers-tab row shows a green "Customer" badge regardless of
`person.is_customer`; rows with non-null `paid_at` show a Paid pill.

- [ ] T008 [US3] In `src/modules/orders/components/orderColumnDefinitions.tsx`, `customerType`
      column: rewrite `renderCell` to derive from `order.group` —
      `'customers'` → `<Badge variant="green">Customer</Badge>`,
      `'enquiries'` → `<Badge variant="grey">Enquiry</Badge>`,
      `'unassigned'` → `<Badge variant="grey">Unassigned</Badge>`.
      Remove the `order.person?.is_customer` read and the now-unused `getPersonTypeVariant`
      helper. Column `id`/`label`/`defaultWidth`/position MUST NOT change.
      (Depends: Phase 2; parallel with Phase 3/4 — different file)
- [ ] T009 [US3] Same file, same cell: after the badge, render a paid pill when
      `order.jobPaidAt !== null` — small green pill matching existing pill styling (see the
      stats-chip classes in OrdersPage for the `gardens-grn` pattern):
      `<span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-gardens-grn-lt text-gardens-grn-dk border-gardens-grn">Paid</span>`.
      Independent of stage — render for any group. (Depends: T008 — same file, sequential)

**Checkpoint**: All user stories complete.

---

## Phase 6: Verification & Polish

**Purpose**: Prove SC-001…SC-005 before merging to `staging`.

- [ ] T010 Typecheck: `npx tsc -p tsconfig.app.json --noEmit` — pass = 55 pre-existing errors,
      0 new. (Bare `npx tsc --noEmit` checks nothing; `npm run build` does not typecheck.)
- [ ] T011 [P] Lint touched files: `npm run lint` — no new warnings in the 6 changed files.
- [ ] T012 Run the quickstart manual fixture (`specs/orders-customers-default-view/quickstart.md`,
      all 11 rows) as Sears Melvin in dev; re-verify the 6/4 counts against live data (they were
      verified 2026-08-03 and can move). Record actual counts + date in a comment block at the
      bottom of quickstart.md. READ-ONLY — no writes to Churchill/Sears Melvin data.
- [ ] T013 Optional (test org ONLY, never a live org): SC-004 live-derivation check — move a test
      job `quoted` → `invoiced` on the pipeline board, refetch Orders, confirm the order moves
      Enquiries → Customers with no order-row write.
- [ ] T014 Update `spec.md` Status from Draft to Implemented once T010–T012 pass.

---

## Dependencies & Execution Order

```
T001 → T002 → { T003 [P] , T004 [P] } → T005
T005 → T006 → T007            (OrdersPage.tsx — sequential, same file)
T005 → T008 → T009            (orderColumnDefinitions.tsx — sequential, same file; parallel with T006–T007)
{T007, T009} → T010 → T011/T012 → T013 → T014
```

- **Demo-critical path** (if time-boxed before 2026-08-04): T001–T007 + T010 + quickstart rows
  1, 2, 5, 6, 7, 8. T008–T009 (US3) can land after the demo.
- **Parallel opportunities**: T003 ∥ T004 (different files); after T005, the OrdersPage track
  (T006–T007) ∥ the column-definitions track (T008–T009); T011 ∥ T012.

### Parallel execution example (after T005)

```bash
# Two independent tracks, different files:
Task: "T006+T007 — OrdersPage.tsx: default 'customers', group-based matchesTab, new tab row, remove dead helpers"
Task: "T008+T009 — orderColumnDefinitions.tsx: badge from order.group + Paid pill from jobPaidAt"
```

---

## Notes

- 7 files total: 6 in `src/modules/orders/` + 1 type-only export line in
  `src/modules/jobsPipeline/index.ts`. No migrations, no edge functions, no data writes.
- Contract authority: `contracts/orders-list-query.md` — if any task conflicts with it, the
  contract wins.
- Commit after each phase checkpoint; branch merges to `staging` (trunk) once Phase 6 passes.
