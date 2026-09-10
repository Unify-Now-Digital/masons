# Feature Specification: Order Timeline Progress Bar

**Feature Branch**: `feature/order-timeline-progress`
**Created**: 2026-09-10
**Status**: Draft
**Input**: Arin (call, 2026-08-26): weeks elapsed against `timeline_weeks`, measured from the payment date, red when over; shown on orders. Order 226 carries 12 weeks. P2.

**Investigation**: read-only pass 2026-09-10 (four areas, CC) + live counts (Giorgi). Rulings R-1..R-5 below are settled.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff see where each paid order stands against its timeline (Priority: P1)

On the Orders page a Timeline column shows, for every order with a deposit date, a bar and "wk N of M": how many weeks have passed since the deposit against the planned number of weeks. Over plan, the bar turns red. Orders without a deposit date show "No deposit date" and no bar.

**Why this priority**: This is the ask. The Orders table is where staff scan every order at once.

**Independent Test**: Orders page, Sears Melvin: 11 orders show a bar with "wk N of 12" (one "of 16"); 4 show "No deposit date"; any order whose deposit date is more than 12 weeks ago is red. Sort/columns/presets otherwise unchanged.

**Acceptance Scenarios**:

1. **Given** an order with `deposit_date` 5 weeks ago and `timeline_weeks` 12, **When** the table renders, **Then** the cell shows a bar at ~42% in the normal tone and the text "wk 5 of 12".
2. **Given** an order with `deposit_date` 14 weeks ago and `timeline_weeks` 12, **When** the table renders, **Then** the bar is full and red and the text reads "wk 14 of 12".
3. **Given** an order with no `deposit_date`, **When** the table renders, **Then** the cell reads "No deposit date" in muted text and shows no bar.
4. **Given** an order with `installation_date` set, **When** the table renders, **Then** elapsed is measured to the installation date, not today, and the text gains "· installed".
5. **Given** the Columns dialog, **When** opened, **Then** Timeline is listed, toggleable, and on by default; hiding it persists like any other column.

---

### User Story 2 - The order sidebar's progress bar means something (Priority: P2)

The order detail sidebar already has a "Timeline Progress" bar that measures deposit date → installation date, which is null on every live order, so it never moves. It now measures the same thing as the table: elapsed against planned weeks, red when over.

**Why this priority**: Same data, same helper; the sidebar is where staff look at one order closely. Cheap once Story 1 exists.

**Independent Test**: Open an order with a deposit date from the Orders page; the sidebar bar and "wk N of M" match the table cell exactly; edit `timeline_weeks` inline and the bar updates.

**Acceptance Scenarios**:

1. **Given** the sidebar for an order with a deposit date, **When** it renders, **Then** the bar percentage, tone and label equal the table cell's for the same order.
2. **Given** `timeline_weeks` is edited in the sidebar, **When** saved, **Then** the bar and label recompute without reload.
3. **Given** no `deposit_date`, **When** the sidebar renders, **Then** it shows "No deposit date" in place of the bar (the manual `progress` percentage fallback is removed from this bar).

---

### User Story 3 - Inbox order card shows the week count (Priority: P3, cut list)

The inbox order card's "Timeline · 12 weeks" line becomes "Timeline · wk 5 of 12" when a deposit date exists (red text when over), otherwise unchanged.

**Independent Test**: Inbox, a person with a deposited order: the line reads "wk N of M".

---

### Edge Cases

- `deposit_date` in the future (typed ahead): elapsed 0, "wk 0 of M".
- `timeline_weeks` null or < 1 (should not occur — Zod min 1, DB default 12): treat as 12, never divide by zero.
- `installation_date` before `deposit_date` (bad data): elapsed clamps at 0.
- Elapsed exactly equal to planned: not over — red only when elapsed > planned.
- Archived orders: not in the table; sidebar shows whatever the row holds.
- Timezone: dates are `date` columns; compute in whole days from local midnight, weeks = floor(days / 7).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A pure helper computes, from `deposit_date`, `timeline_weeks`, `installation_date` and a `now`: `elapsedWeeks` (integer ≥ 0), `plannedWeeks` (integer ≥ 1, default 12), `percent` (0–100, clamped), `isOver` (elapsed > planned), `isInstalled`, and a `label` string. Null `deposit_date` → a `none` state. Unit-tested (vitest) for scenarios 1–4 and every edge case above.
- **FR-002**: The Orders table gains a `timeline` column: bar (`PaymentProgressBar`, normal tone under plan, red-fill tone when over) above the label text; "No deposit date" muted with no bar in the `none` state. Declared in `orderColumnDefinitions.tsx` AND in the shared registry (`tableViewPresets/config/defaultColumns.ts`) with a default width and visible-by-default, placed after `dueDate`.
- **FR-003**: Elapsed is measured to `installation_date` when present, else to today; the label appends "· installed".
- **FR-004**: The sidebar's existing Timeline Progress bar (`OrderDetailsSidebar.tsx:348-354`, `getProgressData` :186-204) is fed by the same helper; the install-date end and the manual `progress` fallback are removed from that bar only. The editable timeline field and deposit-date field are untouched.
- **FR-005**: No fetch change — `UIOrder` already carries `timelineWeeks`, `depositDate`, `installationDate`.
- **FR-006** *(cut list)*: Inbox order card text line per Story 3; no bar, no new component.
- **FR-007**: No migration, no edge-function change, no data backfill.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router)**: not touched.
- **AC-002 (Module boundaries)**: helper lives in `src/modules/orders/utils/`; `PaymentProgressBar` is already in `src/shared/components/` and is consumed as-is (tone prop; no component change unless a label slot is genuinely needed — then promote, don't fork).
- **AC-003 (RLS)**: read-only feature; no writes.
- **AC-004 (Registry drift)**: the renderer/registry drift found in investigation (3 dead ids `progress`/`depositDate`/`installationDate`, 4 unregistered live columns) is recorded in backlog and NOT reconciled here; only `timeline` is added to both.
- **AC-005 (Money rules)**: none involved.

### Key Entities *(include if feature involves data)*

- **Order timeline**: derived, never stored — `deposit_date` (start), `timeline_weeks` (planned), `installation_date` (actual end, optional).

## Success Criteria *(mandatory)*

- **SC-001**: On SM, exactly the orders with a `deposit_date` show a bar (11 on 2026-09-10 counts; re-count day-of); the rest show "No deposit date".
- **SC-002**: Every over-plan order is red; every under-plan order is not; one named record of each checked against a hand calculation.
- **SC-003**: Sidebar and table agree for the same order (named record).
- **SC-004**: Columns dialog lists Timeline; hide/show persists across reload.
- **SC-005**: Gate green (tsc 54/54, lint ≤ 8/19), new helper tests pass.
- **SC-006**: ≤ 3 hours. Cut list: Story 3 first, then "· installed" suffix.

## Rulings

- **R-1** Start = `orders.deposit_date` (11/15 SM orders carry it; `jobs.paid_at` has no code writer; portal payments key on invoice, not order). No derivation, no backfill.
- **R-2** Surfaces = Orders table column + sidebar bar; pipeline cards and inbox card out (no order embed / no bar slot), inbox text line on the cut list.
- **R-3** One pure helper; `PaymentProgressBar` renders; green/red only, no amber.
- **R-4** Registry drift recorded, not fixed.
- **R-5** Budget 3 hours.

## Out of Scope

- Auto-setting `deposit_date` from Stripe/portal payments (backlog: unify the five payment timestamps).
- Pipeline card bar; a timeline column filter or sort.
- Reconciling the column registry with the renderer.

## Assumptions

- `timeline_weeks` is a default (12) on all but one live order; the bar is honest about that and Arin is told once.
- `installation_date` is null on all live orders today; the "installed" branch is tested with a fixture, not live data.
- The Orders page stays unpaginated for the column to be verified by count.