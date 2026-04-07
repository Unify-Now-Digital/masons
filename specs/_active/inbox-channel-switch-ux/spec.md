# Feature Specification: Inbox Channel Switching UX

**Feature Branch**: `feature/inbox-channel-switch-ux`  
**Created**: 2026-03-31  
**Status**: Draft

---

## Clarifications (locked)

The following decisions apply to this feature; they supersede earlier draft wording where they differ.

1. **Conversations tab empty state**: Use the existing **NewConversationModal** when the user clicks `Start new conversation`. No new modal or replacement component is required for this flow.
2. **SMS new conversation**: **Out of scope for now.** SMS channel switching may be improved (e.g. selection always updates), but when the user would start a new SMS thread, show a clear message that **starting a new SMS conversation is not supported** yet. Do not implement SMS create-on-send or SMS fields in the modal for this feature.
3. **Customers tab — first message**: Staff must click an explicit **`Start conversation`** (or equivalent) control **first**. That action **creates** the conversation (via existing create flow). Only **after** creation succeeds does the reply composer become active for normal send. There is no single-step “first send creates the conversation” requirement in Customers tab.

**Additional constraints**

- **Email**: Subject line is **required** (not optional) when starting a **new email** conversation.
- **WhatsApp**: When starting a **new WhatsApp** conversation, the reply UI must open in **template mode automatically** (existing WhatsApp template sender).
- **Reuse**: Use the existing **`useCreateConversation`** hook and **`NewConversationModal`**; no schema changes; **frontend-only** implementation.

**Implementation bindings (2026-04-08)**

- **Unlinked / missing `person_id` (Conversations tab)**: Still update the selected channel; show *“Link a person to start a conversation in this channel”* — **no** `Start new conversation` button (existing unlinked pattern).
- **WhatsApp default template mode**: Use **`messages.length === 0`** for the full message list passed to the thread (entire timeline in Customers tab; single thread in Conversations tab) as the trigger to default reply mode to **template**.
- **Start conversation (Customers)**: Show **Start conversation** only when **`person_id` is linked** and the **channel handle** exists (**email** on record for Email, **phone** for WhatsApp). SMS remains deferred with unsupported copy only.

---

## User Scenarios & Testing

### User Story 1 - Conversations Tab Supports Channel Switching Without Existing Thread (Priority: P1)

Staff can switch to any channel in the Conversations tab, even when no conversation currently exists in that channel.

**Why this priority**: Current behavior blocks core workflow and makes channel buttons feel broken.

**Independent Test**: In Conversations tab, switch to a channel with no existing conversation and confirm an actionable empty state appears; `Start new conversation` opens the existing NewConversationModal for that channel (where supported).

**Acceptance Scenarios**:

1. **Given** staff is in Conversations tab, **When** they click any channel button, **Then** the selected channel always becomes active.
2. **Given** selected channel has no existing conversation thread, **When** thread view loads, **Then** an empty state is shown instead of a no-op.
3. **Given** empty state is shown and the channel supports new conversation creation (Email or WhatsApp), **When** staff clicks `Start new conversation`, **Then** **NewConversationModal** opens scoped to the selected channel.
4. **Given** staff completes new conversation creation from the modal, **When** creation succeeds, **Then** the new thread is selected or visible for that channel and normal reply applies.
5. **Given** selected channel is SMS and new SMS conversation is deferred, **When** empty state or start is shown, **Then** the UI explains that starting a new SMS conversation is not supported (no broken send path).

---

### User Story 2 - Customers Tab Keeps Timeline Context While Enabling New Channel Start (Priority: P1)

Staff can switch channels freely in Customers tab without losing visible customer timeline context. When the selected channel has no conversation yet, staff use an explicit start step before the composer is active.

**Why this priority**: Customers view is cross-channel by design; the timeline must stay readable while channel-specific start rules are enforced.

**Independent Test**: In Customers tab, switch to a channel with no active conversation: messages stay visible; composer for that channel is inactive until `Start conversation` succeeds; then sending works like an existing thread.

**Acceptance Scenarios**:

1. **Given** staff is in Customers tab, **When** they switch channel, **Then** switching always succeeds.
2. **Given** selected channel has no active conversation for that customer, **When** view updates, **Then** existing customer timeline messages remain visible.
3. **Given** selected channel has no active conversation, **When** the view updates, **Then** the reply composer is **not** available for send until a conversation exists; an explicit **`Start conversation`** action is shown instead.
4. **Given** staff clicks **`Start conversation`**, **When** creation completes successfully, **Then** a conversation exists for the selected channel and the composer becomes active for normal send.
5. **Given** selected channel is SMS (new conversation deferred), **When** staff needs a new SMS thread, **Then** the UI shows that starting a new SMS conversation is not supported (no implied create-on-send).

---

### User Story 3 - Channel-Specific First-Message Requirements (Priority: P2)

New conversation creation respects channel-specific constraints while reusing existing modal and send workflows.

**Why this priority**: First-message creation must preserve channel compliance and current business rules.

**Independent Test**: Validate NewConversationModal and post-create reply behavior for Email and WhatsApp; validate SMS unsupported messaging only.

**Acceptance Scenarios**:

1. **Given** staff starts a new **Email** conversation, **When** using **NewConversationModal**, **Then** subject is **required** and send/create is blocked until provided.
2. **Given** staff starts a new **WhatsApp** conversation, **When** the thread is ready to compose, **Then** **template mode is active by default** for the initial outbound flow (existing template sender).
3. **Given** staff is on **SMS** with no new-conversation support, **When** they attempt to start a new SMS conversation, **Then** they see clear guidance that this is not supported (no silent failure).
4. **Given** required channel-specific fields are missing, **When** staff attempts to complete creation or send, **Then** the action is blocked with clear guidance.

---

### Edge Cases

- Channel switch target has no active conversation but has archived/closed history: empty/start behavior still uses active-thread rules.
- Customer has handle for one channel but missing handle for another: start action surfaces missing-handle guidance and blocks send until resolved.
- Create succeeds but thread refresh is delayed: UI shows pending state and resolves to the created conversation before enabling ambiguous duplicate sends.
- Staff switches channels repeatedly while draft exists: draft isolation follows selected channel and avoids accidental cross-channel send.
- **SMS**: Switching to SMS with no conversation shows unsupported message; existing SMS threads (if any) continue to behave as today.

---

## Requirements

### Functional Requirements

- **FR-001**: Conversations tab must allow selecting any channel button regardless of existing conversation availability.
- **FR-002**: Conversations tab must show an explicit empty state when selected channel has no active conversation (except where SMS deferral applies—see FR-014).
- **FR-003**: Conversations-tab empty state must provide a `Start new conversation` action bound to selected channel; **opening `NewConversationModal`** for Email and WhatsApp; for SMS, **FR-014** applies instead of modal create.
- **FR-004**: Customers tab must always allow channel switching without blocking.
- **FR-005**: Customers tab must keep existing customer timeline messages visible when selected channel lacks active conversation.
- **FR-006**: Customers tab must **not** allow send on the selected channel until a conversation exists; it must show **`Start conversation`** first.
- **FR-007**: **`Start conversation`** must **create** the conversation using **`useCreateConversation`** and **`NewConversationModal`** (Email/WhatsApp); after success, the composer becomes active for normal replies.
- **FR-008**: WhatsApp new conversation must open in **template mode automatically** after creation (or when composing the first outbound message in that flow—implementation aligns with existing **ConversationThread** template mode).
- **FR-009**: Email new conversation must require **subject** in **NewConversationModal** (not optional).
- **FR-010**: **SMS new conversation is deferred**: do not implement create flows; show a clear **unsupported** message when the user would start a new SMS conversation while improving SMS **channel switching** UX only.
- **FR-011**: Existing non-first-message send behavior must remain backward compatible.
- **FR-012**: No database schema, migrations, or backend data model changes are allowed.
- **FR-013**: Solution scope is frontend-only.
- **FR-014**: Where SMS new conversation is out of scope, the UI must not imply a working “start new SMS thread” path.

### Key Entities

- **Channel Selection State**: Active channel in Conversations or Customers view independent of whether a conversation exists.
- **Channel Availability State**: Presence or absence of active conversation for selected channel within current view context.
- **Start Conversation Action**: Explicit control that opens **NewConversationModal** (Email/WhatsApp) or shows SMS unsupported messaging, then creates a row via **`useCreateConversation`** where applicable.
- **First Message Payload**: Channel-specific inputs (Email subject required; WhatsApp template mode; SMS N/A for new thread in this release).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of channel button clicks in Conversations and Customers tabs result in visible channel selection change.
- **SC-002**: 100% of no-conversation channel states in Conversations tab show an actionable empty state or explicit SMS unsupported messaging, as appropriate.
- **SC-003**: At least 95% of Email/WhatsApp new-conversation attempts complete successfully on first try when required inputs are provided.
- **SC-004**: 0 regressions in existing reply send flows for conversations that already exist.
- **SC-005**: Staff can complete Email/WhatsApp new conversation start in under 60 seconds in manual verification (SMS new thread excluded).

---

## Assumptions

- **`NewConversationModal`** and **`useCreateConversation`** can be parameterized for channel and preconditions (subject required for email; WhatsApp defaults to template mode in thread).
- Existing WhatsApp template sender in **ConversationThread** satisfies “template mode automatically” for new WhatsApp threads once a conversation id exists.
- SMS improvements are limited to switching UX and messaging; no new SMS conversation API in this release.
