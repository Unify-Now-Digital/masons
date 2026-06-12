# Feature Specification: Organisation-Scoped Data Save Integrity Audit

**Feature Branch**: `013-org-id-stamp-audit`  
**Created**: 2026-06-12  
**Status**: Draft  
**Input**: User description: "Audit and fix missing organization_id stamps on RLS-org-scoped table inserts."

## Overview

### Problem

Mason stores business data in tables that are scoped to a workshop (organisation). When staff save a record — an inscription on an order, a payment line, a table view preset, and similar — the system must attach the correct organisation identifier so access rules can confirm the user belongs to that workshop.

When that identifier is missing on save, the access rule rejects the write. In some places the product only logs the failure or hides it entirely. Staff believe the save succeeded; the data never appears. This has already caused empty additional options and missing customer links on orders in production. The same failure pattern is known to affect invoice payment reconciliation.

The access rules themselves are correct and must not change. The fault lies in save paths that omit the organisation identifier.

### Goal

Systematically verify that every product save path into an organisation-scoped table includes the correct organisation identifier, sourced from the authoritative parent record (order, invoice, conversation) or from the staff member's active workshop context for top-level records. Fix any path that omits it.

### Reference pattern (already corrected — model for remaining work)

For child records tied to an order, load the parent order's organisation identifier and include it on the insert. For top-level records (products, cemeteries, companies), use the active workshop from the staff member's session context. Never hard-code an organisation identifier and never omit it.

Records already corrected using this pattern: **order additional options**, **order people**. **Orders** themselves already stamp correctly via active workshop context — verify only, no change expected unless audit finds a gap.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Order-related child data persists reliably (Priority: P1)

As office staff working on an order, when I add inscriptions, permit forms, or other order-linked details, those details must appear immediately and remain visible on reload — not vanish silently because the save was rejected behind the scenes.

**Why this priority**: Order data is the core of daily work; silent loss directly risks inscription errors and customer-facing mistakes.

**Independent Test**: For a test order in a non-production workshop, add an inscription (or other in-scope child record), reload the order, and confirm the row exists with the correct organisation identifier and no access-denied errors in diagnostics.

**Acceptance Scenarios**:

1. **Given** staff save an inscription linked to an order, **When** the save completes in the product, **Then** the inscription row exists, is scoped to the same organisation as the parent order, and is visible on subsequent loads.
2. **Given** staff create an invoice from an order, **When** the invoice is saved, **Then** the invoice row carries the correct organisation identifier and appears in that workshop's invoice list.
3. **Given** staff record a payment against an invoice, **When** the payment is saved through the product, **Then** the payment row is scoped to the invoice's organisation and reconciles correctly in finance views.

---

### User Story 2 — Top-level workshop reference data persists (Priority: P1)

As an administrator setting up a workshop, when I create products, cemeteries, companies, or saved table views, those records must belong to my active workshop and be available to colleagues in that workshop.

**Why this priority**: Reference data underpins quoting, permits, and reporting; silent failure here blocks onboarding and day-to-day configuration.

**Independent Test**: While switched to a throwaway test workshop, create one product, one cemetery, one company, and one table view preset; confirm each appears in lists for that workshop only and carries the workshop identifier.

**Acceptance Scenarios**:

1. **Given** staff are on workshop A in the workspace switcher, **When** they create a new product, **Then** the product is stored under workshop A and visible to other members of A, not B.
2. **Given** the same context, **When** they save a table view preset, **Then** the preset persists and reloads for members of that workshop.
3. **Given** staff create a cemetery or company record, **When** the save completes, **Then** the record is scoped to the active workshop from session context.

---

### User Story 3 — Inbox conversations and messages persist (Priority: P1)

As staff using the unified inbox, when I start a conversation or send a message, that activity must be recorded under the correct workshop so threads, history, and linked customer data remain intact.

**Why this priority**: Inbox is live customer communication; lost messages erode trust with bereaved families.

**Independent Test**: Prefer the Sears Melvin test workshop for throwaway inbox rows where the code path is organisation-agnostic. Create a conversation and message; confirm both rows carry the workshop identifier. Avoid polluting Churchill's live conversation data unless testing a Churchill-specific path deliberately.

**Acceptance Scenarios**:

1. **Given** staff create a new inbox conversation, **When** the conversation is saved, **Then** it is scoped to the intended workshop and appears in that workshop's inbox list.
2. **Given** staff send or record a message in a conversation, **When** the message is saved through the product, **Then** the message row inherits the organisation scope from the parent conversation (or equivalent authoritative source) and appears in the thread on reload.
3. **Given** a save would fail access rules, **When** the product handles the error, **Then** staff see a clear failure — not a false success with missing data.

---

### User Story 4 — Invoice payment reconciliation records persist (Priority: P1)

As staff relying on paid invoice status, when a customer pays through the payment provider, Mason must record the payment line under the invoice's organisation so finance views and paid status stay trustworthy.

**Why this priority**: `invoice_payments` is already known broken; silent failure here causes Mason to disagree with the payment provider — a direct trust and cash-flow risk. This fix must be coordinated with any separate Stripe follow-up so the problem is solved once, not twice.

**Independent Test**: Complete a test-mode payment for an invoice; confirm a payment row appears scoped to the invoice's organisation. For automated payment-provider paths, confirm the service path either bypasses access rules correctly or stamps the organisation identifier explicitly.

**Acceptance Scenarios**:

1. **Given** a verified payment event for an invoice, **When** Mason records the payment line, **Then** the row includes the invoice's organisation identifier and appears in payment history.
2. **Given** duplicate payment events, **When** reconciliation runs, **Then** idempotent behaviour is preserved (no duplicate paid state corruption).
3. **Given** the payment-provider automation path uses elevated database access, **When** audited, **Then** it either legitimately bypasses row access rules or stamps organisation scope explicitly — never relying on a null organisation identifier.

---

### User Story 5 — Audit completeness and regression prevention (Priority: P2)

As a product owner, I need confidence that every in-scope save path has been reviewed once, corrected where needed, and verified — with already-fixed paths documented as the model and out-of-scope tables explicitly excluded.

**Why this priority**: Prevents recurring production surprises and gives planners a closed checklist.

**Independent Test**: Review the per-table acceptance checklist; each in-scope table has a located save site, verified stamp behaviour, and a recorded manual verification note.

**Acceptance Scenarios**:

1. **Given** the in-scope table list, **When** the audit completes, **Then** every listed table has exactly one tracked task with pass/fail verification status.
2. **Given** tables without organisation-scoped insert access rules, **When** the audit runs, **Then** they are excluded with documented rationale (no stamp required).
3. **Given** order additional options and order people, **When** referenced, **Then** they serve as the documented reference pattern and are not reworked unless a new gap is found.

---

### Edge Cases

- **Parent record missing organisation identifier**: Save must fail with a clear, staff-visible error — never silently succeed or insert with a null scope.
- **Active workshop context unavailable** at a top-level save site: Save blocked with explanation; no fallback to another workshop or a hard-coded identifier.
- **Live inbox data (Churchill)**: Testing must not create throwaway pollution in production conversation threads; prefer Sears Melvin workshop (`3770972d-1bbd-417b-b413-297e844db285`) for generic path tests.
- **Duplicate Stripe payment events**: Fixing organisation stamping must not break existing idempotent payment-line behaviour.
- **Already-correct tables**: cemeteries, companies, products, payments, permit_forms, and inbox conversation creation may already stamp correctly — audit must confirm, not assume.
- **Edge-function writes**: Tables also written outside the main product (e.g. invoice payments from payment webhooks) need explicit audit of elevated-access paths.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For each in-scope table below, the product MUST locate every save path in the main application codebase and ensure the insert payload includes `organization_id` sourced from the authoritative parent or active workshop context — never omitted, never hard-coded.
- **FR-002**: In-scope tables (audit and fix): **cemeteries**, **companies**, **inbox_conversations**, **inbox_messages**, **inscriptions**, **invoices**, **payments**, **permit_forms**, **products**, **table_view_presets**, **invoice_payments**.
- **FR-003**: **order_additional_options** and **order_people** are already fixed — exclude from fix work; cite as reference pattern only.
- **FR-004**: **orders** — verify only; expected to stamp via active workshop context; fix only if audit discovers a gap.
- **FR-005**: Out of scope (insert sites exist but no organisation-scoped insert access rule — no stamp required): **job_workers**, **jobs**, **memorials**, **messages**, **order_comments**, **worker_availability**, **workers**.
- **FR-006**: Child-table saves MUST derive organisation scope from the parent record (order, invoice, or conversation as applicable).
- **FR-007**: Top-level entity saves (products, cemeteries, companies, table view presets) MUST derive organisation scope from the staff member's active workshop context, confirmed available at each save site.
- **FR-008**: The system MUST NOT change row access rules, database schema migrations, or the membership-check function used by those rules.
- **FR-009**: When a save fails access rules, the product MUST surface failure to staff (toast, inline error, or thrown error propagated to UI) — not only console logging — so silent data loss cannot recur on corrected paths.
- **FR-010**: For **invoice_payments**, reconcile with any parallel Stripe payment work so organisation stamping is fixed exactly once across product and payment-provider automation paths.
- **FR-011**: For tables also written by payment-provider or inbox automation using elevated database access, audit MUST confirm each path either bypasses access rules legitimately or stamps organisation scope explicitly.

### Per-Table Acceptance Criteria

Each in-scope table is one tracked task:

| Table | Org source | Acceptance |
| ----- | ---------- | ---------- |
| cemeteries | Active workshop context | Save site located; payload includes org id from context; manual insert verified in test workshop |
| companies | Active workshop context | Same |
| inbox_conversations | Payload / active context | Same; prefer Sears Melvin for throwaway tests |
| inbox_messages | Parent conversation | Same |
| inscriptions | Parent order | Same |
| invoices | Parent order or active context | Same |
| payments | Active workshop context or parent invoice | Same |
| permit_forms | Active workshop context (or parent if applicable) | Same |
| products | Active workshop context | Same |
| table_view_presets | Active workshop context | Same |
| invoice_payments | Parent invoice | Same; include payment-provider automation path audit |

Verification for each table: insert a row through the product for the Churchill workshop **or** Sears Melvin where live-data risk applies; confirm the row appears with organisation identifier populated and no access-denied errors in network or server diagnostics.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Rules unchanged)**: Existing organisation-scoped insert access rules remain authoritative; this delivery fixes application save payloads only.
- **AC-002 (No schema change)**: No new columns, migrations, or changes to membership-check logic.
- **AC-003 (Authoritative org source)**: Organisation identifier on insert must come from parent record lookup or active workshop context — never from user-editable form fields alone.
- **AC-004 (Fail closed)**: Missing parent org or missing active workshop context must abort the save with a visible error.
- **AC-005 (Single fix for payments)**: Invoice payment stamping coordinated across product UI paths and payment-provider webhook paths to avoid duplicate conflicting fixes.

### Key Entities *(include if feature involves data)*

- **Organisation-scoped record**: Any business row tied to one workshop via an organisation identifier; subject to membership-based insert access rules.
- **Parent record**: Order, invoice, or inbox conversation that authoritatively owns the organisation scope for child inserts.
- **Active workshop context**: The organisation the signed-in staff member has selected in the workspace switcher; authoritative for top-level entity creates.
- **Payment reconciliation line**: A row linking a Mason invoice to a provider payment event; must share the invoice's organisation scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of in-scope tables (11 listed in FR-002) pass per-table acceptance verification — row persisted with organisation identifier populated, zero access-denied errors on the save request.
- **SC-002**: 100% of in-scope save paths audited have organisation identifier present on the insert payload before deployment sign-off.
- **SC-003**: Zero new silent-save regressions on corrected paths during acceptance testing — every forced access-rule failure surfaces a staff-visible error.
- **SC-004**: Staff completing a scripted "add inscription + additional option + invoice line item" flow on a test order see 100% of entered data on reload (baseline comparison against pre-fix silent-loss behaviour).
- **SC-005**: Test-mode invoice payment through the payment provider produces a visible payment reconciliation row scoped to the invoice's organisation within the same session (no console-only failure).
- **SC-006**: Reference pattern tables (order additional options, order people) remain passing verification without rework.

## Assumptions

- Every parent order and invoice in normal use already has a valid organisation identifier; orphan parents are exceptional and should fail loudly.
- Active workshop context is available everywhere top-level entities are created today; if a site lacks context, fixing context wiring is in scope only when it blocks correct stamping.
- cemeteries, companies, products, payments, permit_forms, and inbox conversation creation may already be correct — audit confirms before changing.
- Sears Melvin organisation is acceptable for throwaway inbox and generic tests; Churchill used where org-specific behaviour must be validated.
- Payment-provider automation uses service-level database access; audit determines bypass vs explicit stamp per path rather than assuming one approach.
- No change to which tables are organisation-scoped at the database layer — scope is frozen to the listed in-scope and out-of-scope tables.

## Dependencies

- Existing multi-organisation tenancy and workspace switcher (active organisation context).
- Already-fixed order additional options and order people implementations as reference.
- Parallel Stripe / invoice payment work — coordinate to avoid duplicate invoice_payments fixes.

## Out of Scope

- Changing row access rules or the membership-check function.
- Database schema migrations or new organisation_id columns.
- Tables listed in FR-005 (no organisation-scoped insert access rule).
- order_additional_options and order_people (already fixed — reference only).
- Broader error-handling overhaul beyond ensuring corrected save paths do not swallow access-rule failures.
- Edge functions and automation outside the listed in-scope tables except where explicitly required for invoice_payments audit (FR-011).
