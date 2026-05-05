# Feature Specification: Inquiries Pipeline Board

**Feature Branch**: `007-inquiries-pipeline`  
**Created**: 2026-05-06  
**Status**: Draft  
**Input**: User description: "Build an Inquiries Pipeline module with Kanban stages, SQL stage computation, filters, and read-mostly detail experience."

## Clarifications

### Session 2026-05-06

- Q: What deterministic stage precedence applies when an enquiry matches multiple stage conditions? → A: Precedence is `order_created` > `paid` > `quoted` > `new`, first-match-wins, and any enquiry with non-null `order_id` is always `order_created`.
- Q: What exact channel-aware card content is required for each channel? → A: Channel-specific primary and secondary card fields are defined per channel and are mandatory.
- Q: How is a quote linked to an enquiry without a direct quote-enquiry foreign key? → A: A quote is linked when `quotes.customer_id = enquiries.person_id` and `quotes.created_at >= enquiries.created_at`; if multiple match, use most recent `quotes.created_at`.
- Q: What signal defines the Paid stage, and when is it finalized? → A: Paid uses `quotes.status`, and exact paid status values are finalized only after distinct `quotes.status` verification.
- Q: How should sparse Paid-stage data at launch be interpreted? → A: Sparse Paid entries are expected until the separate payment-confirmation workflow ships.
- Q: What exact detail panel sections and fields are required? → A: The detail panel must include specified Header, Person, Inquiry, optional Configuration, optional Photos, optional Linked Quote, and optional Linked Order sections.
- Q: Is the dual-router architecture constraint real in this codebase? → A: Yes; `src/app/` and `src/pages/` both exist, so the constraint remains.
- Q: With `quotes.status` returning only `accepted` and `converted` (no `paid`), how should the Paid stage be handled? → A: Drop the Paid lane for v1. The board has three lanes: New, Quoted, Order Created. The `quoted` stage maps to quote status `accepted`. A Paid lane may be added in a future iteration once a payment signal is introduced.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monitor inquiry progression (Priority: P1)

As an authenticated organization member, I can open an Inquiries page and see all recent enquiries in a three-stage pipeline so I can understand where each inquiry sits in the sales journey.

**Why this priority**: This is the core business value of the feature and replaces scattered inquiry tracking with a single operational view.

**Independent Test**: Can be fully tested by opening the Inquiries page for an organization with mixed enquiry states and confirming every returned enquiry appears in the correct stage lane.

**Acceptance Scenarios**:

1. **Given** I am a signed-in member of an organization with enquiries in multiple states, **When** I open the Inquiries page, **Then** I see a Kanban board with exactly three lanes: New, Quoted, and Order Created..
2. **Given** an enquiry with no linked order and no qualifying quote, **When** the board loads, **Then** that enquiry appears in the New lane.
3. **Given** an enquiry with a linked order, **When** the board loads, **Then** that enquiry appears in the Order Created lane.

---

### User Story 2 - Filter pipeline to relevant data (Priority: P2)

As an authenticated organization member, I can filter inquiries by channel and date range so I can focus on a specific workload window without leaving the board.

**Why this priority**: Operational teams need quick narrowing of records to act on recent or channel-specific enquiries.

**Independent Test**: Can be fully tested by changing channel and date filters and confirming the board refreshes to only matching enquiries.

**Acceptance Scenarios**:

1. **Given** I open the page for the first time, **When** filters initialize, **Then** all channels are selected and date range defaults to Last 30 days.
2. **Given** I choose one or more channels, **When** the board refreshes, **Then** only enquiries from selected channels are shown.
3. **Given** I choose a predefined or custom date range, **When** the board refreshes, **Then** only enquiries within that date window are shown.

---

### User Story 3 - Inspect inquiry details quickly (Priority: P3)

As an authenticated organization member, I can open an enquiry card to view full enquiry context and related records so I can decide the next manual action outside this v1 board.

**Why this priority**: The board is useful only if users can inspect complete context without navigating away.

**Independent Test**: Can be fully tested by opening cards across multiple channels and confirming the detail panel includes enquiry, person, and related quote/order information when available.

**Acceptance Scenarios**:

1. **Given** I click an enquiry card, **When** the detail panel opens, **Then** I see the full enquiry data and linked person data.
2. **Given** a related quote and/or order exists, **When** I open the detail panel, **Then** those linked records are shown.
3. **Given** no linked quote or order exists, **When** I open the detail panel, **Then** I see a clear empty-related-data state rather than errors.

---

### Edge Cases

- A user who is authenticated but not a member of the requested organization must not receive inquiry data.
- Enquiries that match multiple stage conditions must use precedence `order_created` > `quoted` > `new`, with first-match-wins and one final stage per enquiry.
- Missing optional fields in channel-specific payloads (for example, inscription text or appointment kind) must degrade gracefully with fallback text.
- No matching enquiries for current filters must show an explicit empty state instead of blank columns.
- Data load failures must show an error state with a retry action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a top-level Inquiries page accessible to all authenticated members of the current organization.
- **FR-002**: The system MUST display enquiry records as a Kanban board with exactly three computed stages: New, Quoted, and Order Created. (A Paid stage is deferred until a payment signal exists in the source data — see Pre-Implementation Data Verification.)
- **FR-003**: The system MUST compute and return a single stage value for each enquiry at read time based on linked-order and linked-quote/payment conditions, without persisting stage on the enquiry record.
- **FR-004**: The system MUST source board data through one server operation that returns all data needed for board rendering and card detail display for the selected filters.
- **FR-005**: The server operation MUST validate that the requesting user is a member of the requested organization before returning any data.
- **FR-006**: The system MUST support channel multi-select filtering with available channels: contact, quote, appointment, call, and shortlist.
- **FR-007**: The system MUST support date filtering with Today, Last 7 days, Last 30 days, All time, and custom range options.
- **FR-008**: The default filter state MUST select all channels and Last 30 days.
- **FR-009**: The system MUST refresh board data each time filters change, using one data request per filter change.
- **FR-010**: The system MUST render channel-aware card summaries so each channel surfaces its most relevant attributes for triage.
- **FR-011**: The system MUST open a detail panel when a card is selected and show full enquiry data, linked person data, and related quote/order data if present.
- **FR-012**: The system MUST include loading skeletons, explicit empty states, and error states with retry for the board and detail experiences.
- **FR-013**: The system MUST place Inquiries in primary navigation between Inbox and Orders.
- **FR-014**: The v1 scope MUST exclude drag-and-drop, manual stage changes, send-quote actions, search, bulk actions, and editing.
- **FR-015**: The system MUST be read-only against existing enquiry ingestion and MUST NOT modify the existing external write path that populates enquiries.
- **FR-016**: The system MUST treat people as the canonical person entity across enquiry, quote, and order relationships, including cases where column names are legacy/misleading.
- **FR-017**: The system MUST derive pipeline and detail data without requiring a direct quote-to-enquiry link field.
- **FR-018**: The board ordering MUST use enquiry creation time and MUST NOT rely on enquiry update time.
- **FR-019**: The system MUST support exactly these enquiry channels for filtering and rendering in v1: contact, quote, appointment, call, shortlist.
- **FR-020**: The database operation MUST perform explicit organization-membership authorization checks even when row-level security policies already exist.
- **FR-021**: Stage computation MUST use canonical stage keys `new`, `quoted`, and `order_created`, and MUST evaluate precedence in this exact order: `order_created` first, then `quoted`, then `new`; the first matching condition wins.
- **FR-022**: Any enquiry with `order_id` present MUST be classified as `order_created` regardless of quote linkage or quote payment state.
- **FR-023**: Quote linkage for stage and detail context MUST be computed as `quotes.customer_id = enquiries.person_id` and `quotes.created_at >= enquiries.created_at`; where multiple quotes match, the most recent quote by `quotes.created_at` MUST be used.
- **FR-024**: Quoted-stage eligibility MUST be driven by the linked quote status field. A quote is considered to qualify the enquiry for the `quoted` stage when its status is `accepted`. The status value `converted` indicates the quote has been turned into an order and is therefore covered by the `order_created` stage via `enquiries.order_id`.

### Channel Card Content Requirements

- **FR-025 (quote card)**: Quote-channel cards MUST show memorial name from `details.name`, price from `details.price`, and truncated inscription from `details.inscription`; secondary line MUST show person name and enquiry `created_at`.
- **FR-026 (contact card)**: Contact-channel cards MUST show person name, truncated message, and visible `sub_type` badge; secondary line MUST show enquiry `created_at`.
- **FR-027 (appointment card)**: Appointment-channel cards MUST show person name, `appointment_at`, and `appointment_kind`; secondary line MUST show enquiry `created_at`.
- **FR-028 (call card)**: Call-channel cards MUST show person name, `contact_pref`, and `sub_type`; secondary line MUST show enquiry `created_at`.
- **FR-029 (shortlist card)**: Shortlist-channel cards MUST show person name and a details summary; secondary line MUST show enquiry `created_at`.

### Detail Panel Requirements

- **FR-030 (header section)**: Detail panel header MUST show channel badge, `sub_type`, computed stage badge, and enquiry `created_at`.
- **FR-031 (person section)**: Detail panel person section MUST show name, email, phone, and a link to the person detail page.
- **FR-032 (inquiry section)**: Detail panel inquiry section MUST show message, `source_page`, location, `contact_pref`, and `appointment_at` when present.
- **FR-033 (configuration section)**: If enquiry `details` includes product configuration fields, the detail panel MUST show labeled rows for Memorial, Stone, Size, Font, Inscription, Add-ons, and Price.
- **FR-034 (photos section)**: If `photo_urls` is non-empty, the detail panel MUST show a photo thumbnail grid.
- **FR-035 (linked quote section)**: If a linked quote exists, the detail panel MUST show quote id, status, total, and a link to quote detail.
- **FR-036 (linked order section)**: If a linked order exists, the detail panel MUST show order id, status, and a link to order detail.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation/routing MUST preserve the coexistence of `src/app/` (app shell/router wiring) and `src/pages/` (legacy/singleton pages), or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live in `src/modules/inquiries/` and MUST NOT deep-import other features’ internals; shared functionality MUST be promoted into `src/shared/`.
- **AC-003 (RLS as boundary)**: Authorization MUST be enforced in the database via organization membership checks and database-level access controls; UI checks are not security.
- **AC-004 (Canonical person linkage)**: All joins for enquiry-to-person, quote-to-person, and order-to-person relationships MUST use the existing people-linked foreign keys and MUST NOT depend on the customers table.
- **AC-005 (No write-path changes)**: This feature MUST NOT alter enquiry ingestion, external submission integrations, or other upstream write flows.
- **AC-006 (Single request pattern)**: Data loading for the board MUST preserve the single-request-per-filter-change pattern and avoid waterfall fetches.

### Key Entities *(include if feature involves data)*

- **Enquiry Pipeline Item**: A single enquiry row enriched with computed stage, channel-aware display fields, and related references needed for board and detail panel.
- **Person**: The individual associated with an enquiry, including identifying and contact context displayed in cards and details.
- **Quote Summary**: The most relevant quote context for the enquiry/person relationship, including timing and payment state used in stage determination and details.
- **Order Summary**: The linked order context, if present, used for stage determination and detail display.
- **Pipeline Filter Set**: User-selected channels and date range values that determine which enquiries are returned.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of enquiries returned for a filter set appear in exactly one lane with a non-empty stage value.
- **SC-002**: For users with at least 200 qualifying enquiries, the initial board view becomes usable in 3 seconds or less in normal operating conditions.
- **SC-003**: In user acceptance testing, at least 90% of participants can identify an enquiry’s current pipeline stage and open its details within 10 seconds.
- **SC-004**: For each filter change, users observe a single data refresh cycle and updated board results without intermediate partial-data states.
- **SC-005**: Error and empty-state handling achieves 100% coverage across board-loading, filter-refresh, and detail-open flows in acceptance tests.

## Assumptions

- Existing enquiry, person, quote, and order data is already captured with sufficient linkage to support stage evaluation.
- Organization membership and authenticated session context are already available and reliable at runtime.
- Date filtering is interpreted in the organization/user local date context consistent with existing product behavior.
- The Inquiries page is desktop-first in v1, with standard responsive behavior but no additional mobile-specific UX guarantees.
- Users will perform follow-up actions (for example, sending quotes or editing records) in other modules until future inquiry workflow actions are added.
- Existing row-level security policies on enquiries remain in place and continue to enforce organization boundaries for direct table access.
- A dedicated Paid stage is intentionally not included in v1. Once a separate payment-confirmation flow exists and a payment signal is added to quotes (or another source), a Paid stage may be added in a future iteration without breaking this feature.

## Audit Constraints

- Enquiry ingestion is already live from the external site and is verified; this feature only reads and presents that data.
- `enquiries.person_id` links to people and is the required join path for enquiry person context.
- `quotes.customer_id` is a legacy name but links to people; this naming mismatch must be handled without schema renaming.
- `orders.person_id` links to people; there is no order customer field.
- `orders.quote_id` and `enquiries.order_id` exist and may be used in stage/detail derivation; there is no direct quote-to-enquiry link field.
- `enquiries.updated_at` is not maintained and must not drive sorting behavior.
- Existing channel values in scope are contact, quote, appointment, call, and shortlist.
- The secure data function must still perform explicit membership authorization because it executes with elevated privileges.
- Organization admin checks in the UI context should follow `useOrganization()` patterns, with no super-admin gating.

## Pre-Implementation Data Verification

The following discovery queries were executed during planning. Outcomes:

- `quotes.status` values present: `accepted`, `converted`. No `paid` or equivalent status exists today, which is why a Paid stage is not in v1.
- `orders.status` values present: `pending`, `deposit_paid`. Both are valid display values for linked-order summaries.
- `people` columns confirmed: `first_name`, `last_name`, `email`, `phone` (plus others not used by this feature).

Stage mapping for v1:
- `order_created` — when `enquiries.order_id IS NOT NULL`
- `quoted` — when a linked quote exists with `status = 'accepted'`
- `new` — otherwise