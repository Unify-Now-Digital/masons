# Feature Specification: Shared WhatsApp UI and Sender Identity

**Feature Branch**: `feature/shared-whatsapp-ui`  
**Created**: 2026-03-31  
**Status**: Draft

---

## User Scenarios & Testing

### User Story 1 - Shared WhatsApp Status With Admin-Only Controls (Priority: P1)

Any logged-in user can see the shared WhatsApp connection status in the top bar, while only the admin user can access connection management controls.

**Why this priority**: Staff need reliable visibility of shared channel readiness, but sensitive connect/disconnect actions must be restricted to an authorized admin.

**Independent Test**: Log in as admin and non-admin users and verify both can view status, but only admin can see action controls.

**Acceptance Scenarios**:

1. **Given** a logged-in non-admin user, **When** they view the top bar, **Then** WhatsApp status is visible and control actions are hidden.
2. **Given** a logged-in admin user, **When** they view the top bar, **Then** status and connect/disconnect/manage controls are visible.
3. **Given** status changes (connected/disconnected), **When** any user views the top bar, **Then** the displayed status reflects the current state.
4. **Given** `VITE_ADMIN_EMAIL` is configured, **When** user email matches it exactly, **Then** user is treated as admin for UI controls.

---

### User Story 2 - WhatsApp Outbound Sender Identity in Thread (Priority: P1)

When staff send outbound WhatsApp messages from the app, sender identity is stored in existing message metadata and displayed on outbound WhatsApp message bubbles.

**Why this priority**: Teams sharing channels need clear accountability for who sent each outbound message.

**Independent Test**: Send outbound WhatsApp messages from different staff accounts and verify `sender_email` is stored and shown on outbound WhatsApp bubbles only.

**Acceptance Scenarios**:

1. **Given** a staff user sends an outbound WhatsApp message, **When** the message is persisted via WhatsApp send flow, **Then** `meta.sender_email` is stored.
2. **Given** an outbound WhatsApp message has `meta.sender_email` matching the current logged-in user's email, **When** thread renders, **Then** the sender label displays `You`.
3. **Given** an outbound WhatsApp message has `meta.sender_email` different from current logged-in user's email, **When** thread renders, **Then** the sender label displays that email value.
4. **Given** an outbound WhatsApp message has no `meta.sender_email`, **When** thread renders, **Then** the sender label falls back to `You`.
5. **Given** inbound customer messages or non-WhatsApp outbound messages, **When** thread renders, **Then** sender label behavior remains unchanged.

---

### Edge Cases

- `VITE_ADMIN_EMAIL` is missing or empty: no user is treated as admin; status remains visible to all users.
- Outbound WhatsApp message metadata lacks `sender_email` for older messages: UI falls back to `You`.
- Authenticated user email is unavailable at send time: send still proceeds, and metadata falls back to empty-safe values.
- Non-admin users must not see connect/disconnect controls even if WhatsApp is disconnected.

---

## Requirements

### Functional Requirements

- **FR-001**: The top bar must show WhatsApp connection status to all logged-in users.
- **FR-002**: WhatsApp connect/disconnect/manage controls must be visible only to admin user.
- **FR-003**: Admin user determination must use `VITE_ADMIN_EMAIL` and authenticated user email comparison.
- **FR-004**: Non-admin users must see status-only UI with no control actions.
- **FR-005**: WhatsApp outbound sends (via `inbox-twilio-send`) must store sender identity in existing `inbox_messages.meta.sender_email`.
- **FR-006**: `meta.sender_email` must use authenticated user's email.
- **FR-007**: Conversation thread UI must apply sender label logic only for outbound WhatsApp messages: `You` when same user, sender email when different user, `You` fallback when absent.
- **FR-008**: Inbound customer messages and non-WhatsApp channels (email/SMS) must remain unchanged.
- **FR-009**: Existing send flows and channel behavior must remain backward-compatible.
- **FR-010**: No database schema changes, migrations, or new tables are allowed.

### Key Entities

- **User Session Identity**: Authenticated user email used for admin check and outbound WhatsApp sender metadata.
- **WhatsApp Connection Status View**: Shared status indicator visible to all users, with controls gated by admin check.
- **Outbound WhatsApp Message Metadata**: Existing `meta` JSON object on `inbox_messages` extended with `sender_email` for WhatsApp outbound sends.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of logged-in users can view current WhatsApp connection status in the top bar.
- **SC-002**: 100% of non-admin users are blocked from seeing connect/disconnect/manage controls in the UI.
- **SC-003**: 100% of new outbound WhatsApp messages sent from app include `meta.sender_email`.
- **SC-004**: Outbound WhatsApp thread messages display sender labels with correct `You`/email/fallback behavior for at least 95% of manual test cases.
- **SC-005**: No regressions are observed in existing email and SMS send/render flows during smoke testing.

---

## Assumptions

- The app already has authenticated user email available in frontend and edge-function execution context.
- Existing WhatsApp status data source remains unchanged; only visibility and control gating rules change.
- Existing `meta` JSON field is suitable for additive sender metadata without schema updates.
