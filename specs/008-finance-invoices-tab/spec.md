# Feature Specification: Finance Invoices Tab

**Feature Branch**: `008-finance-invoices-tab`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: User description: "Add an 'Invoices' tab to the Finance page that shows a table of all invoices with financial details, plus a detail drawer when clicking a row."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review invoice debt at a glance (Priority: P1)

As an authenticated organization member, I can open an Invoices tab in Finance and view a complete invoice list with totals, paid amounts, remaining amounts, due dates, and status so I can prioritize collection work quickly.

**Why this priority**: A single debt-focused view is the core operational value and reduces manual cross-checking across records.

**Independent Test**: Can be fully tested by opening Finance, selecting Invoices, and confirming the table loads only current-organization, non-deleted invoices ordered by nearest due date.

**Acceptance Scenarios**:

1. **Given** I am a signed-in member of an organization with invoices, **When** I open the Invoices tab, **Then** I see a tab label with the invoice count and a table of invoices for my organization only.
2. **Given** invoices exist with different due dates, **When** the list renders, **Then** rows are ordered by due date ascending with oldest debt first.
3. **Given** an invoice is overdue, **When** the row is displayed, **Then** overdue due date and remaining debt indicators are visually emphasized.

---

### User Story 2 - Filter invoices by payment state (Priority: P2)

As an authenticated organization member, I can switch status pills between All, Unpaid, Overdue, and Paid so I can focus on a targeted payment queue.

**Why this priority**: Payment operations depend on quickly narrowing to actionable invoices by state.

**Independent Test**: Can be fully tested by changing status pills and confirming the list refreshes and shows only invoices that match the selected status.

**Acceptance Scenarios**:

1. **Given** the Invoices tab is open, **When** I select a status pill, **Then** the list refreshes and only matching invoices are shown.
2. **Given** I switch back to All, **When** data reloads, **Then** all eligible invoices for the organization are shown again.
3. **Given** no invoices match a selected filter, **When** data loads, **Then** I see a clear empty state for that filter.

---

### User Story 3 - Inspect one invoice in detail (Priority: P3)

As an authenticated organization member, I can click an invoice row to open a right-side detail drawer with payment progress, breakdown lines, important dates, and payment-link context so I can decide the next follow-up action without leaving Finance.

**Why this priority**: Teams need full context for one invoice without navigating to separate screens.

**Independent Test**: Can be fully tested by clicking any row and validating that the drawer shows header data, payment progress, totals, itemized breakdown, dates, and Stripe information when present.

**Acceptance Scenarios**:

1. **Given** I click an invoice row, **When** the drawer opens, **Then** I see invoice number, customer, status, and a close action.
2. **Given** an invoice has partial payment, **When** the drawer opens, **Then** I see a progress indicator that reflects percent paid and remaining amount.
3. **Given** Stripe-related values are absent, **When** the drawer opens, **Then** the Stripe section is omitted instead of showing blank rows.

---

### Edge Cases

- A user who is authenticated but not a member of the organization must not receive invoice data.
- Invoices with zero paid amount must show a placeholder for paid value rather than a misleading currency amount.
- Invoices missing optional financial breakdown values must hide zero-value breakdown lines in the drawer.
- Invoices with no hosted payment link must show no sent indicator.
- A status filter with no matching records must show an explicit empty state.
- Data load failures must show an error state with retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add an Invoices tab within Finance alongside existing tabs without altering existing tab behavior.
- **FR-002**: The Invoices tab label MUST display the total number of invoices currently returned for the active filter context.
- **FR-003**: The system MUST return only invoices belonging to the active organization and exclude soft-deleted records.
- **FR-004**: The system MUST support status filtering with exactly four options: All, Unpaid, Overdue, and Paid.
- **FR-005**: The system MUST refresh invoice results whenever the status filter changes.
- **FR-006**: The system MUST sort invoice results by due date ascending.
- **FR-007**: The invoice list MUST display these fields per row: invoice number, customer name, issue date, due date, total amount, paid amount, remaining amount, status, and sent indicator.
- **FR-008**: Monetary values MUST be shown in GBP currency format consistently across list and detail views.
- **FR-009**: Paid and remaining values sourced in minor units MUST be converted to pounds before display.
- **FR-010**: Paid value display MUST show a dash placeholder when the paid amount is zero.
- **FR-011**: Overdue invoices MUST visually emphasize due date and remaining amount.
- **FR-012**: Status display MUST use distinct visual treatments for paid, pending, overdue, and neutral states.
- **FR-013**: Each invoice row MUST be interactive and open a detail drawer on selection.
- **FR-014**: The detail drawer MUST open from the right and include a dismissible backdrop overlay.
- **FR-015**: The detail drawer header MUST show invoice number, customer name, status, and close action.
- **FR-016**: The detail drawer MUST include payment progress with percent paid and completion/overdue visual state.
- **FR-017**: The detail drawer MUST include an invoice totals section with total, paid, and remaining values.
- **FR-018**: The detail drawer breakdown section MUST include memorial, additional options, and permit line items and MUST only show line items with values greater than zero.
- **FR-019**: The detail drawer dates section MUST show issue and due dates, with overdue due date emphasized.
- **FR-020**: The detail drawer Stripe section MUST appear only when at least one Stripe-related field exists and include status, payment link, and lock timestamp when present.
- **FR-021**: Payment links shown in the detail drawer MUST open in a new browser tab.
- **FR-022**: The invoice experience MUST preserve organization isolation and use the existing organization context pattern.
- **FR-023**: The feature MUST provide loading, empty, and error states for table data retrieval and filter transitions.
- **FR-024**: The feature MUST introduce dedicated finance invoice data-access and query-wrapper modules consistent with existing Finance patterns.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation/routing MUST preserve the coexistence of `src/app/` (app shell/router wiring) and `src/pages/` (legacy/singleton pages), or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live under `src/modules/finance/` and MUST NOT deep-import internals from other features; shared primitives MUST be sourced from shared design system modules.
- **AC-003 (Org boundary)**: Organization filtering MUST remain mandatory for all invoice reads.
- **AC-004 (Non-regression)**: Existing Finance tabs (Balance-chase, AI changes, Recent payments) MUST remain unchanged in behavior and content.

### Key Entities *(include if feature involves data)*

- **Finance Invoice Record**: An invoice row enriched with customer identity, issue/due dates, payment totals, status, sent-link presence, and optional Stripe metadata.
- **Invoice Status Filter**: User-selected payment-state scope controlling which invoices are listed.
- **Invoice Financial Breakdown**: A grouped view of memorial, additional options, and permit amounts associated with one invoice.
- **Invoice Detail View State**: UI state that tracks selected invoice and drawer visibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of invoices shown in the Invoices tab belong to the active organization and are not soft-deleted.
- **SC-002**: Users can switch between status filters and see corresponding refreshed results in one interaction with no manual page reload.
- **SC-003**: In usability checks, at least 90% of users can identify overdue invoices and remaining debt from the table within 10 seconds.
- **SC-004**: In usability checks, at least 90% of users can open an invoice and locate payment progress plus outstanding amount within 15 seconds.
- **SC-005**: For invoices with optional Stripe data, 100% of records that include any Stripe field show a Stripe section, and 100% of records with none show no Stripe section.

## Assumptions

- Existing finance access controls and organization context are already available for authenticated organization members.
- Invoice status values already support categorization into unpaid, overdue, paid, and neutral display states.
- Invoice issue and due dates are populated consistently enough to support sort and overdue highlighting.
- Monetary formatting conventions for GBP are already established and should be reused.
- This feature is read-only and does not change invoice lifecycle actions (creation, sending, payment capture).
