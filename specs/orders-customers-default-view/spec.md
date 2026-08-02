# Feature Specification: Orders Page Default View — Customers Only

**Feature Branch**: `feature/orders-customers-default-view`
**Created**: 2026-08-03
**Status**: Draft
**Input**: User description: "Orders page default view: customers only. Derive order grouping from orders.job_id → jobs.stage join. No stage duplication on orders, no sync code. Customers = stage IN (invoiced, confirmed, in_production, fixed, complete); Enquiries = stage IN (enquired, quoted); Unassigned = job_id IS NULL. Default tab = Customers. Rederive the Client badge from the same join. Paid indicator = jobs.paid_at. Pipeline board untouched. Org-scoped everything. Demo tomorrow: only the default filter + tabs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Orders page opens on Customers by default (Priority: P1)

A mason opens the Orders page and immediately sees only orders belonging to actual customers — jobs that have reached at least the `invoiced` stage — instead of a mixed list that includes enquiries and quote-stage prospects. This is the demo-critical slice.

**Why this priority**: The demo is tomorrow and the stated demo scope is exactly the default filter plus tabs. The core pain is that the Orders page currently front-loads non-customers.

**Independent Test**: Open the Orders page as a Sears Melvin user with no interaction. The list shows exactly the orders whose linked job's stage is in (`invoiced`, `confirmed`, `in_production`, `fixed`, `complete`).

**Acceptance Scenarios**:

1. **Given** the Sears Melvin org's current data, **When** the Orders page loads with no saved filter state, **Then** the Customers tab is selected and exactly 6 orders are shown: Barnett, Marshall, Henry, Campbell (confirmed, paid) and Dean, Jalloh (invoiced, unpaid).
2. **Given** an order whose linked job is in stage `enquired` or `quoted`, **When** the Customers tab is active, **Then** that order does not appear.
3. **Given** a user in a different organization, **When** the Orders page loads, **Then** only that organization's orders appear (org scoping unchanged and enforced).

---

### User Story 2 - Switch between Customers, Enquiries, and Unassigned tabs (Priority: P2)

The mason can switch tabs to see enquiry-stage orders (`enquired`, `quoted`), every org order regardless of job linkage (All), or orders not yet linked to any job (`job_id IS NULL`), so nothing becomes unreachable when the default narrows to customers.

**Why this priority**: The default filter (P1) is useless in practice if the excluded rows have no home. Tabs are the second half of the demo scope.

**Independent Test**: Click each tab and verify the row sets partition correctly against the jobs table: Customers ∪ Enquiries ∪ Unassigned = All, with no order in two of the three partition tabs.

**Acceptance Scenarios**:

1. **Given** the Orders page is open, **When** the user selects the Enquiries tab, **Then** only orders whose linked job stage is `enquired` or `quoted` are shown.
2. **Given** the Orders page is open, **When** the user selects the Unassigned tab, **Then** only orders with `job_id IS NULL` are shown (for Sears Melvin currently 4 real rows, with 3 additional test rows hidden per the test-row assumption below).
3. **Given** a job's stage changes from `quoted` to `invoiced`, **When** the Orders page data refreshes, **Then** the order moves from Enquiries to Customers with no manual sync step — grouping is derived live from the `orders.job_id → jobs.stage` join.

---

### User Story 3 - Client badge and paid indicator agree with the tabs (Priority: P3)

The Client badge shown on order rows is derived from the same `jobs.stage` join as the tab grouping (stage ≥ `invoiced` ⇒ customer), replacing its current read of `person.is_customer`, so the badge can never contradict the tab an order sits in. A paid indicator is driven by `jobs.paid_at`.

**Why this priority**: Consistency polish. Valuable, but the demo works without it; a contradictory badge is confusing, not blocking.

**Independent Test**: For each order in the Customers tab, the Client badge shows customer status; for each order in Enquiries, it does not. Orders on jobs with a non-null `paid_at` show the paid indicator.

**Acceptance Scenarios**:

1. **Given** an order in the Customers tab whose person record has `is_customer = false`, **When** the row renders, **Then** the badge still reflects customer status (derived from stage), demonstrating the badge no longer reads `is_customer`.
2. **Given** a job with `paid_at` set (including manually marked), **When** its order row renders, **Then** the paid indicator is shown; **Given** `paid_at` is null, it is not.
3. **Given** the existing column layout in `orderColumnDefinitions.tsx`, **When** this change ships, **Then** the column itself (position, header, width) is unchanged — only the badge's data source moves.

---

### Edge Cases

- Order whose `job_id` points at a job with an `exit_reason` set: stage axis and exit axis are independent; the order still appears in whichever stage tab its stage dictates (Customers by assumption if stage ≥ `invoiced`).
- Order with `job_id` set but the join returns no row (orphaned reference, or job in another org filtered out by RLS): must not silently vanish — treated as Unassigned *(confirmed 2026-08-03)*.
- A stage value outside the known vocabulary cannot occur (DB CHECK constraint); no client-side handling for unknown stages is required beyond not crashing.
- `paid_at` set on a job whose stage is still pre-`invoiced`: paid indicator and tab grouping are independent; show whatever each axis says.
- User has an old saved/bookmarked filter state from the previous tab set: default must still resolve to Customers, not a stale tab id.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Orders page MUST derive each order's grouping from the `orders.job_id → jobs.stage` join at read time. No stage column is added to orders, and no synchronization code is written.
- **FR-002**: The stage vocabulary is fixed by the DB CHECK constraint: `enquired`, `quoted`, `invoiced`, `confirmed`, `in_production`, `fixed`, `complete`. Job exits (`exit_reason`) are a separate axis and MUST NOT affect stage-based grouping.
- **FR-003**: The Customers tab MUST show orders whose job stage is in (`invoiced`, `confirmed`, `in_production`, `fixed`, `complete`).
- **FR-004**: The Enquiries tab MUST show orders whose job stage is in (`enquired`, `quoted`).
- **FR-005**: The Unassigned tab MUST show orders with `job_id IS NULL`.
- **FR-006**: The Customers tab MUST be the default selection on page load.
- **FR-007**: The Client badge in `orderColumnDefinitions.tsx` MUST be rederived from the same `jobs.stage` join used for tab grouping (customer ⇔ stage ≥ `invoiced`), deprecating its use of `person.is_customer`. The column itself (its presence and layout) is not touched.
- **FR-008**: The paid indicator MUST be driven by `jobs.paid_at` (manual marking is a supported way for it to be set).
- **FR-009**: All queries MUST remain org-scoped by `organization_id`.
- **FR-010**: The Pipeline board MUST be left untouched; its `BEFORE_PAID_STAGES` behavior is by design and out of scope.
- **FR-011** *(resolved 2026-08-03)*: The new **Customers / Enquiries / All / Unassigned** tabs REPLACE the existing "All orders / In progress / Ready to install / Completed" tab row. The **All** tab shows every org order regardless of job linkage. The old status-based views return later as a secondary filter (out of scope for this feature).

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: This feature changes list filtering within the existing Orders page; it MUST NOT alter routing. `src/app/` / `src/pages/` coexistence is preserved.
- **AC-002 (Module boundaries)**: Changes live in the orders feature module (`src/modules/orders/`); any logic shared with other features (e.g. a stage→customer predicate) MUST be promoted rather than deep-imported.
- **AC-003 (RLS as boundary)**: Org scoping is enforced by RLS in the database; the tab filters are presentation-layer grouping, not security.

### Key Entities

- **Order**: A work order row; carries `organization_id` and an optional `job_id`. Has no stage of its own — grouping is always derived through the job.
- **Job**: Pipeline entity with `stage` (CHECK-constrained vocabulary above), `paid_at` (nullable timestamp, may be set manually), and `exit_reason` (separate axis from stage). Org-scoped.
- **Person**: Contact record with legacy `is_customer` flag; this feature deprecates that flag as the source for the Orders-page Client badge (flag itself is not removed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening the Orders page for Sears Melvin with current production data shows exactly 6 orders by default (Barnett, Marshall, Henry, Campbell, Dean, Jalloh) — verified against the pre-computed expected result.
- **SC-002**: Every order in the org appears in exactly one of the three partition tabs (Customers / Enquiries / Unassigned, allowing for test-row exclusion) and always in All; no order is reachable from two partition tabs or from none.
- **SC-003**: Zero orders display a Client badge that contradicts their tab (customer badge in Enquiries, or missing customer badge in Customers).
- **SC-004**: A job stage change is reflected in tab membership on the next data fetch with no manual sync action and no stage data written to orders.
- **SC-005**: Demo-ready: default filter + tabs function end-to-end before the demo (2026-08-04); badge/paid-indicator polish may follow.

## Assumptions

- **Exit-reason jobs in Customers**: Jobs with an `exit_reason` set still appear in the tab their stage dictates — Customers shows them by default (per stated assumption; open to revision).
- **Unassigned hides test rows**: The Unassigned tab hides `is_test` rows — of the 7 current Sears Melvin unassigned rows, 3 test rows are hidden and 4 real rows are shown (per stated assumption).
- **Scope for demo**: Only the default filter and tabs are demo-blocking; the badge rederivation and paid indicator are same-feature but not demo-gating.
- **No backend/schema changes**: The join is served by existing tables and RLS; no migration is required for this feature.
- **Existing data volumes**: List sizes are small (tens of rows per org); client-side grouping after an org-scoped joined fetch is acceptable — no pagination/performance work in scope.
