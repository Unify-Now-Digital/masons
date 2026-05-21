# Feature Specification: GHL Inbox — Phase 1 (Inbound Read-Only)

**Feature Branch**: `009-ghl-inbox-readonly`  
**Created**: 2026-05-21  
**Status**: Draft  
**Input**: User description: "Mason staff need to view GoHighLevel (GHL) conversations and contacts live inside Mason. Phase 1 is read-only inbound viewing; GHL remains the source of truth; Mason is a dedicated UI over GHL. Parallel to existing Inbox, not a replacement."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View live GHL conversations in Mason (Priority: P1)

As an authenticated organization member whose workshop has an active GoHighLevel connection, I can open a dedicated GHL Inbox screen in Mason and see my organisation’s live GHL conversations in a familiar two-pane layout (conversation list and message thread) so I can monitor customer communication without switching to GHL’s own application.

**Why this priority**: This is the core value proposition for the client pilot—staff can begin operating from Mason while GHL remains the system of record.

**Independent Test**: Can be fully tested by signing in as a member of an org with an active connection, opening the GHL Inbox screen, and confirming conversations and messages load from GHL (not from Mason’s existing unified Inbox tables).

**Acceptance Scenarios**:

1. **Given** I am a signed-in member of an organisation with an active GHL connection, **When** I navigate to the GHL Inbox screen, **Then** I see a conversation list populated from GHL for that organisation only.
2. **Given** I select a conversation, **When** the thread loads, **Then** I see the message history for that conversation as held in GHL.
3. **Given** a conversation has unread messages according to GHL, **When** it appears in the list, **Then** I see an unread indicator derived from GHL’s unread count for that conversation.
4. **Given** my organisation has no active GHL connection, **When** I open the GHL Inbox screen, **Then** I see a clear empty or setup state rather than another organisation’s data or a silent failure.

---

### User Story 2 - See new inbound messages within seconds (Priority: P1)

As an authenticated organization member viewing the GHL Inbox, I see new inbound messages (for example, a WhatsApp message arriving at the client’s GHL number) appear in Mason within a few seconds without manually refreshing the page, so the screen stays trustworthy for day-to-day monitoring.

**Why this priority**: Near-real-time updates are essential for replacing GHL as the daily operations surface; stale data would force staff back to GHL.

**Independent Test**: Can be fully tested by sending a test inbound message to the connected GHL location while Mason is open on the GHL Inbox screen and confirming the new message appears within the agreed time window.

**Acceptance Scenarios**:

1. **Given** I have the GHL Inbox screen open on an active conversation, **When** a new inbound message is recorded in GHL, **Then** the message appears in Mason within 10 seconds under normal conditions.
2. **Given** I am viewing the conversation list, **When** a new inbound message arrives on any conversation, **Then** the list reflects updated ordering or preview and unread state without a full page reload.
3. **Given** the webhook or live-update path is temporarily unavailable, **When** I use manual refresh (if offered) or revisit the screen, **Then** I can still load current data from GHL on demand.

---

### User Story 3 - Mark a conversation as read (Priority: P2)

As an authenticated organization member, I can explicitly mark the open conversation as read so the unread badge clears in Mason and the same conversation shows as read in GHL’s own interface, keeping both surfaces aligned.

**Why this priority**: Unread state is a primary triage signal; Phase 1 allows only this single write action to support realistic daily use without enabling outbound messaging.

**Independent Test**: Can be fully tested by opening a conversation with a non-zero unread count, clicking Mark as read, and verifying unread clears in Mason and in GHL’s native UI.

**Acceptance Scenarios**:

1. **Given** a conversation has unread messages in GHL, **When** I open its thread and choose Mark as read, **Then** the unread badge on that conversation clears in Mason.
2. **Given** I have marked a conversation as read in Mason, **When** I check the same conversation in GHL’s own UI, **Then** it no longer appears unread there.
3. **Given** the mark-as-read action fails, **When** the error is returned, **Then** I see a clear error message and the unread state in Mason remains unchanged.

---

### User Story 4 - Inspect GHL contact details (Priority: P2)

As an authenticated organization member, I can view contact details for the person associated with the selected conversation so I have name, phone, email, and other GHL-held context while reviewing messages.

**Why this priority**: Conversations are meaningless without contact context; staff need the same glanceable identity information they rely on in GHL.

**Independent Test**: Can be fully tested by selecting a conversation and confirming the contact panel shows fields returned from GHL for that contact.

**Acceptance Scenarios**:

1. **Given** I select a conversation linked to a GHL contact, **When** the contact panel loads, **Then** I see that contact’s details as provided by GHL.
2. **Given** contact details cannot be loaded, **When** the panel renders, **Then** I see an explicit error or empty state, not stale data from another contact.

---

### User Story 5 - Understand read-only mode and Phase 2 messaging (Priority: P3)

As an authenticated organization member, I see a message composer in the same position it will occupy when outbound messaging ships, but it is clearly disabled with an explanation that outbound messaging is Phase 2, so expectations are set and layout does not change later.

**Why this priority**: Prevents support confusion and avoids a disruptive UI rearrangement when sending is enabled.

**Independent Test**: Can be fully tested by opening any conversation thread and confirming the composer is visible, non-interactive, and labelled for Phase 2.

**Acceptance Scenarios**:

1. **Given** I open any conversation thread, **When** the thread view renders, **Then** I see a composer area in the standard bottom position that cannot be used to send messages.
2. **Given** the composer is disabled, **When** I view it, **Then** I see a clearly visible label such as “Read-only preview — outbound coming in Phase 2”.

---

### User Story 6 - Organisation admin sees and disconnects GHL connection (Priority: P3 — pilot-minimal)

As an organisation administrator, I can see whether my workshop’s GHL connection is active and disconnect it when needed, so members only see GHL data when the integration is intentionally on. **Pilot go-live** uses a developer-seeded connection row; an in-app “connect new location” wizard is out of scope for Phase 1.

**Why this priority**: Disconnect and visibility matter for support; full connect UX can follow after the Sears Melvin pilot.

**Independent Test**: Can be fully tested with a seeded `ghl_connections` row: admin sees status and can disconnect; non-admin sees status only and cannot disconnect; members see the inbox only when status is `active`.

**Acceptance Scenarios**:

1. **Given** a seeded active connection for my organisation, **When** I open GHL Inbox as an org admin, **Then** I see connection status (active) and may disconnect, which sets status to `disconnected` and stops inbox data loads.
2. **Given** I am a non-admin member, **When** I view GHL Inbox, **Then** I do not see a disconnect control (read-only status or no management strip is acceptable).
3. **Given** connection status is not `active`, **When** any member opens GHL Inbox, **Then** they see a clear empty/setup state rather than another org’s GHL data.
4. **Given** exactly one GHL location per organisation, **When** the database is seeded, **Then** at most one `ghl_connections` row exists per `organization_id` (enforced by UNIQUE constraint).

---

### Edge Cases

- A user who is authenticated but not a member of the organisation must not receive GHL conversation, message, or contact data.
- GHL API or credential errors must surface a user-visible error state with retry; credentials must never be exposed to the browser or client bundles.
- Conversations with zero messages must still appear in the list where GHL returns them, with an appropriate empty thread state.
- Very long message threads must remain usable (scroll, load behaviour defined in planning; no message persistence in Mason in Phase 1).
- If GHL returns a conversation without a resolvable contact, the contact panel shows an explicit empty state.
- Mark-as-read invoked twice in quick succession must not leave Mason and GHL in inconsistent unread states (idempotent or last-write-wins per GHL behaviour).
- Existing Mason unified Inbox data and workflows must remain unchanged when this feature is used or unused.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated GHL Inbox experience separate from Mason’s existing unified Inbox module; the existing Inbox conversation and message stores MUST NOT be extended or reused for GHL content in Phase 1.
- **FR-002**: The system MUST display GHL conversations and messages using read-through access to GHL as the source of truth; GHL message bodies and conversation content MUST NOT be persisted in Mason database tables in Phase 1.
- **FR-003**: The system MUST scope all GHL Inbox data to the signed-in user’s current organisation, resolved server-side from the user’s session—not from organisation identifiers supplied by the client alone.
- **FR-004**: The system MUST support exactly one active GHL location binding per organisation in Phase 1.
- **FR-005**: The system MUST store only organisation-to-GHL connection metadata in Mason (location identifier, connection status, verification timestamp, audit timestamps)—not message content.
- **FR-006**: Connection metadata MUST be readable only by members of that organisation and writable only through authorised admin flows, enforced at the data layer.
- **FR-007**: GHL API credentials (private integration token and related secrets) MUST exist only in server-side secure configuration; they MUST NOT appear in frontend environment variables, committed files, or browser network requests visible to end users.
- **FR-008**: The system MUST expose server-side read proxies for: listing conversations, fetching messages for a conversation, listing contacts, and fetching a single contact—all scoped via the organisation’s connection record.
- **FR-009**: The system MUST expose a server-side mark-as-read operation as the only write path to GHL in Phase 1; outbound message sending MUST NOT be available.
- **FR-010**: The system MUST accept verified inbound webhooks from GHL and use them to signal connected clients that cached conversation data should refresh, matching the established webhook-driven live-update pattern used elsewhere in the product.
- **FR-011**: The GHL Inbox screen MUST present a conversation list (left), message thread (right), and contact detail panel, with unread badges driven by GHL’s unread count on each conversation.
- **FR-012**: The message thread MUST include an explicit Mark as read control; automatic mark-on-open is out of scope for Phase 1.
- **FR-013**: After a successful mark-as-read, the UI MUST refresh unread indicators in Mason and reflect cleared unread state when the user views the same conversation in GHL’s native UI.
- **FR-014**: The message thread MUST show a disabled composer with a visible Phase 2 read-only label in the final composer position.
- **FR-015**: Organisation administrators MUST be able to **disconnect** the GHL location and view connection status; non-admin members MUST NOT disconnect or create connections. **In-app connect/onboard flow is out of scope for Phase 1 pilot** (connection row seeded operationally).
- **FR-016**: Phase 1 schema changes MUST be limited to the organisation GHL connection table; no other Mason tables are added or altered for GHL message storage.
- **FR-017**: Database schema for the connection table MUST be applied via a version-controlled migration in the repository before production schema changes—not via ad-hoc dashboard SQL alone.
- **FR-018**: The project MUST deliver a written instruction sheet for the client’s GHL administrator covering: the webhook URL to register in GHL, which webhook event types to subscribe to (to be finalized during technical planning from GHL v2 documentation), and how to generate and store the webhook signing secret in secure server configuration.
- **FR-019**: Phase 1 MUST NOT include: outbound messaging, per-user GHL sender mapping, auto-mark-on-open, read attribution to individual Mason users in GHL, multi-location-per-org, or GHL opportunities/calendars/pipelines.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Navigation for the GHL Inbox MUST be registered in the application router alongside existing dashboard routes without breaking coexistence of the app shell router and legacy page routes.
- **AC-002 (Module boundaries)**: All GHL Inbox UI and client data hooks MUST live in a dedicated feature module; the feature MUST NOT deep-import other features’ internals. Shared UI belongs in shared components.
- **AC-003 (RLS as boundary)**: Organisation membership for the connection table MUST be enforced with row-level security; UI role checks supplement but do not replace data-layer enforcement.
- **AC-004 (Parallel inbox)**: This feature MUST NOT modify `inbox_conversations`, `inbox_messages`, or related unified Inbox schema or behaviour.
- **AC-005 (Read-through)**: No sync jobs or Mason tables for GHL message bodies in Phase 1; all conversation and message display is live fetch from GHL via server proxy.
- **AC-006 (JWT org resolution)**: Server entry points MUST derive organisation from the authenticated session JWT and load the matching connection row; they MUST NOT trust client-supplied organisation identifiers for authorisation.
- **AC-007 (Admin gating)**: Admin-only connection management MUST use organisation admin membership from the organisation context hook pattern—not a global admin flag unrelated to the current org.
- **AC-008 (GHL API contract)**: Server integration MUST use GHL API v2 base host, bearer private integration token authentication, and the required API version header as established for this project.
- **AC-009 (Webhook verification)**: Inbound GHL webhooks MUST verify signatures using a dedicated webhook secret stored only in server-side secrets.
- **AC-010 (Production target)**: Production deployment for schema and functions MUST target the designated production Supabase project for this repository only.

### Key Entities *(include if feature involves data)*

- **GHL Connection**: The binding between one Mason organisation and one GHL location, including status (active, disconnected, error), last successful verification time, and timestamps. One row per organisation maximum.
- **GHL Conversation (logical)**: A thread of messages in GHL as returned by live API reads; not stored in Mason in Phase 1. Includes unread count used for badges.
- **GHL Message (logical)**: An individual inbound or outbound message in a conversation as returned by GHL; displayed read-only in Mason in Phase 1.
- **GHL Contact (logical)**: Person record in GHL linked to a conversation; details shown in the contact panel via live read.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Members of an organisation with an active GHL connection can open the GHL Inbox screen and see their live conversation list on first load without using GHL’s native inbox UI for that check.
- **SC-002**: Under normal operating conditions, a new inbound message to the connected GHL location appears in the open Mason GHL Inbox within 10 seconds in at least 95% of test trials during user acceptance testing.
- **SC-003**: After using Mark as read on a conversation with unread messages, 100% of UAT cases show cleared unread state in both Mason and GHL’s native UI for that conversation.
- **SC-004**: Security review confirms zero exposure of the private integration token in frontend bundles, repository commits, or browser-visible API requests during standard usage.
- **SC-005**: The disabled composer and Phase 2 label are visible on every thread view in UAT, with zero accidental outbound sends possible in Phase 1.
- **SC-006**: The connection-table migration file exists in the repository and is applied to production before go-live; no GHL message tables are introduced in Mason.
- **SC-007**: Pilot client staff (target: Sears Melvin) can monitor inbound WhatsApp (and other GHL-channel) traffic from Mason alone for a full business day without requiring GHL’s inbox UI for read-only triage.

## Assumptions

- The client’s GHL account already has a Private Integration Token and location ID available to the implementation team for secure server configuration; Mason does not obtain these through end-user OAuth in Phase 1. Pilot org connection metadata is seeded via migration/SQL, not an in-app connect wizard.
- Webhook registration in the GHL dashboard is performed by the client’s GHL administrator (Arin), using the instruction sheet produced by this project.
- Exact GHL webhook event names and payload shapes will be confirmed during technical planning from current GHL v2 documentation; minimum areas of interest include inbound messages, outbound messages (for list freshness), and contact create/update.
- Network connectivity and GHL API availability are similar to other third-party integrations already used in Mason (Stripe, WhatsApp); extended GHL outages are handled with standard error and retry UX.
- Users already have Mason accounts and organisation membership; this feature does not introduce a new authentication method.
- English UI copy and UK-oriented operational tone match the rest of Mason.
- Phase 2 outbound messaging will reuse the same screen layout; Phase 1 intentionally reserves composer placement.

## Dependencies

- GoHighLevel API v2 availability and stable read endpoints for conversations, messages, contacts, and mark-as-read.
- Secure server environment for API key, location ID, and webhook secret storage.
- Client-side webhook registration in GHL before live-update acceptance criteria can pass in production.
- Organisation admin availability to establish or verify the `ghl_connections` row for the pilot organisation.
- Supabase Realtime (or equivalent cache invalidation channel) for pushing refresh signals to connected browsers after verified webhooks.

## Out of Scope (Phase 1)

- Outbound message sending and any send-message server endpoint.
- Mapping Mason users to GHL users for send attribution.
- Automatic mark-as-read when opening a thread.
- Storing which Mason user marked a conversation read in GHL.
- Multiple GHL locations per organisation.
- GHL opportunities, calendars, pipelines, or non-inbox GHL modules.
- Merging or replacing Mason’s existing unified Inbox module.
