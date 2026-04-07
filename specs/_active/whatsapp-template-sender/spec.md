# Feature Specification: WhatsApp Template Sender

**Feature Branch**: `feature/whatsapp-template-sender`  
**Created**: 2026-03-31  
**Status**: Draft

---

## User Scenarios & Testing

### User Story 1 - Choose Send Mode in WhatsApp Reply (Priority: P1)

A staff user replying on a WhatsApp conversation can switch between freeform mode and template mode using a clear manual toggle in the reply area.

**Why this priority**: The team must control whether they send a normal freeform reply or a business-initiated template when the 24-hour window is closed.

**Independent Test**: Open a WhatsApp conversation and confirm the user can switch reply mode without leaving the conversation.

**Acceptance Scenarios**:

1. **Given** the selected channel is WhatsApp, **When** the staff user opens the reply area, **Then** they can see and use a mode switch between freeform and template mode.
2. **Given** the selected channel is not WhatsApp, **When** the reply area is shown, **Then** template mode controls are not shown.
3. **Given** the user switches modes, **When** they return to freeform mode, **Then** freeform send behavior remains unchanged.

---

### User Story 2 - Select Approved Template and Edit Variables (Priority: P1)

In template mode, staff can choose from approved WhatsApp templates and edit variable values that are pre-filled from current context before sending.

**Why this priority**: Templates are only useful if staff can quickly select the correct one and verify/edit placeholders before send.

**Independent Test**: In template mode, staff can choose a template, review pre-filled values, edit values, and prepare a valid outbound template send payload.

**Acceptance Scenarios**:

1. **Given** template mode is active, **When** template data loads, **Then** only approved templates are available for selection.
2. **Given** a template is selected, **When** the variable form is shown, **Then** fields are pre-filled from conversation/order/user context where data exists.
3. **Given** staff edits variable fields, **When** they submit, **Then** edited values are used instead of defaults.
4. **Given** required variables are missing, **When** user attempts send, **Then** send is blocked with a clear validation message.

---

### User Story 3 - Send Template Through Existing WhatsApp Send Flow (Priority: P1)

When template mode is used, the message is sent through the existing send pathway using template identifier (`contentSid`) and variables, and the sent message appears in conversation history like other outbound messages.

**Why this priority**: The feature must solve failed business-initiated sends while preserving existing inbox visibility and workflow consistency.

**Independent Test**: Send a template message and verify it appears as a normal outbound message in the active conversation thread.

**Acceptance Scenarios**:

1. **Given** template mode with valid template and variables, **When** user sends, **Then** the outbound send request uses template fields rather than freeform message text.
2. **Given** send succeeds, **When** thread refreshes, **Then** the outbound message is visible in conversation history.
3. **Given** send fails, **When** error is returned, **Then** user sees a clear reason and can retry after correction.

---

### Edge Cases

- Template list cannot be loaded (provider/API temporary failure): template mode remains unavailable and freeform mode remains usable.
- Approved template exists but context has missing values for one or more variables: user can manually fill values before sending.
- Template becomes unavailable after being selected: send is blocked with a recoverable error and user can reselect a template.
- Channel is switched away from WhatsApp while in template mode: template UI is hidden and no template payload is sent.

---

## Requirements

### Functional Requirements

- **FR-001**: The reply area for WhatsApp conversations MUST provide a manual mode switch between freeform and template mode.
- **FR-002**: Template mode MUST only be available when WhatsApp is the selected reply channel.
- **FR-003**: Template mode MUST present a selectable list of approved WhatsApp templates via server-mediated fetch from a Supabase edge function (`fetch-whatsapp-templates`) that calls Twilio Content API each time the template selector is opened.
- **FR-004**: After template selection, the UI MUST display all template variables with editable inputs.
- **FR-005**: Variable inputs MUST be pre-filled from available conversation/order/staff context where possible; for now, staff name variable `{{2}}` MUST use the authenticated user's email value.
- **FR-006**: Staff MUST be able to edit any pre-filled variable before sending.
- **FR-007**: Template send MUST be blocked when required template inputs are missing or invalid, with user-visible validation. Required variables are all `{{N}}` placeholders found in the selected template body; validation fails if any mapped value is empty or whitespace-only.
- **FR-007**: Template send MUST be blocked when required template inputs are missing or invalid, with user-visible validation. Required variables are all `{{N}}` placeholders found in the selected template body; validation fails if any mapped value is empty or whitespace-only. If template body is absent or unparseable, template send MUST be blocked and a reload error shown.
- **FR-008**: On template send, outbound request handling MUST use template identifier (`contentSid`) and variable payload instead of freeform body text.
- **FR-009**: Existing freeform send behavior MUST remain unchanged when freeform mode is selected.
- **FR-010**: Successfully sent template messages MUST appear in the same conversation timeline as normal outbound messages, with the fully rendered template text stored as the message body in `inbox_messages`.
- **FR-011**: Failures from template sends MUST be surfaced as clear, actionable errors without breaking the active conversation view.
- **FR-012**: The send backend flow MUST accept both freeform payloads and template payloads for WhatsApp sends.
- **FR-013**: No new database tables or migrations are required for this feature; implementation MUST be additive and preserve existing freeform send behavior.

### Key Entities

- **WhatsApp Template**: Approved outbound message definition with stable identifier, display name, status, and variable schema.
- **Template Variable Set**: Key-value inputs for a selected template, pre-populated from current context and editable by staff.
- **Outbound WhatsApp Send Request**: A request that can be either freeform text or template-driven payload for a conversation.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Staff can switch between freeform and template mode in one action from the WhatsApp reply area.
- **SC-002**: 100% of template sends use template payload fields (`contentSid` + variables) instead of freeform text.
- **SC-003**: Template messages sent successfully are visible in conversation history within the same refresh cycle as other outbound messages.
- **SC-004**: Freeform WhatsApp sending continues to work with no regression for existing users.
- **SC-005**: Staff can complete a template send (select template, edit variables, send) in under 60 seconds for standard order updates.

---

## Clarifications

### Session 2026-03-31

- Q: What should be used for staff name variable `{{2}}` in template mode? → A: Use the authenticated user's email for now.
- Q: How should sent template messages be stored in `inbox_messages`? → A: Store the fully rendered template text as the message body, same pattern as freeform messages.
- Q: When should approved templates be fetched for the selector? → A: Fetch live from Twilio Content API each time the template selector opens.
- Q: Is a contract gap checklist needed before planning? → A: No, proceed with these clarification answers.
- Q: Are schema changes required? → A: No new database tables or migrations; keep changes additive and do not break freeform sending.
- Q: What is the template fetch boundary? → A: Server-mediated only via `fetch-whatsapp-templates` edge function; frontend does not call Twilio Content API directly.
- Q: How are required template variables identified? → A: Treat all `{{N}}` placeholders in template body as required; empty/whitespace values fail validation.

---

## Assumptions

- There is at least one approved template available for the workspace (`order_update` currently approved).
- The current inbox context can provide at least partial defaults for common variables (for example customer/staff names), and staff can complete missing values manually.
- Conversation history already supports rendering outbound WhatsApp sends created by the existing send flow.
- Template mode is an additive path and does not replace freeform mode.
