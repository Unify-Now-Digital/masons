# Feature Specification: Delete Organization and Bulk Inbox Delete

**Feature Branch**: `005-delete-org-bulk-inbox`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: User description: "Feature: Delete organization + bulk delete inbox conversations"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete an organization as admin (Priority: P1)

An organization admin deletes the currently selected organization from Settings by confirming with the exact organization name.

**Why this priority**: This is the highest-risk destructive action and must be controlled and predictable before broader inbox cleanup enhancements.

**Independent Test**: Can be fully tested by creating a test organization with sample data, deleting it from Settings, and verifying data removal and post-delete access behavior.

**Acceptance Scenarios**:

1. **Given** the signed-in user is an admin of the selected organization, **When** they initiate delete and type the exact organization name, **Then** the organization and all organization-scoped data are permanently removed.
2. **Given** the signed-in user is an admin with memberships in multiple organizations, **When** they delete the currently active organization, **Then** their active organization switches to another membership automatically.
3. **Given** the signed-in user is an admin with only one organization membership, **When** they delete that organization, **Then** they are shown the onboarding state ("Welcome to Mason") and no stale organization remains selected.
4. **Given** the signed-in user is not an admin, **When** they view Settings, **Then** they cannot perform organization deletion.

---

### User Story 2 - Bulk delete inbox conversations (Priority: P2)

An inbox user selects multiple conversations and deletes them in one action with explicit confirmation.

**Why this priority**: Inbox cleanup is frequent operational work and directly affects day-to-day usability, but has lower systemic risk than org deletion.

**Independent Test**: Can be fully tested by selecting multiple conversations across channels, confirming deletion, and verifying conversation and message records are removed and UI selection state resets.

**Acceptance Scenarios**:

1. **Given** the inbox list has conversations across channels, **When** the user selects 1 to 50 conversations and confirms deletion, **Then** the selected conversations and their messages are permanently removed.
2. **Given** one or more conversations are selected, **When** the user opens the delete confirmation, **Then** the dialog clearly states the selected count and irreversible impact.
3. **Given** deletion succeeds, **When** the list refreshes, **Then** all deleted conversations are absent and selection is cleared.
4. **Given** the user attempts to select more than 50 conversations, **When** selection reaches the limit, **Then** additional selection is blocked with clear feedback.

---

### User Story 3 - Safe destructive action feedback (Priority: P3)

A user receives clear validation and error handling during destructive actions so they understand why an operation failed or was blocked.

**Why this priority**: Clear guardrails and feedback reduce accidental loss and support load, but rely on core delete capabilities being present first.

**Independent Test**: Can be fully tested by attempting deletion with invalid confirmation text, insufficient permissions, and transient failures to verify user-visible outcomes.

**Acceptance Scenarios**:

1. **Given** organization delete confirmation text does not exactly match the current organization name, **When** the user submits, **Then** deletion is blocked and guidance is shown.
2. **Given** a delete request fails due to authorization or data constraint errors, **When** the request returns, **Then** the user sees a clear failure message and no partial UI state is kept.

---

### Edge Cases

- Organization name confirmation must be exact after trimming leading and trailing whitespace.
- If the active organization is deleted while another tab/session is open, the next membership refresh must move the user to a valid organization or onboarding state.
- If deletion partially succeeds at the data layer, the operation must be treated as failed and surfaced as an error; the user must never see a false-success message.
- Bulk delete with mixed channels (email, SMS, WhatsApp) must apply identical behavior and confirmation language.
- If selected conversations include one currently open in the thread pane, the thread pane must reset to a safe empty or next-valid selection state.
- If the list changes during selection (realtime updates), only currently selected valid IDs are deleted.

## Requirements *(mandatory)*

### Current State

- Settings currently supports organization creation and member management, but no organization deletion action.
- Organization membership and active organization are resolved through `OrganizationContext`; users with no memberships are shown onboarding.
- Inbox currently supports selection and deletion, but deletion trigger/confirmation behavior is lightweight and selection limits are not enforced.
- Conversation deletion currently removes messages and conversations in sequence, but user experience for bounded bulk operations (max 50) is not explicitly defined.

### Proposed Changes

- Add admin-only organization deletion on Settings with explicit name-confirmation modal.
- Add bounded bulk delete in Inbox with selection cap, explicit irreversible confirmation text, and deterministic post-delete reset behavior.

### Functional Requirements

- **FR-001**: System MUST provide an organization deletion action on Settings that is visible only to admins of the active organization.
- **FR-002**: System MUST require the user to type the exact active organization name before enabling final organization deletion.
- **FR-003**: System MUST perform hard deletion of the organization and all organization-scoped dependent records.
- **FR-004**: System MUST allow deleting an organization even when it is the user’s only organization.
- **FR-005**: System MUST remove organization access for all former members as soon as membership data is re-evaluated (no notification required).
- **FR-006**: After organization deletion, system MUST automatically activate another remaining organization membership when available.
- **FR-007**: After organization deletion, if no memberships remain, system MUST route user state to onboarding ("Welcome to Mason") without manual refresh.
- **FR-008**: Inbox MUST support multi-select conversation deletion across email, SMS, and WhatsApp channels.
- **FR-009**: Inbox MUST enforce a maximum of 50 selected conversations for a single delete operation.
- **FR-010**: Inbox delete action MUST appear only when at least one conversation is selected.
- **FR-011**: Inbox delete confirmation MUST state the count in the form "Delete X conversations? This cannot be undone."
- **FR-012**: Bulk delete MUST hard delete selected conversations and their associated messages.
- **FR-013**: After successful bulk delete, system MUST clear all selection state and refresh the inbox list.
- **FR-014**: System MUST return actionable error feedback when delete operations fail and MUST keep data unchanged on failure.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation/routing MUST preserve the coexistence of `src/app/` and `src/pages/`, or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live in `src/modules/<feature>/` and MUST NOT deep-import other features’ internals; shared functionality MUST be promoted into `src/shared/`.
- **AC-003 (RLS as boundary)**: Authorization MUST be enforced in the database via RLS; UI checks are not security.
- **AC-004 (Destructive operation safety)**: Organization deletion and inbox bulk deletion MUST execute atomically from the user perspective and must not report success unless all required deletions complete.

### Key Entities *(include if feature involves data)*

- **Organization**: Tenant workspace with unique name and membership set; deleting it removes all tenant-scoped records.
- **Organization Membership**: User-to-organization role mapping used to authorize admin-only destructive actions and determine post-delete access.
- **Inbox Conversation**: Thread-level communication record, selectable in bulk delete, with channel and summary metadata.
- **Inbox Message**: Message-level records linked to conversations; must be removed when parent conversations are deleted.
- **Deletion Confirmation Intent**: User-provided confirmation input and selected IDs used to validate destructive intent before execution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of organization delete attempts without exact name confirmation are blocked before data deletion starts.
- **SC-002**: 100% of successful organization deletions result in either (a) automatic switch to a remaining organization or (b) onboarding state, with no dead-end state.
- **SC-003**: 100% of successful bulk deletes remove both selected conversations and associated messages from subsequent inbox queries.
- **SC-004**: 100% of delete operations selecting more than 50 conversations are blocked before submission.
- **SC-005**: At least 95% of tested users can complete a valid bulk delete flow (select, confirm, complete) in under 20 seconds in usability validation.

## Assumptions

- Existing organization-scoped data model already supports full hard-delete behavior through existing relational constraints or an explicit deletion workflow.
- Existing inbox permissions remain organization-scoped and continue to apply equally across email, SMS, and WhatsApp conversations.
- "Next login" access loss for removed members includes current-session membership refresh behavior that occurs during normal app usage.
- No user-facing notification channel is required for members who lose access due to organization deletion.
- Existing onboarding state ("Welcome to Mason") remains the fallback when no organization membership exists.
