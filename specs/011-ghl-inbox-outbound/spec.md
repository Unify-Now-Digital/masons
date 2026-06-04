# Feature Specification: GHL Inbox — Phase 2 (Outbound Send)

**Feature Branch**: `011-ghl-inbox-outbound`  
**Created**: 2026-06-01  
**Status**: Draft  
**Input**: User description: "Enable Mason staff to reply outbound to customers from the GHL Inbox, turning the currently read-only conversation thread into a two-way surface."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send a reply on the conversation's existing channel (Priority: P1)

As an authenticated organization member viewing a customer conversation in the GHL Inbox, I can type a text reply and send it so the customer receives the message on the same channel they are already using to talk to us (SMS, WhatsApp, or email), without choosing or switching channels.

**Why this priority**: This is the core value of Phase 2 — staff can respond to customers from Mason instead of switching to GoHighLevel, completing the two-way inbox experience begun in Phase 1.

**Independent Test**: Can be fully tested by opening a conversation with a known test contact, composing a short text message, sending it, and confirming the customer receives it on the expected channel and the message appears in the thread after refresh from GoHighLevel.

**Acceptance Scenarios**:

1. **Given** I am a signed-in member of an organisation with an active GoHighLevel connection and outbound send enabled for that organisation, **When** I open a conversation and type a non-empty message and choose Send, **Then** the message is delivered to the customer through GoHighLevel on that conversation's existing channel.
2. **Given** I send a reply successfully, **When** the thread refreshes from GoHighLevel, **Then** I see my sent message in the conversation history alongside prior inbound and outbound messages.
3. **Given** outbound send is not enabled for my organisation, **When** I open a conversation thread, **Then** I see the composer in its reserved position but cannot send messages, with a clear explanation that sending is not yet enabled for this workshop.
4. **Given** my organisation has no active GoHighLevel connection, **When** I open the GHL Inbox, **Then** I cannot send messages and see the same empty or setup state as in Phase 1.

---

### User Story 2 - See clear send states and recover from errors (Priority: P1)

As an authenticated organization member composing a reply, I see unmistakable states while sending — composing, sending, sent (reflected in the thread), and a visible error if the send fails — so I always know whether my message reached the customer and what to do next.

**Why this priority**: Outbound messaging reaches real customers on live phones and inboxes; ambiguous or silent failures would erode trust and risk duplicate or missed replies.

**Independent Test**: Can be fully tested by sending a message under normal conditions (observe sending then sent states), then triggering a failure (e.g. disconnected network or invalid credentials in a test environment) and confirming the composer retains the draft, shows a readable error, and allows a safe retry.

**Acceptance Scenarios**:

1. **Given** I have typed a valid message, **When** I choose Send, **Then** the interface shows a sending state and prevents me from submitting the same send action again until the attempt completes.
2. **Given** the send succeeds, **When** the thread updates from GoHighLevel, **Then** the sending state clears, the composer is ready for a new message, and my sent message is visible in the thread.
3. **Given** the send fails due to network error, GoHighLevel rejection, or expired credentials, **When** the failure is returned, **Then** I see a clear error message, my message text remains in the composer (not lost), and I can edit and retry.
4. **Given** the customer is outside the WhatsApp 24-hour messaging window, **When** I attempt to send a free-form reply, **Then** GoHighLevel rejects the send and I see a clear, human-readable explanation of why the message could not be sent (without requiring me to understand GoHighLevel internals).
5. **Given** my message contains only whitespace, **When** I attempt to send, **Then** the send action is not available and I receive inline validation that the message cannot be empty.

---

### User Story 3 - Never deliver duplicate messages on double-submit or retry (Priority: P1)

As an authenticated organization member, if I click Send twice, mash the keyboard, or retry after a slow or ambiguous response, the customer must receive at most one copy of that outbound message.

**Why this priority**: Duplicate messages to bereaved families or active customers are embarrassing, confusing, and potentially costly; idempotency is a hard requirement for go-live.

**Independent Test**: Can be fully tested by rapidly double-clicking Send, retrying after a simulated timeout, and confirming only one message appears in GoHighLevel and reaches the test recipient.

**Acceptance Scenarios**:

1. **Given** I have submitted a send, **When** I click Send again before the first attempt completes, **Then** the second action is ignored or blocked and only one outbound message is created in GoHighLevel.
2. **Given** a send appears to have failed or timed out, **When** I retry with the same message content for the same conversation within a short window, **Then** the system does not create a duplicate outbound message in GoHighLevel unless the first attempt definitively failed with no message created.
3. **Given** I successfully sent a message and the thread shows it, **When** I compose and send a new different message, **Then** each distinct send creates exactly one new outbound message (idempotency applies per send attempt, not across separate intentional sends).

---

### User Story 4 - Organisation-scoped sending with a single shared voice (Priority: P2)

As an authenticated organization member, when I send a reply it is attributed to the organisation as a single shared voice in GoHighLevel, not to me personally as an individual staff member, so customers experience one consistent workshop identity.

**Why this priority**: Matches how small memorial masonry businesses typically operate their shared inbox; avoids premature complexity of per-staff sender mapping.

**Independent Test**: Can be fully tested by having two different staff members send replies from the same organisation and confirming both appear under the organisation's default GoHighLevel sender identity, not individual Mason user names.

**Acceptance Scenarios**:

1. **Given** two different members of the same organisation send replies in the GHL Inbox, **When** the messages appear in GoHighLevel, **Then** both are attributed to the organisation's default sender identity, not to individual Mason staff accounts.
2. **Given** I am a member of organisation A, **When** I send a reply, **Then** the message is sent only through organisation A's GoHighLevel connection and never through another organisation's credentials.

---

### User Story 5 - Progressive enablement per organisation (Priority: P2)

As an organisation administrator or implementation operator, I can enable outbound send capability for a specific organisation only after a successful test, so live customer accounts are not exposed to send bugs before validation.

**Why this priority**: Phase 2 is the first capability that writes to real customer phones and email addresses; cautious rollout protects live businesses such as pilot clients.

**Independent Test**: Can be fully tested by confirming send is disabled by default for all organisations, enabling it for one test organisation, verifying send works there, and confirming a second organisation without enablement still cannot send.

**Acceptance Scenarios**:

1. **Given** a newly connected organisation, **When** outbound send has not been explicitly enabled, **Then** members see the composer area but cannot send messages.
2. **Given** outbound send has been enabled for organisation A after a clean test, **When** a member of organisation A sends a reply, **Then** the send succeeds subject to GoHighLevel and channel rules.
3. **Given** outbound send is enabled for organisation A but not organisation B, **When** a member of organisation B opens the GHL Inbox, **Then** they cannot send messages regardless of organisation A's status.

---

### Edge Cases

- Send fails (network error, GoHighLevel API error, expired or revoked credentials): message text is preserved in the composer, a clear error is shown, and retry is safe without duplicating a successful prior attempt.
- Customer is outside the WhatsApp 24-hour free-form messaging window: GoHighLevel rejects the send; Mason surfaces the rejection clearly; template-message handling is out of scope for v1.
- Empty or whitespace-only message: send is blocked with inline validation; no outbound call is made.
- User is authenticated but not a member of the organisation: no send capability and no access to another organisation's GoHighLevel connection.
- GoHighLevel credentials lack write permission for sending: send fails with a clear operator-facing error; no partial or silent success.
- Very slow GoHighLevel response: sending state persists; duplicate submission is prevented until the attempt resolves.
- Conversation channel is email, SMS, or WhatsApp: reply always uses the conversation's existing channel; no channel picker is offered in v1.
- Existing Phase 1 behaviours (read-through display, mark-as-read, live updates, contact panel, multi-org isolation) continue to work when outbound send is enabled or disabled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow authenticated organisation members to send a single plain-text reply from the GHL Inbox message thread when outbound send is enabled for their organisation and an active GoHighLevel connection exists.
- **FR-002**: The system MUST send outbound replies only on the conversation's existing channel; channel selection or switching MUST NOT be offered in v1. Pilot channels are SMS, WhatsApp, and email; the implementation also accepts GHL's IG, FB, and Live_Chat channel types so it does not break on such threads, though these are not part of the v1 pilot scope.
- **FR-003**: The system MUST attribute outbound messages to the organisation's shared GoHighLevel sender identity; per-staff sender mapping MUST NOT be implemented in v1.
- **FR-004**: The system MUST NOT persist customer message bodies in Mason; sent messages MUST appear in the thread only by re-fetching conversation history from GoHighLevel after a successful send.
- **FR-005**: The system MUST scope every send operation to the signed-in user's current organisation, resolved server-side from the authenticated session — not from organisation identifiers supplied by the client alone.
- **FR-006**: The system MUST ensure one organisation can never send messages through another organisation's GoHighLevel connection.
- **FR-007**: GoHighLevel API credentials MUST remain server-side only; they MUST NOT appear in frontend bundles, committed files, or browser-visible requests.
- **FR-008**: The system MUST expose a server-side send path that accepts the organisation context, conversation identifier, and message text, performs the GoHighLevel outbound send, and returns success or a structured failure to the client.
- **FR-009**: The system MUST provide visible UI states for composing, sending, successfully sent (thread updated), and failed send.
- **FR-010**: On send failure, the system MUST retain the user's message text in the composer and display a clear, actionable error message.
- **FR-011**: The system MUST prevent empty or whitespace-only messages from being sent.
- **FR-012**: The system MUST enforce idempotency so that double-submit, rapid repeated clicks, or safe retry after ambiguous failure never produces more than one outbound message to the customer for the same send intent.
- **FR-013**: Outbound send capability MUST be disabled by default for each organisation and MUST be enableable per organisation independently after operator validation.
- **FR-014**: When outbound send is disabled for an organisation, the composer MUST remain visible in its Phase 1 position but MUST NOT allow sending, with copy explaining that outbound messaging is not yet enabled for this workshop.
- **FR-015**: When GoHighLevel rejects a send (including WhatsApp 24-hour window violations), the system MUST surface GoHighLevel's rejection in plain language without attempting template-message fallback in v1.
- **FR-016**: The system MUST NOT introduce Mason database tables for storing GoHighLevel message bodies; read-through remains the display model.
- **FR-017**: Phase 2 MUST NOT modify Mason's existing unified Inbox module or its conversation and message stores.
- **FR-018**: Attachments, scheduled sends, channel pickers, WhatsApp template management, and per-staff GoHighLevel user mapping MUST NOT be included in v1.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Navigation and routing for the GHL Inbox MUST preserve coexistence of the application shell router and legacy page routes; enabling send MUST NOT require router restructuring.
- **AC-002 (Module boundaries)**: All GHL Inbox outbound UI and client hooks MUST live in the dedicated GHL Inbox feature module; shared functionality MUST be promoted to shared components, not deep-imported from other features.
- **AC-003 (RLS as boundary)**: Organisation membership and send-enablement flags MUST be enforced at the data layer; UI role checks supplement but do not replace data-layer authorisation.
- **AC-004 (Parallel inbox)**: This feature MUST NOT modify unified Inbox schema or behaviour.
- **AC-005 (Read-through)**: No sync jobs or Mason tables for GoHighLevel message bodies; thread display after send is live fetch from GoHighLevel via existing read paths.
- **AC-006 (Per-org credentials)**: Each send MUST use the active GoHighLevel connection and credentials for the requesting organisation only, following the multi-org credential model established in Phase 1 refactor.
- **AC-007 (Composer continuity)**: The message composer MUST occupy the same position established in Phase 1; Phase 2 replaces disabled behaviour with working send behaviour rather than relocating the composer.
- **AC-008 (Progressive rollout)**: Send enablement MUST be controllable per organisation so pilot and production orgs can be onboarded incrementally.
- **AC-009 (Idempotency)**: Idempotency MUST be enforced with both client-side in-flight protection and server-side deduplication sufficient to prevent duplicate customer delivery under double-submit and retry scenarios.
- **AC-010 (Credential verification gate)**: Implementation MUST NOT begin until it is verified that the organisation's GoHighLevel credentials include write access to the messages send capability required for outbound replies.

### Key Entities *(include if feature involves data)*

- **GHL Connection (extended)**: The existing organisation-to-GoHighLevel binding; gains an outbound-send-enabled flag (or equivalent per-organisation setting) defaulting to off. Credentials remain server-side encrypted per organisation.
- **GHL Conversation (logical)**: Unchanged from Phase 1 — a thread in GoHighLevel with an associated channel; the send operation targets this conversation and its channel.
- **GHL Message (logical)**: An individual message in a conversation as returned by GoHighLevel; outbound messages are not stored in Mason but appear in the thread after re-fetch.
- **Send Attempt (logical)**: A single user-initiated outbound send with a deduplication identity used to guarantee at-most-once delivery to the customer for that intent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In user acceptance testing, members of an organisation with send enabled can compose and deliver a text reply to a test contact on SMS, WhatsApp, and email conversations respectively, with the sent message visible in the Mason thread within 10 seconds of successful send in at least 95% of trials.
- **SC-002**: In idempotency testing (double-click, rapid resubmit, retry after simulated timeout), zero duplicate outbound messages reach the test customer across at least 20 deliberate stress attempts per channel type tested.
- **SC-003**: In failure testing, 100% of simulated send failures (network, credential, WhatsApp window rejection) retain the draft in the composer and display a readable error without silent loss of the user's text.
- **SC-004**: Organisations with send disabled show a non-sendable composer in 100% of UAT checks; no outbound message is created in GoHighLevel from those organisations during testing.
- **SC-005**: Security review confirms zero exposure of GoHighLevel private integration tokens in frontend bundles, repository commits, or browser-visible API requests during standard send usage.
- **SC-006**: Cross-organisation isolation testing confirms zero instances of organisation A's send using organisation B's connection across all UAT send scenarios.
- **SC-007**: Pilot staff can handle a full business day's customer replies from the GHL Inbox without switching to GoHighLevel's native inbox for outbound messaging, once send is enabled for their organisation after successful test validation.

## Assumptions

- Phase 1 GHL Inbox (read-through viewing, mark-as-read, live updates, multi-org encrypted credentials) is shipped and stable; Phase 2 builds on that foundation without rebuilding it.
- The organisation's GoHighLevel private integration token can be granted write scope for sending new conversation messages; this will be verified against current GoHighLevel documentation before implementation begins.
- GoHighLevel remains the system of record for all message content; Mason is a dedicated UI over GoHighLevel for inbox operations.
- Outbound messages appear in GoHighLevel under the organisation's default sender identity without per-staff Mason-to-GoHighLevel user mapping in v1.
- WhatsApp 24-hour window restrictions are enforced by GoHighLevel; v1 attempts free-form sends and surfaces GoHighLevel errors rather than managing templates or window logic in Mason.
- Initial rollout uses operator-controlled per-organisation enablement; test sends are coordinated against known test contacts before enabling for live business accounts.
- Users already have Mason accounts and organisation membership; this feature does not introduce new authentication.
- English UI copy and UK-oriented operational tone match the rest of Mason.
- Network connectivity and GoHighLevel API availability are similar to Phase 1; extended outages are handled with standard error and retry UX subject to idempotency rules.

## Dependencies

- Phase 1 GHL Inbox module and server-side read proxies (list conversations, get messages, get contact, mark-as-read).
- Multi-org per-organisation encrypted GoHighLevel credentials (connection row, server-only decryption).
- GoHighLevel API availability and a documented send-message capability with appropriate credential scopes (to be verified pre-implementation).
- Live-update path (webhook plus client refresh) so sent messages appear in open threads without manual full-page reload where possible.
- Operator process for enabling send per organisation after successful test against a controlled test contact.

## Out of Scope (v1)

- Per-staff sender attribution and Mason-user-to-GoHighLevel-user mapping.
- WhatsApp template messages and proactive 24-hour window management in Mason.
- Channel selection, channel switching, attachments, and scheduled sends.
- Storing message bodies or send history in Mason database tables.
- Modifying Mason's existing unified Inbox module.
- In-app GoHighLevel connect/onboard wizard changes beyond what Phase 1 already provides.
- Auto-send, AI-drafted sends, or any send without explicit staff action.

## Accepted v1 risks

**Ambiguous-retry duplicate (US3 scenario 2 / idempotency timeout window).** The common duplicate-send case — same `requestId`, fast double-click/retry — is prevented by the client in-flight lock and the server-side `ghl_send_idempotency` table (verified T027). A narrow residual case remains: if a GHL send succeeds but the response is lost (client timeout) and the client retries with a new `requestId`, or a stale (>60s) `pending` row is re-driven, a second customer message can result. Accepted for v1: the window is narrow, no occurrences observed in live testing, and outbound volume is low (staffed shared inbox). Future hardening: dedupe on (organization + conversation + content-hash + short TTL), or a pre-send GHL thread probe, beyond the per-attempt `requestId`.
