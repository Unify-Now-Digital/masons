# Feature Specification: Gmail sent mail in unified inbox

**Feature Branch**: `003-gmail-sent-inbox-sync`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "Sync Gmail SENT messages into inbox_messages as direction: 'outbound'. Context: sync currently only considers the Inbox label; replies sent from Gmail web do not appear in app conversations; goal is to also consider Sent mail, store as outbound, and attach to the right conversation using the email thread identity."

## Current state (what exists today)

- **Inbox-only discovery**: The Gmail sync process lists messages using the **Inbox** label only. Time filters (`after:` from last sync or a first-run window) apply to that list.
- **Thread expansion**: When a listed message is processed, the full **thread** is loaded and each message in the thread is considered for storage. Matching to an existing conversation uses the **email thread identifier** stored on messages (so replies in the same Gmail thread can land in one conversation).
- **Outbound detection**: For each message, “who sent it” is inferred from standard email headers. If the sender matches the connected mailbox, the message is treated as **outbound**; otherwise **inbound**.
- **Gap**: Messages that exist only under **Sent** (common for replies composed in Gmail on the web) often **never appear in Inbox**, so they are **never listed**, the thread is **not expanded from those rows**, and **outbound sends from the web do not show** in the app’s conversation timeline—even when the customer’s earlier message was already imported.
- **Unified inbox model**: Conversations and messages distinguish **inbound** vs **outbound**; the app’s “sync Gmail” action triggers the same sync flow users already use (no change to that trigger is required for the core outcome).
- **Body handling**: Plain text and HTML bodies are derived from the provider’s message structure in a consistent way for sync and refresh paths.

## Proposed changes (what should change)

- **Include Sent mail in discovery**: The sync process should also consider messages labeled **Sent** (in addition to Inbox), subject to the same sensible time window and volume limits as today, so outbound mail sent outside the app can be imported.
- **Store as outbound**: Messages identified as sent by the mailbox owner should appear in **`inbox_messages`** as **outbound**, with content and timestamps suitable for reading in the conversation view.
- **Attach to the right conversation**: Outbound Sent messages must join the **same conversation** as the rest of the thread when that thread already exists in the product; the thread identity already used for email should remain the anchor for matching.
- **Avoid duplicates**: If a message was already stored (including sends originating from the app), importing again must not create a second copy.
- **Conversation updates**: When a new outbound message becomes the latest in the thread, the conversation’s **last activity** and **preview** should update in line with existing rules (outbound messages should not spuriously inflate “unread” counts).

## Database introspection (requested SQL)

The following queries were requested for documentation:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inbox_messages'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'inbox_messages';

SELECT meta FROM inbox_conversations LIMIT 3;

SELECT meta, external_message_id, direction FROM inbox_messages LIMIT 3;
```

**Execution result (this environment, 2026-04-17)**:

- **Live database**: Not available here. `supabase db query --linked` failed (connection timeout / login role). Local Postgres was not reachable (Docker engine unavailable). **No live result sets** were returned.
- **Supplemental reference (from repository migrations)** — indexes declared for `inbox_messages` include among others:  
  `idx_inbox_messages_organization_id`, `idx_inbox_messages_message_type`, `idx_inbox_messages_whatsapp_managed_connection_id`, `idx_inbox_messages_whatsapp_connection_id`, `idx_inbox_messages_user_id`, `idx_inbox_messages_gmail_connection_id`, and deduplication indexes involving `external_message_id` (including a unique composite on channel + external id where applicable).
- **Supplemental reference (columns)** — migrations add or use fields including: organization scope, per-channel connection identifiers (email/WhatsApp), message type, body HTML, subject, external message id, user ownership, and JSON **meta** for provider-specific ids (e.g. Gmail message and thread ids). Exact ordinal order and every index name should be confirmed in the target environment when connected.

**Sample rows (`meta`, `external_message_id`, `direction`)**: Not captured; re-run the queries against staging/production when validating the spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Gmail web replies in the app thread (Priority: P1)

A staff member replies to a customer **from Gmail in the browser**. After the usual sync, that reply appears **in the same conversation** in the app as an **outbound** message, in order with the rest of the thread.

**Why this priority**: Without this, the in-app thread is misleading—incomplete compared to what the team actually sent.

**Independent Test**: Send a reply from Gmail web in a thread that already exists in the app; run sync; confirm the new outbound line appears once, in order, with correct preview on the conversation.

**Acceptance Scenarios**:

1. **Given** a conversation already imported from a customer email, **When** the user sends a reply from Gmail web and sync runs, **Then** that reply appears as outbound in that conversation without duplicating older messages.
2. **Given** sync runs twice, **When** the same Sent message would be imported again, **Then** it does not create a second copy.

---

### User Story 2 - Thread preview stays truthful (Priority: P2)

The conversation list shows a **last message preview** and time that reflect the latest activity **including** outbound Gmail web sends.

**Why this priority**: Users scan the list for “what happened last”; missing Sent mail makes threads look stale.

**Independent Test**: After a Gmail web reply, the conversation row shows updated preview/time consistent with that reply being the latest message.

**Acceptance Scenarios**:

1. **Given** a new outbound message is imported from Sent, **When** it is newer than prior messages, **Then** the conversation’s summary reflects that message (preview and ordering), without increasing unread count solely because of outbound mail.

---

### User Story 3 - Operational safety (Priority: P3)

Sync remains **bounded** (does not try to import unbounded history in one run) and **fails gracefully** when the mailbox provider is unavailable.

**Why this priority**: Sent + Inbox increases work; limits and errors must stay understandable.

**Independent Test**: Observe that sync completes within existing volume expectations and surfaces a clear failure when the provider cannot be reached.

**Acceptance Scenarios**:

1. **Given** a large mailbox, **When** sync runs, **Then** only messages within the configured window/cap are considered (same class of limits as today unless product explicitly expands them).

### Edge Cases

- **Sent-only thread**: The first message in a thread was sent only from Sent (e.g. a new outreach). The product should define whether to create a conversation and how the counterparty address is chosen for the thread.
- **Duplicates across app send and Sent import**: A message might already exist from an in-app send; deduplication must hold.
- **Multiple recipients / BCC**: “Primary” counterparty for conversation identity may be ambiguous.
- **Partial failures**: Some threads succeed and others fail; the mailbox should not be left in an inconsistent state (e.g. sync cursor advanced without persisting expected rows).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sync MUST consider **Sent** mail as well as **Inbox** mail so that outbound messages sent outside the app can be imported.
- **FR-002**: Imported Sent messages MUST be stored as **outbound** when they represent mail sent by the connected mailbox.
- **FR-003**: Sent messages MUST be attached to the **existing conversation** for the same email thread when one exists.
- **FR-004**: The system MUST **not** insert duplicate rows for the same provider message when sync runs multiple times.
- **FR-005**: Conversation **last activity** and **preview** MUST update when a newly imported outbound message is the latest in the thread, consistent with rules for unread handling.
- **FR-006**: Sync MUST remain subject to explicit **volume/time bounds** so a single run cannot grow without limit.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation or routing MUST preserve the coexistence of `src/app/` (app shell/router wiring) and `src/pages/` (legacy/singleton pages), or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live in `src/modules/<feature>/` and MUST NOT deep-import other features’ internals; shared functionality MUST be promoted into `src/shared/`.
- **AC-003 (RLS as boundary)**: Authorization MUST be enforced in the database via RLS; UI checks are not security.

### Key Entities *(include if feature involves data)*

- **Conversation**: A thread of messages with a customer or contact; holds summary fields (e.g. last message time, preview, unread count).
- **Inbox message**: A single inbound or outbound message in a conversation, including provider metadata for deduplication and threading.
- **Mailbox connection**: The linked email account used to authorize sync and attribute outbound mail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a thread where the customer email was already in the app, **100%** of Gmail web replies sent in that thread appear in the app after sync (under normal provider availability), with **zero duplicate** copies of the same send.
- **SC-002**: In user acceptance testing, **at least 9 in 10** evaluators report the conversation list preview matches their last Gmail action (send or receive) for threads they exercised.
- **SC-003**: Sync runs complete without unbounded growth of work: **at least 95%** of manual sync attempts in testing finish within the same order of magnitude of duration as Inbox-only sync for comparable windows (no systematic multi-minute stalls).

## Assumptions

- The connected Gmail account grants scope sufficient to read **Sent** as well as **Inbox** (same connection model as today).
- **Thread identity** from the provider is stable for matching Sent messages to existing conversations.
- **Incremental sync** semantics (e.g. based on last successful sync time) remain acceptable for Sent as well as Inbox unless product asks for a one-off historical backfill.
- **Deduplication** keys already used for Gmail messages remain valid when Sent mail is included.

## Open questions

- **OQ-1 (Sent-only new threads)**: Should the first message in a thread that exists only under Sent always create a conversation, and which **counterparty address** should define the thread when multiple recipients exist?
- **OQ-2 (Historical depth)**: Should the first run after enabling Sent import pull **more** than the usual window for Sent, or stay strictly aligned with the same `after:` / rolling window as Inbox?
- **OQ-3 (Unread semantics)**: Confirm product expectation that **outbound** imports never increase **unread** (current model for outbound), including edge cases where the user reads mail only in Gmail.

## Out of scope

- Importing **labels** beyond Inbox + Sent (e.g. Drafts, Spam, custom labels) unless separately specified.
- Changing **how** users compose email inside the app, or replacing Gmail as the sending surface.
- **Real-time** push sync (this spec covers behavior when the user’s sync runs or scheduled sync executes).
- **Non-email** channels (SMS/WhatsApp) and their provider-specific sync rules.

## Dependencies

- Active Gmail (or compatible) connection for the user and successful provider calls during sync.
- Existing conversation and message model with inbound/outbound distinction and thread metadata.
