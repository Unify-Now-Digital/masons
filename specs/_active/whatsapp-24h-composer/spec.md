# Feature Specification: WhatsApp 24-Hour Session Window (Composer)

**Feature Branch**: `feature/whatsapp-24h-composer`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: Add WhatsApp 24-hour window detection to the inbox composer so staff see when freeform replies are allowed vs template-only, aligned with WhatsApp Business API session rules.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See When WhatsApp Freeform Replies Are Allowed (Priority: P1)

A staff member composing a WhatsApp reply can immediately see whether the messaging session still allows normal (freeform) replies or only approved template messages, based on how recently the customer last messaged inbound.

**Why this priority**: Misunderstanding the 24-hour rule leads to failed sends or policy violations; clear session state prevents mistakes without reading external docs.

**Independent Test**: Open a WhatsApp thread where the last customer message was within the last 24 hours and confirm no “session expired” messaging and both freeform and template options behave as today.

**Acceptance Scenarios**:

1. **Given** the active reply channel is WhatsApp and the last inbound customer message in that conversation was sent within the last 24 hours, **When** the reply composer is shown, **Then** no expiry banner appears and the user can choose freeform or template mode as usual.
2. **Given** the active reply channel is WhatsApp and there is no inbound message in that conversation, **When** the reply composer is shown, **Then** the session is treated as closed (see User Story 2).
3. **Given** the active reply channel is Email or SMS, **When** the reply composer is shown, **Then** WhatsApp session rules and banners do not apply and behaviour is unchanged from before this feature.

---

### User Story 2 - Guided Template-Only Sending After Session Expiry (Priority: P1)

When the WhatsApp session is closed (no inbound message within 24 hours, or no inbound messages at all), staff see a clear warning and can only proceed via approved templates until the customer replies again.

**Why this priority**: After 24 hours without an inbound message, only templates are valid; the UI must enforce that expectation and avoid offering freeform sending.

**Independent Test**: Open a WhatsApp thread whose last inbound message is older than 24 hours (or has no inbound messages), confirm the warning appears, freeform entry is not offered, and template sending remains available.

**Acceptance Scenarios**:

1. **Given** the active reply channel is WhatsApp and the last inbound message was more than 24 hours ago, **When** the reply area is shown, **Then** an amber/yellow banner appears above the composer with wording equivalent to: “WhatsApp session expired. You can only send template messages until the customer replies.”
2. **Given** the same closed-session state, **When** the reply area is shown, **Then** the composer is in template-only mode automatically and the user cannot switch to freeform (no Freeform/Template toggle visible).
3. **Given** the same closed-session state, **When** the customer later sends an inbound message and the loaded conversation data reflects a new inbound within 24 hours, **Then** the banner is removed and freeform plus toggle behaviour returns (subject to Story 1 rules).

---

### User Story 3 - Consistent Rules for “No Inbound Yet” (Priority: P2)

When a WhatsApp conversation exists but has never received an inbound message from the customer, the session is treated as closed for freeform purposes so staff are not misled into sending a freeform business message where templates are required.

**Why this priority**: Matches platform expectations for business-initiated outreach without a recent customer message.

**Independent Test**: Use a WhatsApp conversation with only outbound messages in the loaded history; confirm closed-session UI and template-only composer.

**Acceptance Scenarios**:

1. **Given** WhatsApp is selected and the loaded messages for that conversation contain no inbound messages, **When** the composer is shown, **Then** the session is treated as closed (banner + template-only as in Story 2).

---

### Edge Cases

- **Clock boundaries**: The 24-hour boundary is evaluated from the timestamp of the last inbound message relative to “now” (staff’s device or application clock used consistently for the comparison).
- **Multiple inbound messages**: Only the **most recent** inbound message timestamp matters for session open/closed.
- **Channel switch**: Switching the reply channel away from WhatsApp hides WhatsApp-specific banners and restores normal behaviour for the other channel; switching back to WhatsApp re-evaluates session state from loaded messages.
- **Stale UI**: If new messages arrive while the composer is open, session state should update when the conversation’s loaded messages update (no requirement for real-time push beyond existing app behaviour).
- **Mixed-channel message lists**: If the loaded `messages` prop includes Email/SMS and multiple conversation ids (e.g. unified customer timeline), the 24-hour check MUST ignore non-WhatsApp rows and rows whose `conversation_id` is not the active WhatsApp send target (see FR-010).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For WhatsApp as the active reply channel only, the system MUST determine whether the “24-hour session” is **open** or **closed** using the timestamp of the **last inbound** message in the **current** WhatsApp conversation (messages from the customer toward the business).
- **FR-002**: Session MUST be **open** if and only if at least one inbound message exists and the latest inbound message’s time is within 24 hours before the current evaluation time.
- **FR-003**: Session MUST be **closed** if no inbound message exists in the loaded conversation history, or if the latest inbound message is older than 24 hours.
- **FR-004**: When session is **closed** and WhatsApp is the active reply channel, the system MUST show a prominent amber/yellow banner **above** the reply composer with the agreed expiry messaging (substance as in User Story 2).
- **FR-005**: When session is **closed** and WhatsApp is active, the reply composer MUST operate in **template-only** mode: no freeform text path for send, and no control to switch to freeform.
- **FR-006**: When session is **closed** and WhatsApp is active, the Freeform/Template mode toggle MUST be hidden so users cannot switch back to freeform until session rules indicate open again.
- **FR-007**: When session is **open** and WhatsApp is active, the system MUST NOT show the expiry banner and MUST allow the same freeform vs template choice as before this feature (toggle visible, both modes reachable).
- **FR-008**: Email and SMS reply behaviour MUST be unchanged: no WhatsApp session banner and no template-only lock from this feature.
- **FR-009**: Session evaluation MUST use message data already available to the reply composer (no new network requests solely for this feature).

### Architectural / Delivery Constraints

- **AC-001**: Implementation scope is **client-side only** for this specification: no new backend endpoints or database changes are in scope.
- **AC-002**: Detection MUST be derived from the **already-loaded** message list for the active conversation, using message direction and timestamps supplied by existing data.

### Key Entities

- **Inbound message**: A message in the conversation identified as from the customer (direction indicates inbound), with a send time used for comparison.
- **24-hour session state**: A binary **open** or **closed** outcome for WhatsApp freeform eligibility, derived from inbound message history.
- **Active reply channel**: The channel currently selected for sending a reply (WhatsApp, Email, or SMS); WhatsApp-specific rules apply only when this is WhatsApp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability review, staff can state whether freeform WhatsApp replies are allowed **without** consulting external documentation, for both open and closed sessions (binary correct answer ≥ 95% in guided test scenarios).
- **SC-002**: In test scenarios covering open session, closed session, and no inbound messages, WhatsApp reply UI matches the specified banner/toggle rules in **100%** of cases.
- **SC-003**: Email and SMS reply flows show **zero** new WhatsApp-specific banners or locks in regression checks.
- **SC-004**: After the customer sends a new inbound WhatsApp message within 24 hours, staff see open-session behaviour (no forced template-only) on the next consistent load of conversation data.

---

## Clarifications

### Session 2026-04-08

Code survey (requested): what exists in the inbox composer today vs what the spec still requires. *Not a technical implementation plan.*

- **Q: Where are messages loaded for `ConversationThread`?** → **A:** The thread does **not** load messages itself. Parents pass a `messages` prop (`InboxMessage[]`). Examples: per-conversation data from the parent’s hooks (e.g. single conversation view) or a unified person-level timeline (e.g. customer view) where the array may mix channels. Any 24-hour rule must use the correct subset of that array (see Edge Cases and FR-010).
- **Q: Where is the Freeform / Template UI?** → **A:** Rendered only when `isTemplateAllowed` is true, which is currently `activeChannel === 'whatsapp'`. Two buttons switch between labels “Freeform” and “Template”; template branch shows template selector and variable inputs.
- **Q: Where is `replyMode` managed?** → **A:** Local React state: `useState<'freeform' | 'template'>('freeform')`. Effects: (1) if the channel is not WhatsApp, force `freeform` and close template UI; (2) if WhatsApp, there is an `activeConversationId`, and `messages.length === 0`, auto-set `template` and open the template picker (empty-thread behaviour). There is **no** 24-hour or last-inbound check today.
- **Q: How is message direction represented?** → **A:** On `InboxMessage`, `direction` is `'inbound' | 'outbound'`. Timestamps for ordering and age checks should use `sent_at` (ISO string) alongside `created_at` where the product already relies on them.
- **Q: What is missing vs this spec?** → **A:** (1) No “session open/closed” derivation from last inbound time; (2) no amber expiry banner; (3) no hiding the Freeform/Template toggle when session is closed; (4) existing `lastInboundMessage` used for suggested replies scans the **entire** `messages` array for the last inbound of **any** channel — **not** the same as “last inbound WhatsApp message in the active WhatsApp conversation”; implementation must add an explicit, scoped rule (see FR-010).

### Functional Requirements (clarified)

- **FR-010**: Session open/closed MUST be computed from messages that belong to the **active WhatsApp reply target** (the conversation id used for WhatsApp send) and have `channel === 'whatsapp'` and `direction === 'inbound'`. Mixed-channel timelines MUST NOT use an inbound message from another channel or another conversation as proof of an open WhatsApp session.

---

## Assumptions

- Message records exposed to the composer include reliable direction (inbound vs outbound) and timestamps suitable for comparing “last inbound” to “now”.
- “Current WhatsApp conversation” for session rules means messages scoped to the **active WhatsApp conversation id** used for sending (see FR-010), including when the parent passes a mixed-channel timeline — not “any inbound in the full array.”
- The 24-hour window follows common WhatsApp Business API interpretation (rolling 24 hours from the last customer inbound message); legal/compliance sign-off is out of scope for this document.
- Staff devices have reasonably accurate clocks; gross clock skew is out of scope.

---

## Dependencies

- Existing approved-template selection and template send flow for WhatsApp (must remain usable when session is closed).
- Existing unified inbox reply composer and message list for the active conversation.
