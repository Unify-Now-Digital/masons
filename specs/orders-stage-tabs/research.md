# Research: Orders Page Tabs Aligned with Pipeline Stages

**Date**: 2026-08-07 | **Branch**: `feature/orders-stage-tabs`
All findings below were verified by reading the current source on this branch.

## R1 — Section-marker style decision

**Decision: option (a) — small uppercase text labels above the tab groups.**

Rationale:
- The existing strip is a compact single row of pill buttons inside
  `overflow-x-auto scrollbar-hide` (`OrdersPage.tsx:213`). Labels rendered *inside* the scroll
  container, one per group (`flex flex-col` per section: label above, buttons below), scroll
  together with their tabs — the marker can never detach from its section, satisfying the
  "must survive overflow-x scroll" requirement structurally rather than with sticky hacks.
- Option (b) (vertical divider + labels) puts the label ambiguously between groups; option (c)
  (background panels) adds visual weight the page's flat pill style doesn't use anywhere else.
- Token spec: label = `text-[9px] font-semibold uppercase tracking-wider text-gardens-txm
  whitespace-nowrap`; group separation = `gap-3` on the scroll container; no new tokens, all
  `gardens-*`. Wording mirrors the pipeline page exactly: "Before payment" / "After payment"
  (`JobsPipelinePage.tsx:39/43`). The All/Unassigned group gets no label (not a payment section).

## R2 — SM live-read evidence (pins SC-001)

Read supplied at plan time (orders joined to jobs, SM org):

| bucket | orders | test_rows | exited |
|---|---|---|---|
| enquired | 1 | 0 | 0 |
| quoted | 16 | 0 | 0 |
| invoiced | 2 | 0 | 0 |
| confirmed | 8 | 0 | 0 |
| UNASSIGNED | 4 | 4 | 0 |

Pinned expected tab counts (this table, not the spec's targets):
**Enquired 1 · Quoted 16 · Invoiced 2 · Confirmed 8 · In production 0 · Fixed 0 · Complete 0 ·
Unassigned 4 · All 31** (sum check: 27 staged + 4 unassigned = 31).

Two deviations from the spec's targets, resolved in favour of the live read:
1. **Unassigned rows are all test rows** (`test_rows = 4`), not "~4 real" as the spec assumed.
   They render with the existing `TestPill` treatment (Task A shipped behavior); no real
   unassigned rows exist today.
2. **`exited = 0` in every bucket** — no SM row exercises the Exited badge. That path is
   verified by code review + tsc only, unless a disposable SM fixture is created at verify time
   (per the established disposable-fixture pattern; optional, requires per-change approval).

## R3 — Compiler-guidance mechanics (what tsc actually flags)

`OrderGroup` becomes `JobStage | 'unassigned'`. Honest per-site analysis:

- `orderColumnDefinitions.tsx:161/162/166` — `order.group === 'customers'` (×2) and
  `=== 'enquiries'`: **TS2367** ("comparison appears to be unintentional — no overlap"), because
  the literals leave the union. These are the only sites the alias change flags *by itself*.
- `orderTransform.ts:48/96` — `group: OrderGroup` / `getOrderGroup(order.job)`: compile clean
  under the new alias (the alias propagates). Edited anyway to plumb `jobExitReason` (R5).
- `OrdersPage.tsx:22` — `useState("customers")` infers `string`, so it would **silently keep
  compiling**. Compiler guidance must be *installed*: type the state
  `useState<OrdersTab>(...)` (`OrdersTab = OrderGroup | 'all'` exported from orderGrouping.ts).
  With that, the stale `"customers"` initial value is **TS2345**.
- `OrdersPage.tsx:132` — `order.group === activeTab` type-checks before and after; correct
  semantics arrive via the typed state + new tab values. No error expected here.
- `OrdersPage.tsx:214–219` — tab literal array: typing it `{ value: OrdersTab; label: string }[]`
  (or deriving values from the exported stage list) makes stale `'customers'`/`'enquiries'`
  entries **TS2322**.

Conclusion: the migration is compiler-guided **provided** the `OrdersTab` typing lands in the
same edit as the alias change. Order of edits in plan.md enforces this.

## R4 — `activeTab` external-source audit (stale persisted values)

Verified by grep over `OrdersPage.tsx` (`setActiveTab|searchParams.get|localStorage`):
- `activeTab` is written in exactly two places: `useState` init (line 22) and the tab-button
  `onClick` (line 222).
- `searchParams` is read only for `cemetery` (line 127/246) and `order` deep-link (line 156).
  **No `?tab=` param exists.**
- The only localStorage key is `orders.columns.v1` (column state), never tab state.

**Conclusion: no external source can inject `'customers'`/`'enquiries'` at runtime.** The
fallback requirement is satisfied vacuously; the only stale value is the `useState` literal
itself, which the typed default `'confirmed'` replaces. No migration/guard code needed.

## R5 — Exited badge: component and data plumbing

- **Component**: `Badge` from `src/shared/components/ui/badge.tsx`, `variant="grey"`
  (`bg-gardens-page text-gardens-txs`, gardens tokens) — already imported by
  `orderColumnDefinitions.tsx` for the Client badge. No new component.
- **Data**: `exit_reason` is already fetched (`orders.api.ts:30` embeds
  `job:jobs!job_id(stage, paid_at, exit_reason)`) and typed (`orders.types.ts:111`). Only
  missing link: `UIOrder` doesn't carry it — add `jobExitReason: string | null` in
  `orderTransform.ts` (populate `order.job?.exit_reason ?? null`).
- **Placement**: same Client cell, `{order.jobExitReason && <Badge variant="grey">Exited</Badge>}`
  beside the client badge in a `flex gap-1` wrapper. Grouping continues to ignore `exit_reason`
  (axis, not tab).

## R6 — Empty state pattern

`SortableOrdersTable.tsx` has **no empty-state handling** (renders a header-only table when
`orders` is empty — verified: no `length === 0`/colSpan/empty branch). The pipeline's pattern is
`StageBoard.tsx:83–84`: title `text-sm font-medium text-gardens-tx`, hint
`text-xs text-gardens-txs`. Mirror that in `OrdersPage.tsx`: when
`!isLoading && filteredOrders.length === 0`, render the empty state instead of the table
(no changes to SortableOrdersTable).

## R7 — Stage vocabulary and labels

- `JobStage` and `formatStageLabel` are on jobsPipeline's **public surface**
  (`src/modules/jobsPipeline/index.ts:5–6`) — importable without deep imports.
  `formatStageLabel('in_production')` → `"In production"`, exactly the tab labels needed.
- `BEFORE_PAID_STAGES`/`AFTER_PAID_STAGES` are **not** public exports; per module-boundary
  rules the orders module defines its own ordered section arrays in `orderGrouping.ts`
  (which the feature designates as the shared vocabulary for all orders consumers anyway).
  Existing `CUSTOMER_STAGES`/`ENQUIRY_STAGES` stay for the badge predicate — note they
  partition differently (customers = invoiced+after-paid) than the payment sections
  (before = enquired/quoted/invoiced); both partitions live side by side with comments.

## R8 — Single-pass tab counts (AC-002)

Current `filteredOrders` memo applies tab + search + cemetery in one filter (line 125–140).
Restructure: `scoped` memo (search + cemetery only) → `tabCounts` = **one `reduce`** over
`scoped` (init all nine tabs at 0; increment `counts[order.group]` and `counts.all`) →
`filteredOrders` = tab filter over the same `scoped`. Tabs and counts read the identical list;
no second derivation.
