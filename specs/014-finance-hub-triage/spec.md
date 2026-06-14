# Feature Specification: Finance Hub — Outstanding Invoice Triage

**Feature Branch**: `014-finance-hub-triage`  
**Created**: 2026-06-14  
**Status**: Draft  
**Input**: User description: "Finance hub: an overview/triage landing tab in the Finance module for tracking outstanding invoice balances, scoped to the active organization."

## Overview

### Problem

Office staff need to see at a glance what customers still owe, what is overdue, and — most critically — which invoices have received a deposit or first payment but still carry an outstanding balance. Second payments are the client's stated primary fear: they slip through or go badly overdue when attention is spread across orders, messages, and the full invoice list.

### Goal

Add a **Finance hub** — an overview and triage landing tab within the existing Finance module — that aggregates outstanding invoice balances for the active workshop and routes staff into the existing filterable Invoices table (and invoice detail view) with the right filters pre-applied. The hub is **not** a second invoice table; it is a prioritisation layer built on the same invoice truth as the detail drawer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See what is owed at a glance (Priority: P1)

As an authenticated member of the active workshop, when I open Finance I land on a hub tab that shows headline figures — total outstanding balance, count of unpaid invoices, and total overdue balance — so I can immediately understand collection pressure without scanning the full invoice list.

**Why this priority**: Headline totals are the fastest path to situational awareness and the foundation every other triage action builds on.

**Independent Test**: Open Finance with a workshop that has a mix of paid, unpaid, partial, and overdue invoices; confirm the three headline figures appear and match the sum of remaining balances shown when opening each included invoice in the existing detail drawer.

**Acceptance Scenarios**:

1. **Given** I am viewing Finance for my active workshop, **When** the hub tab loads, **Then** I see total outstanding balance, count of unpaid invoices, and total overdue balance for that workshop only.
2. **Given** all eligible invoices for my workshop are fully paid, **When** the hub loads, **Then** outstanding and overdue totals are zero and the unpaid count is zero.
3. **Given** I switch to a different workshop in the workspace switcher, **When** the hub reloads, **Then** all figures reflect only the newly active workshop's invoices.

---

### User Story 2 — Prioritise partial and overdue invoices (Priority: P1)

As office staff responsible for chasing payments, I can review an attention list of invoices that still carry an outstanding balance, each flagged as **PARTIAL** (part-payment received, balance remaining) and/or **OVERDUE** (balance owed past due date), with partial-and-overdue invoices surfaced as the highest priority, so second payments do not slip.

**Why this priority**: This directly addresses the client's primary fear — deposit taken, balance still owed, follow-up missed.

**Independent Test**: Seed or use real workshop data with at least one invoice that is partially paid and not overdue, one partially paid and overdue, one unpaid and overdue, and one fully paid; confirm only the three with a remaining balance appear, flags are correct, and partial+overdue sorts above the rest.

**Acceptance Scenarios**:

1. **Given** an invoice has received a part-payment and still has a remaining balance, **When** it appears in the attention list, **Then** it is flagged **PARTIAL**.
2. **Given** an invoice has an outstanding balance and its due date is in the past, **When** it appears in the attention list, **Then** it is flagged **OVERDUE**.
3. **Given** an invoice is both partial and overdue, **When** the attention list is ordered, **Then** it appears before invoices that are only partial or only overdue.
4. **Given** an invoice is fully paid (including when marked paid manually/offline with no remaining balance), **When** the hub loads, **Then** that invoice does not appear in the attention list and does not contribute to outstanding totals.
5. **Given** I select an invoice in the attention list, **When** the detail view opens, **Then** the remaining balance and paid amount match exactly what the hub showed for that invoice.

---

### User Story 3 — Triage by due-date horizon (Priority: P2)

As office staff planning follow-up, I can use a horizon strip that groups outstanding invoices into **Overdue**, **Due within 30 days**, **Due later**, and **No reliable date**, and click any segment to open the existing Invoices tab with filters pre-applied so I can work the queue without rebuilding filters manually.

**Why this priority**: Horizon grouping turns totals into actionable work queues while keeping the hub lightweight.

**Independent Test**: With invoices in each horizon bucket, click each segment and confirm the Invoices tab opens with the matching subset; counts in the strip match the filtered list.

**Acceptance Scenarios**:

1. **Given** outstanding invoices exist across multiple due-date horizons, **When** the horizon strip renders, **Then** each segment shows a count (and optionally balance subtotal) for its bucket.
2. **Given** I click the **Overdue** segment, **When** navigation completes, **Then** the Invoices tab opens filtered to overdue outstanding invoices only.
3. **Given** I click **Due within 30 days**, **When** navigation completes, **Then** the Invoices tab opens filtered to unpaid invoices due on or before 30 days from today and not yet overdue.
4. **Given** I click **Due later**, **When** navigation completes, **Then** the Invoices tab opens filtered to unpaid invoices due more than 30 days from today with a reliable due date.
5. **Given** I click **No reliable date**, **When** navigation completes, **Then** the Invoices tab opens filtered to outstanding invoices whose due date is missing or treated as unreliable (see FR-012).

---

### User Story 4 — Drill into detail without number drift (Priority: P2)

As staff acting on a flagged invoice, I can open the existing invoice detail view from the hub and trust that every monetary figure in the hub matches the detail view, so I never chase the wrong amount or double-count balances.

**Why this priority**: Trust in figures is non-negotiable for payment follow-up with bereaved families.

**Independent Test**: For a sample of hub-listed invoices, compare hub remaining balance and headline roll-ups against the detail view; zero mismatches.

**Acceptance Scenarios**:

1. **Given** an invoice appears in hub totals or the attention list, **When** I open its detail view, **Then** total, paid, and remaining amounts are identical in both places.
2. **Given** headline total outstanding is displayed, **When** I sum the remaining balances of all invoices included in that total, **Then** the sum equals the headline figure exactly.

---

### Edge Cases

- A fully paid invoice with status still marked pending but zero remaining balance must be excluded from outstanding totals and lists.
- An invoice paid offline/manually with no system-recorded remaining balance must be treated as fully paid and excluded, even if payment history is sparse.
- Invoices with placeholder or implausible far-future due dates must not appear as "due later" or be miscounted as overdue; they belong in **No reliable date** only.
- Invoices with no due date must appear in **No reliable date**, not in overdue or due-soon buckets.
- Cancelled and draft invoices must not appear in outstanding totals or triage lists.
- Invoices belonging to other workshops must never appear when a different workshop is active.
- Unfinalized/abandoned website-origin drafts and non-workshop invoices must not appear; finalized pending website-origin invoices with a real balance are included.
- Test or seed invoices used for demos must be excluded even when test flags are absent or unreliable in production data.
- When no invoices qualify for a horizon segment or the attention list, the hub shows a clear empty state rather than hiding the section.
- Data load failures show an error state with retry; partial data must not present misleading totals.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add a Finance hub tab within the existing Finance module that serves as the default landing tab when staff open Finance.
- **FR-002**: The hub MUST display three headline figures scoped to the active workshop: total outstanding balance, count of unpaid invoices with a remaining balance, and total overdue balance (sum of remaining balances on overdue invoices).
- **FR-003**: Outstanding balance MUST include only invoices that are not fully paid — i.e. they have a remaining balance greater than zero using the same remaining-balance rules as the existing invoice detail view.
- **FR-004**: Fully paid invoices MUST be excluded from all hub totals, attention lists, and horizon counts — including invoices marked paid manually or offline where no remaining balance is recorded.
- **FR-005**: Headline figures, attention-list amounts, and horizon segment totals MUST use the same remaining-balance calculation as the existing invoice detail view; the hub MUST NOT introduce a parallel or divergent calculation.
- **FR-006**: The hub MUST present an attention list of outstanding invoices (not a full duplicate invoice table), ordered with highest priority first: partial-and-overdue, then overdue-only, then partial-only, then other outstanding.
- **FR-007**: Each attention-list row MUST show enough context to act (at minimum: invoice reference, customer name, remaining balance, due date when reliable) and MUST carry distinct visual flags for **PARTIAL** and **OVERDUE** when applicable.
- **FR-008**: An invoice MUST be flagged **PARTIAL** when it has received at least one payment and still has a remaining balance greater than zero.
- **FR-009**: An invoice MUST be flagged **OVERDUE** when it has a remaining balance greater than zero and its due date is before today, using the same overdue rules as the existing Finance invoice list and detail view.
- **FR-010**: The hub MUST include a horizon strip with four segments: **Overdue**, **Due within 30 days**, **Due later**, and **No reliable date**, each showing the count of qualifying outstanding invoices (balance subtotals optional but must be consistent with FR-005 if shown).
- **FR-011**: Clicking a horizon segment MUST navigate to the existing Invoices tab with filters pre-applied so the resulting list matches that segment's bucket.
- **FR-012**: Invoices with missing due dates OR due dates classified as unreliable placeholders (implausible far-future dates used as stand-ins) MUST be bucketed only under **No reliable date** and MUST NOT contribute to overdue, due-within-30-days, or due-later counts.
- **FR-013**: Selecting an attention-list row or equivalent hub action MUST open the existing invoice detail view for that invoice.
- **FR-014**: All hub data MUST be scoped strictly to the active workshop; invoices from other workshops MUST NOT appear.
- **FR-015**: Non-workshop invoices MUST be excluded from all hub surfaces — enforced by the active-workshop `OrganizationContext` org filter on every fetch (no separate non-workshop marker exists). Unfinalized or abandoned website-origin draft invoices (no real outstanding balance) MUST also be excluded. Website-origin invoices that are finalized and pending with a real outstanding balance MUST be treated as normal outstanding invoices and included.
- **FR-016**: Test and seed invoices MUST be excluded from hub surfaces using identification rules that remain valid in production (MUST NOT depend solely on a test flag column that is not reliably populated).
- **FR-017**: Cancelled and draft-status invoices MUST be excluded from outstanding totals and triage lists.
- **FR-018**: The hub MUST provide loading, empty, and error states appropriate to each section (headline figures, attention list, horizon strip).
- **FR-019**: The existing Invoices tab, its filterable table, and invoice detail drawer MUST remain available and unchanged in purpose; the hub routes into them rather than replacing them.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation or routing MUST preserve the coexistence of the app shell router and legacy page routes, or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live under the Finance module and MUST NOT deep-import internals from other features; shared monetary and date-formatting behaviour MUST be reused from shared modules where it already exists for invoice views.
- **AC-003 (Org boundary)**: Workshop scoping MUST remain mandatory for all invoice reads; the hub MUST use the same active-workshop context as other Finance tabs.
- **AC-004 (Single source of truth)**: Remaining balance, paid amount, partial detection, and overdue detection MUST be derived from the same logic already used by the invoice detail view and Finance invoice list — extracted or shared, not reimplemented with different rules.
- **AC-005 (Non-regression)**: Existing Finance tabs (Balance-chase, AI changes, Recent payments, Invoices) MUST remain available; only default landing tab and additive hub content change.

### Key Entities *(include if feature involves data)*

- **Outstanding invoice**: An invoice belonging to the active workshop that is not cancelled or draft, is not excluded as test/seed or website-draft, and has a remaining balance greater than zero.
- **Attention-list entry**: A lightweight summary of one outstanding invoice with PARTIAL and/or OVERDUE flags and a link to detail view.
- **Horizon bucket**: One of four due-date groupings (Overdue, Due within 30 days, Due later, No reliable date) used for triage routing.
- **Headline aggregates**: Roll-up totals (outstanding sum, unpaid count, overdue sum) computed exclusively from outstanding invoices per FR-003–FR-005.
- **Pre-applied invoice filter**: A filter state passed to the existing Invoices tab when routing from a horizon segment or hub action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In verification against a fixed sample of at least 20 invoices per workshop, 100% of hub remaining balances match the invoice detail view for the same invoice.
- **SC-002**: In the same verification sample, the hub total outstanding figure equals the exact sum of detail-view remaining balances for all included invoices (zero tolerance).
- **SC-003**: In usability checks, at least 90% of office staff can identify how many partially paid invoices still owe a balance within 10 seconds of opening the hub.
- **SC-004**: In usability checks, at least 90% of office staff can reach a pre-filtered overdue invoice list from the hub in one click without manually setting filters.
- **SC-005**: Zero invoices from non-active workshops, website drafts, or excluded test/seed records appear in hub figures during acceptance testing.
- **SC-006**: Zero invoices with unreliable placeholder due dates appear in Overdue, Due within 30 days, or Due later segments during acceptance testing.

## Assumptions

- The existing Finance module, Invoices tab, and invoice detail drawer (delivered under Finance Invoices Tab) remain the authoritative surfaces for row-level invoice data; this feature adds a triage layer only.
- "Unpaid" for headline count means outstanding invoices with remaining balance greater than zero, not merely status label pending.
- "Due within 30 days" means due date is today or later and on or before 30 calendar days from today, with a reliable due date, and the invoice still has a remaining balance.
- "Due later" means due date is more than 30 calendar days from today, with a reliable due date, and the invoice still has a remaining balance.
- Unreliable due dates: **resolved** — missing/null or `due_date >= '2100-01-01'` → **No reliable date** bucket only (never overdue / due-30 / due-later).
- Test/seed exclusion: **resolved** — **`amount >= 5` GBP floor** on hub population; **never** filter on `is_test` (unpopulated in production).
- Website-origin invoices are included when finalized and pending with a real outstanding balance, and excluded only when unfinalized/abandoned; planning confirms how finalized-pending is detected (e.g. status plus presence of a balance).
- Balance-chase and other existing Finance tabs continue to show order-centric views; the hub is invoice-centric and complementary, not a replacement for install-date balance chasing.
- Monetary values continue to display in GBP for the UK launch market, consistent with existing Finance invoice views.

## Out of Scope (v1)

- Revenue trends, charts, or historical analytics
- Stripe-versus-bank reconciliation views
- Order-side payment ledger or order balance roll-ups (covered elsewhere in Finance)
- Payment forecasting or predictive collection timelines
- A second full invoice table on the hub tab
- Editing invoices, recording payments, or sending payment links from the hub (navigation to existing flows only)
