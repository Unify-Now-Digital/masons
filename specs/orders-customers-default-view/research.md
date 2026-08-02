# Research: Orders Page Default View — Customers Only

**Date**: 2026-08-03 | **Plan**: [plan.md](./plan.md)

## R1. How to derive grouping from `orders.job_id → jobs.stage`

**Decision**: PostgREST embedded to-one join in the existing `fetchOrders` select:
`job:jobs!job_id(stage, paid_at, exit_reason)`. Group client-side with a pure predicate.

**Rationale**: The list fetch already embeds three relations the same way
(`order_additional_options`, `quote:quotes!quote_id`, `person:people!person_id` —
`src/modules/orders/api/orders.api.ts:30`), so this is the established pattern, one query, no new
API surface. Org lists are tens of rows; client-side grouping is trivially cheap.

**Alternatives considered**:
- *Postgres view (`orders_with_stage`)*: needs a migration (hand-applied per guardrails) and
  `security_invoker` care per `specs/rls-isolation-findings.md` — unjustified for a read shape the
  embed already provides. Rejected.
- *Server-side filter per tab (`.in('job.stage', …)` with `!inner`)*: one round-trip per tab
  switch, and `!inner` drops unlinked orders — wrong for All/Unassigned. Rejected.
- *Stage column on orders + sync*: explicitly forbidden by the feature description. Rejected.

## R2. Where the stage vocabulary lives

**Decision**: Import `JobStage` from `@/modules/jobsPipeline` after adding a type-only export to
that module's `index.ts`. Define the *grouping* sets (`CUSTOMER_STAGES`, `ENQUIRY_STAGES`) in the
orders module (`utils/orderGrouping.ts`).

**Rationale**: `jobsPipeline.types.ts` is the operative contract for job shapes (the shared
Supabase client is `createClient<any>`, so generated DB types are not in play) and already mirrors
the DB CHECK constraint. The constitution requires consuming other modules via their public
surface; adding `export type { JobStage }` is additive and runtime-free. The customer/enquiry
split is an *orders-page* concept today, so its sets live in orders; promote to `src/shared/` only
when a second module needs them (constitution: promote when shared, not before).

**Alternatives considered**:
- *Duplicate the stage union in orders*: two sources of truth for a CHECK-constrained vocabulary;
  drift risk. Rejected.
- *Put grouping sets in `src/shared/`*: premature — single consumer. Rejected for now; noted as
  the promotion path.
- *Reuse `BEFORE_PAID_STAGES`*: different axis — it is `['enquired','quoted','invoiced']`
  (pre-**paid**), while the Customers boundary is pre-**invoiced**. Overlapping but distinct
  concepts; reuse would conflate them. The pipeline board keeps `BEFORE_PAID_STAGES` by design.

## R3. Orphaned `job_id` handling

**Decision** *(user-confirmed)*: treat as Unassigned.

**Rationale**: With a left embed, `job_id IS NULL`, a dangling reference, and an RLS-filtered job
all surface identically as `job: null` — one code path (`getOrderGroup(null) → 'unassigned'`),
no row ever silently vanishes. Cross-org `job_id` cannot legitimately occur (both tables
org-scoped), but if it ever did, RLS makes it look orphaned → Unassigned, which is the safe
rendering.

## R4. Tab replacement vs coexistence (FR-011)

**Decision** *(user-resolved)*: REPLACE the old row with Customers / Enquiries / All / Unassigned;
default Customers; All = every org order. Old status-based views (In progress / Ready to install /
Completed) return later as a secondary filter — out of scope.

**Implementation note**: current tab state is a plain `useState("all")` in `OrdersPage.tsx:22` —
not persisted to localStorage and not in the URL — so changing the initial value to `"customers"`
fully implements the default with no stale-state migration. The spec's "old saved filter state"
edge case is structurally impossible today (verified by reading the page; only *column* state is
persisted under `orders.columns.v1`).

## R5. Paid indicator placement

**Decision**: Small green "Paid" pill next to the Client badge inside the existing `customerType`
cell, shown when embedded `job.paid_at` is non-null.

**Rationale**: The feature description constrains "do not touch the column" (position/layout) and
ties paid state to the same join; rendering inside the existing cell changes only the cell's data
source and content, adds no column, and keeps the demo table stable. P3 — can be dropped without
affecting demo-gating scope.

## R6. Test rows in Unassigned

**Decision**: No new code. The existing global test-data mode (`useTestDataMode` →
`fetchOrders(..., { excludeTest })`) already filters `is_test` rows at fetch time for every tab.

**Rationale**: Matches the spec assumption (Unassigned shows 4 of 7 current SM rows) and keeps
one consistent visibility rule app-wide. Toggling "show test data" reveals the 3 test rows in
Unassigned exactly as it does elsewhere — expected, not a bug.

## R7. Verified expected result (pre-computed, from feature description)

Sears Melvin, Customers tab, test data hidden: **6 orders** —
Barnett, Marshall, Henry, Campbell (stage `confirmed`, `paid_at` set) and Dean, Jalloh
(stage `invoiced`, unpaid). Unassigned: 4 real rows (7 minus 3 test). These figures were verified
against production data by the user on 2026-08-03 and serve as the acceptance fixture; re-verify
counts at demo time since live data can move.
