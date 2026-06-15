# Feature Specification: Inbox Consolidation — Unified Native Inbox

**Feature Branch**: `015-inbox-consolidation`  
**Created**: 2026-06-14  
**Status**: Draft  
**Input**: User description: "Inbox consolidation — unify the operational inbox and the enquiry triage page into one canonical native inbox surface."

## Overview

### Problem

Staff currently face three separate inbox experiences. The richest operational inbox at `/inbox` supports two-way Email, WhatsApp, and SMS conversations with order context, but is not linked from the sidebar. The sidebar "Inbox" entry instead opens enquiry triage at `/enquiry-triage`, which presents a liked card-and-pipeline layout but relies on AI extraction that is not deployed — every card shows placeholder analysis chrome that sets false expectations. GHL inbox remains a transitional read-window and is intentionally separate.

This split forces staff to learn two native inbox surfaces, hides the full conversation model behind an unlinked route, and surfaces "not yet analysed" messaging for a capability that does not exist.

### Goal

Deliver **one canonical native inbox** at `/inbox` that:

1. Retains the operational inbox's full conversation, reply, link/unlink, and order-context capabilities.
2. Absorbs enquiry triage into an **Enquiries** segment for unlinked inbound conversations, preserving the card-and-pipeline visual style but replacing AI-confidence buckets with a **human-driven** workflow (New → In progress → Order created).
3. Shows a **Create order from this enquiry** right panel for unlinked enquiries, prefilled only from data the product already holds — with no AI extraction or confidence scoring.
4. Points sidebar **Inbox** at `/inbox` and retires `/enquiry-triage` as a standalone experience.
5. Leaves GHL inbox entirely unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — One inbox entry point (Priority: P1)

As office staff, when I click **Inbox** in the sidebar I land on the unified native inbox at `/inbox`, so I have a single place to work customer messages without choosing between triage and operational views.

**Why this priority**: Navigation consolidation is the foundation; without it, staff continue to miss the operational inbox and use the wrong surface.

**Independent Test**: Click sidebar Inbox from any dashboard page; confirm arrival at `/inbox` with the unified layout. Attempt `/enquiry-triage` directly; confirm it does not present a separate standalone experience.

**Acceptance Scenarios**:

1. **Given** I am signed in and viewing the dashboard, **When** I click the sidebar **Inbox** link, **Then** I am taken to `/inbox` (not `/enquiry-triage`).
2. **Given** I bookmarked or follow an old link to `/enquiry-triage`, **When** I open it, **Then** I am redirected to `/inbox` with the Enquiries segment active (or equivalent default that surfaces enquiry triage work).
3. **Given** the unified inbox is open, **When** I view the sidebar, **Then** GHL inbox remains a separate, unchanged entry pointing at its existing route.

---

### User Story 2 — Work operational conversations without regression (Priority: P1)

As office staff handling linked or mixed workloads, I can use the **All / Linked** segment to view and reply to Email, WhatsApp, and SMS conversations, link or unlink them to orders and customers, and open order context for linked threads — exactly as the operational inbox supports today.

**Why this priority**: Consolidation must not regress the richest existing capability; operational messaging is daily critical path work.

**Independent Test**: In All / Linked, open linked and unlinked conversations across all three channels; send replies; link/unlink to orders; confirm order context panel for linked threads.

**Acceptance Scenarios**:

1. **Given** I select a conversation in All / Linked, **When** I compose and send a reply, **Then** the message is delivered on the conversation's channel (Email, WhatsApp, or SMS).
2. **Given** a conversation is linked to an order, **When** I select it, **Then** the right panel shows order context with actions to open the invoice and open the full order.
3. **Given** a conversation is not linked to an order, **When** I use link/unlink controls, **Then** I can associate or remove association with a customer (person) and order without leaving the inbox.
4. **Given** I filter by channel (Email, WhatsApp, SMS), **When** the list refreshes, **Then** only conversations on the selected channel(s) appear.
5. **Given** I am User A and another user in my workshop has email conversations, **When** I view email threads, **Then** I see only my own email conversations; WhatsApp and SMS threads remain visible to all workshop members per existing visibility rules.

---

### User Story 3 — Triage unlinked enquiries in a human-driven pipeline (Priority: P1)

As office staff receiving new inbound enquiries, I can switch to the **Enquiries** segment and see unlinked inbound conversations arranged in a card-and-pipeline layout with human workflow stages **New**, **In progress**, and **Order created** — without any AI analysis, confidence scores, or "not yet analysed" messaging.

**Why this priority**: This replaces the broken triage page with an honest, staff-controlled funnel using the visual pattern the client already likes.

**Independent Test**: Seed open, order-unlinked conversations across channels; open Enquiries segment; confirm pipeline columns, card content, stage assignment rules, and absence of AI chrome.

**Acceptance Scenarios**:

1. **Given** open conversations exist with no linked order, **When** I open the Enquiries segment, **Then** those conversations appear as cards in the pipeline layout.
2. **Given** a conversation has no linked order and has not been manually advanced, **When** it appears in Enquiries, **Then** it is in the **New** stage by default.
3. **Given** I select an enquiry card and mark it **In progress**, **When** I return to the pipeline, **Then** the card appears in the **In progress** column and retains that state on refresh.
4. **Given** a conversation becomes linked to an order (via create-order flow or manual link), **When** the pipeline reloads, **Then** the card appears in **Order created** (or leaves the active enquiry funnel with a clear completed state).
5. **Given** I view any enquiry card or panel, **When** I inspect the UI, **Then** no AI confidence score, "not yet analysed", "ready to draft", or similar AI-extraction chrome is shown.
6. **Given** linked-order conversations exist, **When** I am in the Enquiries segment, **Then** only unlinked inbound enquiries are shown (not the full operational thread list).

---

### User Story 4 — Create an order from an enquiry with known data only (Priority: P2)

As office staff working an unlinked enquiry, when I select it I see a **Create order from this enquiry** right panel that prefills customer and contact fields from data we already hold (linked person, email or handle, channel, conversation context) so I can start an order without waiting for AI extraction.

**Why this priority**: Carries forward the triage page's highest-value action using deterministic data staff can trust.

**Independent Test**: Select unlinked enquiries with and without a linked person; open create-order panel; confirm prefills match conversation/person records and order creation succeeds.

**Acceptance Scenarios**:

1. **Given** I select an unlinked enquiry with a linked person, **When** the right panel opens, **Then** I see **Create order from this enquiry** with person name and contact details prefilled from that person record.
2. **Given** I select an unlinked enquiry with no linked person but a known channel handle (email or phone), **When** the panel opens, **Then** contact fields are prefilled from the conversation's channel and handle where available.
3. **Given** the create-order panel is open, **When** I complete order creation, **Then** the conversation becomes linked to the new order and moves to **Order created** in the enquiry pipeline.
4. **Given** I select a linked operational conversation in All / Linked, **When** the right panel opens, **Then** I see order context (not the create-order panel).

---

### User Story 5 — Channel and segment filtering (Priority: P2)

As office staff, I can combine segment choice (Enquiries vs All / Linked) with channel filters (Email, WhatsApp, SMS) so I can focus on the workload relevant to me right now.

**Why this priority**: Supports real workshop habits — email often personal, WhatsApp/SMS shared — without maintaining separate pages.

**Independent Test**: Toggle segments and channel filters; confirm list/pipeline contents update correctly and filters persist reasonably within the session.

**Acceptance Scenarios**:

1. **Given** I am in Enquiries, **When** I filter to WhatsApp only, **Then** only unlinked WhatsApp enquiry cards appear.
2. **Given** I am in All / Linked, **When** I filter to Email only, **Then** only my email conversations appear per visibility rules.
3. **Given** I switch from Enquiries to All / Linked, **When** the view updates, **Then** the conversation list reflects operational scope (linked and unlinked threads per segment rules), not the enquiry-only subset.

---

### Edge Cases

- A conversation linked to an order must not appear as an active triage item in Enquiries (it belongs in **Order created** or is excluded from the active funnel).
- An enquiry manually set to **In progress** that is later linked to an order must transition to **Order created** without leaving duplicate cards across stages.
- Email conversations remain visible only to the owning user; enquiry and operational segments must both respect this — a user must not see another user's private email threads in any segment.
- WhatsApp and SMS conversations remain workshop-shared in both segments; segment logic must not widen or narrow org membership visibility.
- Conversations with no linked person and only a raw handle must still appear in Enquiries with graceful empty states in the create-order panel (staff can link a person or enter details manually).
- Closed or archived conversations (if status is not open) must not appear in the active Enquiries pipeline unless product rules already surface them elsewhere.
- Empty Enquiries pipeline (no unlinked open conversations) shows an explicit empty state, not blank columns.
- Empty All / Linked list shows an explicit empty state consistent with the current operational inbox.
- Data load failures show an error state with retry in both segments.
- Switching workshop in the workspace switcher reloads inbox data for the new workshop only.
- Deep links and URL state from the old triage page (stage, tags, selected conversation) should degrade gracefully on redirect to `/inbox` without errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a single canonical native inbox at `/inbox` as the primary message-working surface.
- **FR-002**: The sidebar **Inbox** navigation entry MUST route to `/inbox`.
- **FR-003**: The route `/enquiry-triage` MUST NOT remain a separate standalone inbox experience; it MUST redirect to `/inbox` (with Enquiries context where practical).
- **FR-004**: The unified inbox MUST provide a left-rail segment control with at least **Enquiries** and **All / Linked**.
- **FR-005**: **Enquiries** MUST list only open, inbound-relevant conversations that are **not linked to an order** (unlinked enquiries).
- **FR-006**: **All / Linked** MUST present the operational conversation list covering linked and unlinked threads per existing operational inbox behaviour.
- **FR-007**: The system MUST support channel filtering for Email, WhatsApp, and SMS in both segments, combinable with the active segment.
- **FR-008**: The Enquiries segment MUST display unlinked enquiries in a **card-and-pipeline** layout visually consistent with the current enquiry triage page (columns/cards, channel cues, timestamps, preview text).
- **FR-009**: The Enquiries pipeline MUST use exactly three **human-driven** workflow stages: **New**, **In progress**, and **Order created**.
- **FR-010**: New unlinked enquiries MUST default to **New** until a staff member advances them or an order is created/linked.
- **FR-011**: Staff MUST be able to manually mark an enquiry **In progress** from the enquiry card or detail context.
- **FR-012**: A conversation linked to an order MUST be classified as **Order created** in the enquiry workflow.
- **FR-013**: The system MUST NOT display AI extraction status, confidence scores, "not yet analysed", "needs review", "ready to draft", or equivalent AI-analysis chrome anywhere in the unified inbox.
- **FR-014**: The right-hand panel MUST be **state-driven** by the selected conversation: linked to an order → order context panel; unlinked enquiry → **Create order from this enquiry** panel.
- **FR-015**: The create-order panel MUST prefill fields only from existing held data: linked person (canonical person record), contact email or handle, channel, and conversation metadata — with no AI-extracted inscription, product, or cemetery fields.
- **FR-016**: Person lookups for prefill and linking MUST use the canonical person entity (`public.people`), not legacy customer views.
- **FR-017**: The operational inbox MUST retain two-way reply on Email, WhatsApp, and SMS without regression.
- **FR-018**: The operational inbox MUST retain conversation link/unlink to persons and orders without regression.
- **FR-019**: The operational inbox MUST retain the order context right panel (open invoice, open full order) for linked conversations without regression.
- **FR-020**: GHL inbox route, module, sidebar entry, and behaviour MUST remain unchanged by this feature.
- **FR-021**: The system MUST NOT introduce organization-specific code branching; workshop differences remain data-only.
- **FR-022**: Enquiry workflow stage MUST persist across refresh and session so staff see consistent pipeline state.
- **FR-023**: The unified inbox MUST provide appropriate loading, empty, and error states for both segments and the right-hand panel.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation or routing MUST preserve the coexistence of the app shell router and legacy page routes, or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Inbox consolidation code MUST live under the inbox module (and shared primitives where reused); enquiry triage module code may be retired or folded in without deep cross-module imports of other features' internals.
- **AC-003 (RLS as boundary)**: Authorization MUST remain enforced in the database via RLS; UI segment filters are not security.
- **AC-004 (Dual-scoped visibility — MUST NOT change)**: Email conversations remain **private per user** (only the owning user sees their email threads). WhatsApp and SMS conversations remain **shared across the workshop** (all members of the organization see them). Consolidation MUST NOT alter who can see which conversations.
- **AC-005 (Org stamp on conversation and message inserts — carried from 013)**: Every insert into `inbox_conversations` or `inbox_messages` MUST include `organization_id` — for message inserts, taken from the **parent conversation record**; for conversation inserts, resolved at creation time (not from UI session context alone). These writers run in service-role or other non-interactive contexts where `auth.uid()` is null and RLS does not enforce the stamp, so the application layer MUST set `organization_id` explicitly. This applies to staff-initiated sends, inbound ingestion, and conversation-bootstrap paths that create inbox rows, including the client `inboxMessages.api.ts` `createMessage` path and edge functions `inbox-gmail-new-thread`, `inbox-gmail-sync`, and `proof-send`. A null-org conversation insert poisons the parent row; a correctly stamped message insert cannot recover from that.
- **AC-006 (Canonical person entity)**: Person resolution and prefill MUST use `public.people` as the authoritative person table.
- **AC-007 (Non-regression)**: Existing GHL inbox integration is out of scope and MUST NOT be modified.

### Key Entities *(include if feature involves data)*

- **Conversation**: A threaded Email, WhatsApp, or SMS exchange in the native inbox; has channel, handles, link to person and order (optional), open/closed status, workshop scope, and (for email) owning user.
- **Message**: An individual inbound or outbound item within a conversation; carries direction, body/preview, timestamps, and channel metadata.
- **Enquiry (logical)**: An open conversation with no linked order, surfaced in the Enquiries segment; may have an optional linked person.
- **Enquiry workflow stage**: Staff-controlled triage state (`new`, `in_progress`, `order_created`) for unlinked enquiries; distinct from AI-confidence staging.
- **Person**: Canonical customer/contact record used for linking and order prefill.
- **Order link**: Association between a conversation and an order; drives order-context vs create-order panel selection and **Order created** stage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of sidebar **Inbox** clicks land on `/inbox` in acceptance testing (zero arrivals on a standalone `/enquiry-triage` page).
- **SC-002**: 100% of direct `/enquiry-triage` navigations redirect to `/inbox` without a separate triage chrome shell.
- **SC-003**: In a regression pass across Email, WhatsApp, and SMS, 100% of pre-consolidation operational capabilities (reply, link/unlink, order context panel) remain functional in All / Linked.
- **SC-004**: In visibility testing with two users in the same workshop, email thread isolation and WhatsApp/SMS sharing match pre-consolidation behaviour in both segments (zero visibility regressions).
- **SC-005**: Zero enquiry cards or panels display AI confidence or "not yet analysed" messaging after consolidation.
- **SC-006**: In a test set of at least 10 unlinked enquiries with linked persons, 100% of create-order prefills match the person record fields staff expect (name, email/phone) without AI-invented values.
- **SC-007**: In timed usability checks, at least 90% of office staff can locate unlinked enquiries and advance one to **In progress** within 30 seconds of opening the inbox.
- **SC-008**: GHL inbox smoke test passes unchanged (route, sidebar entry, read behaviour) after consolidation deploy.

## Assumptions

- "Unlinked enquiry" means an open native inbox conversation with no `order_id` (or equivalent order link), matching how enquiry triage sources data today.
- Default enquiry stage is **New** when no staff override exists and no order is linked.
- **In progress** is set only by explicit staff action (not inferred from read/unread or message count).
- **Order created** is driven by a successful order link (via create-order flow or manual link), not by draft-only states elsewhere in the product.
- The card-and-pipeline visual language from enquiry triage (column headers, card density, channel icons, preview lines) is the design reference; exact pixel parity is desirable but minor spacing token differences are acceptable if the pattern is recognisable.
- Enquiry workflow stage persistence uses the native conversation model or a closely associated field — planning will choose storage without changing RLS visibility rules.
- AI enquiry extraction, auto-draft orders, and backfilling historical GHL threads into native tables are explicitly future work and will not block this release.
- The operational inbox's existing Customers vs Conversations view modes may be simplified or folded into segments as part of planning, provided FR-017–FR-019 behaviours remain available in All / Linked.
- Workshop switching uses the same active-workshop context as the rest of the dashboard.

## Out of Scope (v1)

- Any change to GHL inbox (`/ghl-inbox`), its module, sidebar entry, or eventual sunset.
- Backfilling pre-integration GHL history (calls, legacy threads) into native inbox tables.
- AI enquiry-extraction worker, confidence scoring, auto-draft orders, or `inbox_enquiry_extraction` seed/production pipeline.
- New channels beyond Email, WhatsApp, and SMS.
- Organization-specific code forks or per-workshop UI branching.
- Changes to RLS policies or dual-scoped visibility rules (email private per user; WhatsApp/SMS org-shared).
- Merging GHL inbox into the native inbox surface.

## Dependencies

- Landed **013 org-id stamp audit** work on the consolidation branch so message-write org stamping is already in place or completed in parallel.
- Existing native inbox conversation and message model (`inbox_conversations`, `inbox_messages`) remains the data foundation.
- Existing order creation flow can be invoked from the create-order panel with deterministic prefill payload.
