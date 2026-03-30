# Feature Specification: Managed WhatsApp Onboarding

**Feature Branch**: `feature/managed-whatsapp-onboarding`  
**Created**: 2026-03-30  
**Status**: In Progress (partially implemented — see Baseline section)

---

## Baseline: Already Implemented

The following has already been built and must not be regressed:

### Lifecycle States (enforced at DB level)

| State | Meaning |
|-------|---------|
| `collecting_business_info` | Onboarding started; user has not yet submitted details |
| `pending_provider_review` | Business details submitted; awaiting real provider readiness |
| `connected` | Provider-confirmed; sender identity verified; fully operational |
| `action_required` | Provider needs additional input from user |
| `failed` | Terminal failure; user must restart |
| `disconnected` | User-initiated disconnect |
| `error` | Unexpected error state |
| `not_connected` | Initial/reset state |
| `requested` | Provisioning request sent to provider |
| `provisioning` | Provider is actively provisioning the number |

### Strict Connected Criteria (MUST NEVER be weakened)

A managed WhatsApp connection is **only** considered truly connected when **all** of the following are simultaneously true:

1. `state = 'connected'`
2. `provider_ready = true`
3. `platform_twilio_account_sid IS NOT NULL`
4. At least one sender identity present: `twilio_sender IS NOT NULL` OR `display_number IS NOT NULL`

Any UI, send-path, or inbound-routing logic that gates on "is connected" MUST evaluate all four conditions. Partial matches (e.g. `state = connected` alone) MUST NOT be treated as connected.

### Implemented Backend Components

- **`whatsapp-managed-start`** — creates or reuses a managed row; sets `state = collecting_business_info`
- **`whatsapp-managed-submit-business`** — transitions row to `pending_provider_review`; stores business details; idempotent
- **`whatsapp-managed-status`** — returns current row state for the authenticated user
- **`whatsapp-managed-provider-webhook`** — internal webhook (auth via `x-provider-token`); transitions row to `connected` when `provider_confirmed = true` and sender/account identity fields are present; validates Twilio signature for real provider traffic
- **`twilio-sms-webhook`** — only resolves managed ownership when `state = connected AND provider_ready = true AND sender identity matches`; pending rows are ignored
- **`inbox-twilio-send`** — blocks managed send unless connection satisfies all four connected criteria
- **`_shared/whatsappManagedStatus.ts`** — shared connected-criteria evaluation helper
- **`_shared/whatsappRoutingResolver.ts`** — deterministic routing between managed and manual paths; no silent fallback
- **`_shared/twilioSignature.ts`** — Twilio webhook signature verification helper
- **`_shared/whatsappConnectionEvents.ts`** — event logging for managed lifecycle transitions

### Implemented Frontend Components

- **`WhatsAppConnectionStatus`** component: displays current state; UI `Connected` label requires all four backend-derived criteria; pending states display as pending, not connected

### Database

- **`whatsapp_managed_connections`** table with columns: `id`, `user_id`, `provider`, `platform_twilio_account_sid` (nullable), `twilio_sender` (nullable), `display_number` (nullable), `label`, `state`, `last_error`, `meta`, `last_state_change_at`, `connected_at`, `disconnected_at`, `created_at`, `updated_at`, `provider_ready`
- RLS enabled; ownership via `user_id = (select auth.uid())`
- Unique partial constraints on `(platform_twilio_account_sid, twilio_sender)` and `(platform_twilio_account_sid, display_number)`
- `whatsapp_connection_events` table for lifecycle audit trail (service-role inserts only)

### What Is Currently Simulated (Not Yet Production-Complete)

- Real Twilio provisioning is not wired end-to-end; `connected` transition is currently triggered via internal provider webhook call (simulated with `x-provider-token` + `provider_confirmed: true`)
- No automated provider polling or status sync beyond the webhook trigger
- Inbound routing in staging depends on stored test sender identity values matching webhook data exactly
- No polished retry / `action_required` recovery UX
- No multi-number or multi-managed-connection support (one active managed connection per user)

---

## User Scenarios & Testing

### User Story 1 — Complete Onboarding Without Knowing Twilio (Priority: P1)

A staff member at a masonry business opens the WhatsApp settings area. They want to connect WhatsApp for their business without being asked for Twilio credentials. They go through a guided modal flow: start onboarding, fill in their business name, email, and phone number, then see a clear "pending review" screen. They know exactly where they are in the process and what to do next.

**Why this priority**: This is the core value proposition of the managed flow — hiding provider complexity. Without a clear guided modal, the feature is not meaningfully better than the existing manual flow.

**Independent Test**: A user can open the WhatsApp connection settings, start onboarding, submit their business details, and land on a "Pending Provider Review" screen — all without entering any Twilio credentials.

**Acceptance Scenarios**:

1. **Given** the user has no existing managed connection, **When** they click "Connect via Managed WhatsApp", **Then** a step-modal opens showing Step 1 (Start).
2. **Given** the modal is on Step 1, **When** the user confirms, **Then** a managed connection row is created with `state = collecting_business_info` and the modal advances to Step 2 (Business Details form).
3. **Given** the modal is on Step 2, **When** the user submits valid business name, email, and phone, **Then** the row transitions to `pending_provider_review` and the modal shows a clear "Pending Provider Review" holding screen.
4. **Given** the modal is on Step 2, **When** the user submits an incomplete form (missing required field), **Then** an inline validation error is shown and the form does not submit.
5. **Given** the user is on the "Pending Provider Review" screen, **When** they close and reopen the modal (via the "View pending status" dropdown item), **Then** it reopens directly on the pending screen (not step 1), reflecting the real current state.

---

### User Story 2 — Connected State Reflects Backend Truth (Priority: P1)

Once the provider-ready webhook fires and all four connected criteria are satisfied, the UI automatically shows "Connected" in the WhatsApp settings area. Until that moment the UI never shows "Connected" regardless of what partial data exists in the row.

**Why this priority**: Showing a false "Connected" state is a trust-breaking bug. This is co-equal with the onboarding UX story because it defines what "done" means.

**Independent Test**: With a row in `pending_provider_review`, the UI must show "Pending Review" and not "Connected". After the provider webhook fires with all four criteria satisfied, the UI must update to "Connected" without a page reload.

**Acceptance Scenarios**:

1. **Given** `state = pending_provider_review` and `provider_ready = false`, **When** the user views the connection status, **Then** the UI shows "Pending Provider Review", not "Connected".
2. **Given** `state = connected` but `provider_ready = false` (partial/stale row), **When** the user views the connection status, **Then** the UI does NOT show "Connected".
3. **Given** all four connected criteria are satisfied, **When** the page or component re-fetches state, **Then** the UI shows "Connected" with the configured display number or sender identity.
4. **Given** a truly connected row, **When** the user sends a WhatsApp message from the inbox, **Then** the send succeeds and routes via the managed connection.
5. **Given** a pending row, **When** any outbound send is attempted via the managed path, **Then** the send is blocked and a clear error is returned.

---

### User Story 3 — Re-entry and Resilience (Priority: P2)

A user who started onboarding, closed the browser, and returned later can resume cleanly. The modal correctly detects the existing row state and renders the right step. Users in `action_required` or `failed` states see a clear explanation and a recovery action (retry or restart).

**Why this priority**: Onboarding processes are frequently interrupted. Without correct re-entry, users get stuck or confused about whether to start again.

**Independent Test**: With an existing row in each state (`collecting_business_info`, `pending_provider_review`, `action_required`, `failed`), opening the connection settings modal must render the appropriate step or recovery screen without showing incorrect state.

**Acceptance Scenarios**:

1. **Given** an existing row with `state = collecting_business_info`, **When** the user opens the modal, **Then** it opens on the Business Details form (Step 2), not Step 1.
2. **Given** an existing row with `state = pending_provider_review`, **When** the user opens the modal, **Then** it opens on the pending holding screen.
3. **Given** an existing row with `state = action_required`, **When** the user opens the modal, **Then** they see the `status_reason_message` from the backend alongside the business details form pre-populated with their previously submitted values; submitting the corrected form re-uses the existing idempotent submit flow.
4. **Given** an existing row with `state = failed`, **When** the user opens the modal, **Then** they see a failure explanation and a "Start Over" option that resets the flow.
5. **Given** a fully connected row, **When** the user opens the modal (via the "Manage connection" dropdown item), **Then** they see a connected summary screen showing the display number or sender identity and a "Disconnect" button — no health metrics or activity history.

---

### User Story 4 — Legacy Manual Flow Remains Untouched (Priority: P1)

Users who connected WhatsApp via the original manual flow (entering Twilio credentials directly) continue to work exactly as before. The managed onboarding flow is additive and does not interfere with existing manual connections.

**Why this priority**: Regression risk. There are existing users on the manual path and breaking them is unacceptable.

**Independent Test**: An existing manual `whatsapp_connections` row must remain usable for inbound and outbound messaging after any managed onboarding code changes are deployed.

**Acceptance Scenarios**:

1. **Given** a valid manual `whatsapp_connections` row and no managed connection, **When** an inbound WhatsApp message arrives, **Then** it routes correctly to the manual connection owner.
2. **Given** both a manual connection and a pending (non-connected) managed row, **When** an outbound message is sent, **Then** it routes via the manual connection without error.
3. **Given** both a manual connection and a fully connected managed connection, **When** the inbox send routing resolves the connection, **Then** managed takes priority in a deterministic, non-silent way (explicit preference or order, not random fallback).

---

### Edge Cases

- What happens when the provider webhook fires for an unknown `connection_id`? The webhook returns a 404-equivalent error; no new row is created.
- What happens when `platform_twilio_account_sid` is already present on a row that is still in `pending_provider_review`? The connected transition still requires `provider_confirmed = true`; presence of the field alone does not change state.
- What happens if two managed rows exist for the same user (data integrity issue)? Ownership resolution must be deterministic and must not silently pick an arbitrary row; a logging warning is emitted.
- What happens when the user submits business details while their row is already in `pending_provider_review`? The submit is idempotent; no error, no duplicate state change.
- What happens when a user disconnects a managed connection? The row `state` is set to `disconnected` (soft disconnect — row is never deleted); outbound and inbound routing immediately stops using it; the modal transitions to show a "Disconnected" screen with a "Start new onboarding" option. The row is preserved for audit history.

---

## Requirements

### Functional Requirements

- **FR-001**: The onboarding flow MUST be presented as a step-by-step modal, triggered from a menu item in the existing top-bar WhatsApp dropdown button, that guides users through: (1) start, (2) business details form, (3) pending holding screen. The two current separate inline dialogs inside the dropdown MUST be replaced by this single modal component.
- **FR-002**: The modal MUST detect the existing connection row state on open and resume at the correct step rather than always showing Step 1. The modal MUST NOT auto-open on page load; it opens only when the user explicitly selects the context-appropriate dropdown menu item (e.g. "Resume onboarding", "View pending status", "Connect managed").
- **FR-003**: The Business Details form MUST require at minimum: business name, contact email, and contact phone number. Submission MUST be blocked until all required fields are valid.
- **FR-004**: After successful business details submission, the UI MUST show a "Pending Provider Review" holding screen with a clear message that no further user action is required at this stage.
- **FR-005**: The connection status display MUST evaluate all four connected criteria (state, provider_ready, account SID, sender identity) before rendering "Connected". Partial matches MUST NOT render as "Connected".
- **FR-006**: The status display MUST poll or react to state changes so that when provider-ready confirmation arrives, the UI updates to "Connected" without requiring a full page reload.
- **FR-007**: Outbound messaging via the managed path MUST be blocked (with a clear error) unless all four connected criteria are satisfied.
- **FR-008**: Inbound message routing MUST only resolve managed ownership for rows where `state = connected`, `provider_ready = true`, and sender identity matches.
- **FR-009**: The `action_required` state MUST render a distinct screen in the modal that: (1) displays the `status_reason_message` returned by the backend, and (2) presents the business details form pre-populated with previously submitted values so the user can correct and re-submit using the existing idempotent submit flow. The `failed` state MUST render a distinct screen with a human-readable explanation and a "Start Over" option that resets to `collecting_business_info`.
- **FR-013**: The `connected` state MUST render a dedicated summary screen inside the modal showing: (1) the display number or sender identity (whichever is available), and (2) a "Disconnect" button. No health metrics or activity history are required in this iteration.
- **FR-010**: The legacy manual WhatsApp connection flow (`whatsapp_connections` table) MUST remain fully functional regardless of whether a managed connection exists for the same user.
- **FR-011**: Routing between managed and manual paths MUST be deterministic and explicit; silent fallback between the two paths is prohibited.
- **FR-012**: The `whatsapp-managed-provider-webhook` function MUST require `x-provider-token` header authentication for internal simulation paths; real provider traffic MUST additionally pass Twilio signature verification.

### Architectural Constraints

- **AC-001**: Feature code MUST live in `src/modules/inbox/` (WhatsApp connection UI) and follow the module conventions in the project constitution; no cross-module deep imports.
- **AC-002**: RLS MUST remain the authorization boundary for all user-data reads; the UI must never rely on client-side checks as the security gate.
- **AC-003**: The managed flow MUST NOT alter or remove columns from `whatsapp_connections` (legacy manual table). Any schema changes must be additive.
- **AC-004**: The four-criteria connected rule (state + provider_ready + account SID + sender identity) is a project invariant and MUST be evaluated via the shared `whatsappManagedStatus.ts` helper, not re-implemented inline.
- **AC-005**: The `whatsapp-managed-provider-webhook` function MUST NOT accept `Authorization: Bearer` JWTs from end users; it is an internal/provider endpoint only.

### Key Entities

- **ManagedWhatsAppConnection**: Represents one managed WhatsApp onboarding attempt per user. Key attributes: connection ID, user ID, lifecycle state, provider readiness flag, display number, Twilio account SID, Twilio sender identity, business metadata, event timestamps.
- **WhatsAppConnectionEvent**: Audit log entry for each lifecycle state transition. Key attributes: connection ID, user ID, event type, previous state, new state, timestamp.
- **ManualWhatsAppConnection** (existing, read-only from this feature's perspective): Legacy per-user Twilio credential record. Must remain unchanged.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new staff user can start and complete the managed WhatsApp onboarding form in under 3 minutes from clicking "Connect".
- **SC-002**: When a user returns to a partially completed onboarding, the modal correctly shows the current step (not Step 1) 100% of the time across all defined states.
- **SC-003**: "Connected" status is never displayed in the UI when any of the four connected criteria is not satisfied — zero false-positive connected states in any manual or automated test.
- **SC-004**: After the provider-ready webhook fires, the UI reflects the connected state within one refresh cycle (no manual page reload required).
- **SC-005**: Outbound messaging attempts via a pending managed connection are blocked 100% of the time with a user-visible explanation.
- **SC-006**: Existing users on the manual WhatsApp flow experience zero regressions in message delivery (inbound and outbound) after these changes are deployed.
- **SC-007**: Users in `action_required` or `failed` state can identify and action the recovery path without external help (self-service recovery).

---

## Clarifications

### Session 2026-03-30

- Q: Where/how is the managed onboarding modal triggered? → A: The existing top-bar WhatsApp dropdown button stays as the entry point. Clicking "Connect managed" / "Resume onboarding" from the dropdown menu opens a new single multi-step modal. The two current separate raw Dialog components embedded inside the dropdown are replaced by that single multi-step modal component.
- Q: When returning to an in-progress onboarding, should the modal open automatically on page load or only on explicit user action? → A: Passive re-entry only. The dropdown status label reflects the current state (e.g. "Collecting business info", "Pending provider review"). A context-appropriate menu item ("Resume onboarding" / "View pending status") opens the modal at the correct step when the user explicitly clicks it. No auto-open on page load.
- Q: What should the connected managed summary screen show inside the modal? → A: Display number (or sender identity if no display number) + a "Disconnect" button. Simple confirmation only — no health metrics or activity timestamps in this iteration.
- Q: When the user disconnects a managed connection, what happens to the managed row? → A: Soft disconnect — `state` is set to `disconnected`; the row is preserved for audit history. After disconnecting, the user can start a fresh onboarding (the start function's idempotency logic handles creating or reusing a row). No hard delete.
- Q: For the `action_required` state, what recovery action should the modal offer? → A: Show the `status_reason_message` from the backend alongside the business details form pre-populated with any previously submitted values, allowing the user to correct and re-submit. The existing idempotent `whatsapp-managed-submit-business` flow handles the re-submission. No external URL navigation required.

## Assumptions

- One active managed connection per user is the current design limit; multi-number support is deferred.
- Real Twilio provisioning end-to-end (replacing the simulated provider webhook) is out of scope for this spec iteration; the next goal is UX polish with the existing backend in place.
- Users access the onboarding from the existing Inbox / Channel Connections area of the dashboard.
- The app is always staff-facing (no end-customer-facing WhatsApp setup).
- The `WHATSAPP_MANAGED_PROVIDER_WEBHOOK_TOKEN` secret is already configured in the Supabase project environment.
- Disconnect is a soft operation: `state` set to `disconnected`, row preserved. After disconnect the modal shows a "Disconnected" screen with a "Start new onboarding" option that triggers the start flow. The start function's idempotency logic handles row reuse or creation.
- No email/SMS notification to the user when provider-ready confirmation arrives is required for this iteration; UI polling/re-fetch is sufficient.
