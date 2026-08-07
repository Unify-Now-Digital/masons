# Feature Specification: Orders Page Tabs Aligned with Pipeline Stages

**Feature Branch**: `feature/orders-stage-tabs`
**Created**: 2026-08-07
**Status**: Draft
**Input**: User description: "Replace the Orders page's three-group tabs (Customers / Enquiries / All / Unassigned) with eight stage tabs mirroring the Jobs Pipeline: Enquired, Quoted, Invoiced, Confirmed, In production, Fixed, Complete, Unassigned. Visual section markers label Enquired–Invoiced 'Before payment' and Confirmed–Complete 'After payment'. Default tab: Confirmed. getOrderGroup() remains the single grouping authority; its return type changes from OrderGroup to JobStage | 'unassigned'. Compiler-guided migration of all consumers; badge visuals unchanged; exited jobs stay in their stage tab with a grey Exited badge."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse orders by pipeline stage (Priority: P1)

A mason opens the Orders page and sees tabs matching the Jobs Pipeline stages they already know: Enquired, Quoted, Invoiced, Confirmed, In production, Fixed, Complete, plus All and Unassigned. The page opens on **Confirmed** (the functional successor to the old Customers default for paid customers). Clicking any stage tab shows only the orders whose linked job is in that stage. The mental model on the Orders page and the Pipeline page is now the same axis — no more translating "Customers vs Enquiries" into stages.

**Why this priority**: This is the feature. Without stage tabs there is nothing to demonstrate; everything else (markers, counts, badges) decorates this journey.

**Independent Test**: Open the Orders page for the Sears Melvin org; verify the tab strip shows the eight stage tabs plus All, the page lands on Confirmed, and switching to Invoiced shows exactly the orders whose jobs are in the `invoiced` stage (verification target: Stoddart and jalloh).

**Acceptance Scenarios**:

1. **Given** the Orders page loads with no tab query param, **When** it renders, **Then** the Confirmed tab is active and shows only orders whose job stage is `confirmed`.
2. **Given** an order whose job is in stage `quoted`, **When** the user selects the Quoted tab, **Then** the order appears; **When** any other stage tab is selected, **Then** it does not.
3. **Given** the All tab, **When** selected, **Then** every order passes the tab filter regardless of stage or unassigned status.
4. **Given** the tab a given order lands in and the Client badge on its row, **When** both are rendered, **Then** they never contradict — both derive from the same grouping authority (`getOrderGroup()`).

---

### User Story 2 - Counts, empty states, and payment-section markers (Priority: P2)

Every tab shows a live count of its orders, mirroring the pipeline page. Stage tabs with zero orders remain visible (never hidden) and render an empty state when selected. The tab strip is visually sectioned: Enquired–Invoiced under a **"Before payment"** marker, Confirmed–Complete under an **"After payment"** marker, so the payment boundary that used to be the Customers/Enquiries split stays legible.

**Why this priority**: Counts and markers carry the information the old grouped tabs encoded. Without them the stage tabs work but lose the at-a-glance payment-boundary signal.

**Independent Test**: With SM data, verify counts on each tab (target at plan time: Confirmed 8, Invoiced 2, In production/Fixed/Complete 0, Unassigned ~4 real); select an empty tab (e.g. Fixed) and see an empty state, not a hidden tab.

**Acceptance Scenarios**:

1. **Given** a stage with zero orders, **When** the page renders, **Then** its tab is visible with count 0, and selecting it shows an empty state.
2. **Given** the tab strip, **When** rendered, **Then** Enquired, Quoted, Invoiced sit under a "Before payment" section marker and Confirmed, In production, Fixed, Complete under an "After payment" marker, styled exclusively with `gardens-*` design tokens (exact marker style decided at plan time).
3. **Given** any tab, **When** the underlying order list changes, **Then** the tab's count reflects the filtered total for that tab.

---

### User Story 3 - Exited and unassigned orders remain visible and honest (Priority: P3)

Orders whose job has exited the pipeline still appear in the tab for their (last) stage, carrying a grey "Exited" badge (reusing existing pill components) — exits are an axis, never a tab. Orders with no resolvable job (null `job_id`, orphaned join, or RLS-filtered join — all indistinguishable to the client) appear under the Unassigned tab exactly as today.

**Why this priority**: Correctness at the edges. Small row counts (~4 real unassigned SM rows) but silently losing or misfiling them would break trust in the page.

**Independent Test**: Locate an SM order attached to an exited job; verify it appears in its stage tab with a grey Exited badge. Verify the Unassigned tab shows the ~4 real unassigned rows (with `is_test` handling per Task A shipped behavior).

**Acceptance Scenarios**:

1. **Given** an order whose job has an `exit_reason`, **When** the page renders, **Then** the order appears in its stage's tab (grouping ignores `exit_reason`) and its row shows a grey "Exited" badge.
2. **Given** an order with no resolvable job, **When** the page renders, **Then** it appears only under Unassigned (and All).
3. **Given** an order on a paid job (`jobPaidAt` set), **When** its row renders in any tab, **Then** the Client badge is the green "Customer" pill — badge visual logic is unchanged.

---

### Edge Cases

- **Stale persisted/linked tab values**: any previously bookmarked or persisted `customers`/`enquiries` tab value no longer matches a tab; the page must fall back gracefully (default tab), not crash or show an empty misleading filter.
- **Job stage value outside the known eight**: `getOrderGroup()` returns the stage as-is; an unknown stage would match no tab and only appear under All. No new handling — the stage enum is closed today.
- **RLS-filtered joins**: a job the user cannot see is indistinguishable from no job — the order lands in Unassigned. This is existing shipped behavior and must not change.
- **Exited job in a "before payment" stage**: appears under its stage tab within the Before payment section with the Exited badge — the section marker describes the stage, not the money actually collected.
- **All eight stage tabs simultaneously non-empty vs. all empty**: layout must hold in both extremes (tab strip with counts must not collapse or hide tabs).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Orders page MUST present tabs for exactly: Enquired, Quoted, Invoiced, Confirmed, In production, Fixed, Complete, All, Unassigned — replacing the Customers/Enquiries grouped tabs. Order: Before-payment section (Enquired, Quoted, Invoiced), After-payment section (Confirmed, In production, Fixed, Complete), then Unassigned and All outside both sections.
- **FR-002**: The default active tab MUST be Confirmed.
- **FR-003**: Each tab MUST display a count of the orders it contains; empty stage tabs MUST remain visible and render an empty state when selected (mirroring the pipeline page).
- **FR-004**: The tab strip MUST visually mark Enquired–Invoiced as "Before payment" and Confirmed–Complete as "After payment", using `gardens-*` design tokens only (marker style decided at plan time).
- **FR-005**: `getOrderGroup()` in `src/modules/orders/utils/orderGrouping.ts` MUST remain the single grouping authority; its return type MUST change from `'customers' | 'enquiries' | 'unassigned'` to `JobStage | 'unassigned'`. The header comment stating the Customers boundary is "NOT the same axis as the pipeline's" MUST be superseded — this feature resolves that divergence.
- **FR-006**: The exported stage sets in `orderGrouping.ts` MUST remain the shared vocabulary for all consumers (badge predicates, section grouping).
- **FR-007**: All known consumers of `order.group` MUST be migrated: `orderTransform.ts` (produces `order.group`, ~line 96; type ~line 48), `orderColumnDefinitions.tsx` (Client badge, ~lines 158–166), `OrdersPage.tsx` (tab filter ~line 132, default ~line 22, tab literal array ~line 215). The migration MUST be compiler-guided: the type change must make every stale `'customers'`/`'enquiries'` literal comparison a type error.
- **FR-008**: Client badge **visuals** MUST be unchanged (green "Customer" when `jobPaidAt !== null`, grey "Invoiced", etc.); only the predicate moves from group literals to stage-set membership using sets exported from `orderGrouping.ts`.
- **FR-009**: The tab an order appears under and its Client badge MUST never contradict (Task A invariant) — both derive from `getOrderGroup()` / the shared stage sets.
- **FR-010**: Orders of exited jobs MUST appear in their stage tab with a grey "Exited" badge (reuse existing pill components). Exits are an axis, never a tab; `getOrderGroup()` MUST continue to ignore `paid_at` and `exit_reason`.
- **FR-011**: Unassigned handling MUST be unchanged: null `job_id`, orphaned join, and RLS-filtered join all resolve to `'unassigned'`; Unassigned keeps its own tab with `is_test` handling per Task A shipped behavior.

### Architectural Constraints

- **AC-001 (Module boundaries)**: All changes live in `src/modules/orders/`; the stage vocabulary is imported from `@/modules/jobsPipeline` types as today — no new cross-module deep imports.
- **AC-002 (Grouping authority)**: No consumer may re-derive an order's group/stage from raw job data; everything flows through `getOrderGroup()` and the exported stage sets.
- **AC-003 (No schema changes)**: This is a client-only, org-scoped change. No migrations, no RLS changes, no writes to Churchill or Sears Melvin data.
- **AC-004 (Design tokens)**: Section markers and any new tab styling use `gardens-*` design tokens exclusively.

### Key Entities

- **Order (UI)**: A row on the Orders page; carries `group` (becomes `JobStage | 'unassigned'`), `jobPaidAt`, and exit info via its job join.
- **Job**: Pipeline entity owning `stage` (one of the eight `JobStage` values), `paid_at`, `exit_reason`. The Orders page reads it via the order→job join; never writes it (stage moves from the Orders page are out of scope).
- **Stage sets**: Exported constants in `orderGrouping.ts` partitioning stages around the payment boundary — the shared vocabulary for badge predicates and section markers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the SM org, tab counts match a live read taken at plan time — target: Confirmed 8, Invoiced 2 (Stoddart, jalloh), Quoted/Enquired per the orders' job joins, In production/Fixed/Complete 0, Unassigned ~4 real rows.
- **SC-002**: `npx tsc --noEmit -p tsconfig.app.json` reports exactly the 55 pre-existing errors and zero new ones after migration.
- **SC-003**: Zero rows change tab-vs-badge consistency: for every order, tab membership and Client badge derive from the same authority and cannot contradict (spot-checkable across all tabs).
- **SC-004**: No order disappears: total of per-stage counts + Unassigned equals the All count, before and after the change.
- **SC-005**: An order attached to an exited job is findable in its stage tab (with Exited badge) rather than vanishing from the page.

## Assumptions

- The `JobStage` type from `@/modules/jobsPipeline` enumerates exactly the eight pipeline stages used by the pipeline board; no stage values are added or renamed by this feature.
- The old `customers` default semantics ("paid customers first") is best approximated by Confirmed as the landing tab; users needing pre-payment orders switch tabs.
- The pipeline page's count/empty-state presentation is the pattern to mirror; no new empty-state design is required.
- Persisted or deep-linked tab state (if any survives in URLs/localStorage) holding `customers`/`enquiries` values falls back to the default tab; no migration of stored values is required.
- **Out of scope**: pipeline-board changes; moving a job's stage from the Orders page; outside-click-close behavior on the Orders sidebar; the vestigial `viewMode` state at `OrdersPage.tsx:24` (declared, never read — noted for the plan, not to be touched).
- **Evidence discipline**: the SM live read backing SC-001 is to be captured (read-only query + output) at plan time, per repo evidence norms.
