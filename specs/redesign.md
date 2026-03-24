# Managed WhatsApp Onboarding Redesign (Twilio + Legacy Coexistence)

## Overview

Redesign WhatsApp onboarding for Mason App so customers can connect WhatsApp through a managed flow (no Twilio credentials entered by end users), while preserving the existing manual Twilio credentials flow as a supported legacy/advanced path.

**Context:**
- Existing manual integration already supports inbound webhook -> `inbox_messages` and outbound via `inbox-twilio-send`.
- Prior managed attempt failed due to incorrect sender assumptions, fake connected states, and auth/hydration timing dependencies.
- Product must remain realistic about Twilio/Meta activation requirements and multi-tenant SaaS isolation.

**Goal:**
- Deliver a production-ready architecture and UX spec for managed WhatsApp onboarding that only allows send/receive when provider readiness is verified.
- Keep manual flow working, explicit, and selectable without silent fallback behavior.

---

## Current State Analysis

### Manual WhatsApp Connection Schema

**Table:** `whatsapp_connections` (existing, manual flow)

**Current Structure:**
- Stores user-provided Twilio credentials and WhatsApp sender/from configuration.
- Used by outbound function(s) to send via Twilio using the configured sender.
- Inbound Twilio webhook currently lands in inbox pipeline and produces `inbox_messages`.
- Existing RLS likely scoped by account/workspace ownership (must be preserved).

**Observations:**
- Manual flow is technically functional but operationally complex for non-technical users.
- User-entered credentials increase setup friction and support burden.
- Existing sender config is tied to provided Twilio info; no managed provisioning lifecycle model.

### Inbox Messaging Schema

**Table:** `inbox_messages` and `inbox_conversations`

**Current Structure:**
- `inbox_messages` holds inbound/outbound message records used by inbox UI.
- `inbox_conversations` groups channel threads and supports inbox listing/detail view.
- Message routing currently supports at least email, SMS, and WhatsApp paths.
- Message write path is shared infrastructure that must stay compatible.

**Observations:**
- WhatsApp channel already participates in core inbox architecture.
- Current model lacks explicit managed connection lifecycle metadata in message records.
- Future debugging/audit needs stronger source attribution (managed vs legacy, connection id, sender id).

### Relationship Analysis

**Current Relationship:**
- WhatsApp send/receive flow resolves credentials/sender from manual connection data.
- Inbound webhook data is transformed into inbox records with channel metadata.
- Outbound path depends on available sender configuration and Twilio API success.

**Gaps/Issues:**
- No first-class managed provisioning entity with explicit state machine.
- No strict provider-readiness gating contract tied to connection state.
- Limited auditability for onboarding transitions, provider events, and sender assignment decisions.

### Data Access Patterns

**How Manual WhatsApp Connections are Currently Accessed:**
- Read from profile/settings and outbound message send path.
- Accessed during Twilio send preparation and credential validation.
- Used to derive channel sender/from identifiers.

**How Inbox Data is Currently Accessed:**
- Inbox list/detail fetches by account/workspace and channel filters.
- Conversations/messages queried with chronological ordering and pagination.
- Message status updates consumed for delivery visibility.

**How They Are Queried Together (if at all):**
- Outbound send path links conversation/channel context to connection config.
- Inbound routing maps Twilio payload to a conversation + message insertion flow.
- Relationship exists behaviorally but is not strongly normalized for managed/legacy split.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- Add `whatsapp_managed_connections` table for managed onboarding lifecycle:
  - `id` (uuid, pk)
  - `account_id`/`workspace_id` (tenant owner fk)
  - `status` (enum/text constrained): `draft`, `collecting_business_info`, `provisioning`, `pending_meta_action`, `pending_provider_review`, `ready_to_test`, `connected`, `degraded`, `failed`, `disconnected`
  - `status_reason_code` (nullable text, machine-readable)
  - `status_reason_message` (nullable text, human-readable support text)
  - `provider` (`twilio`)
  - `twilio_account_sid` (managed/provider-side reference, nullable until issued)
  - `twilio_subaccount_sid` (if using per-tenant subaccounts; nullable)
  - `twilio_whatsapp_sender_sid` (critical sender identity, nullable until provisioned)
  - `whatsapp_from_address` (e.g., `whatsapp:+...`, nullable until ready)
  - `meta_business_id` (nullable)
  - `meta_waba_id` (nullable)
  - `display_phone_number` (nullable)
  - `onboarding_started_at`, `ready_at`, `connected_at`, `last_status_sync_at`
  - `created_at`, `updated_at`, `created_by`, `updated_by`
- Add `whatsapp_connection_events` append-only audit table:
  - `id`, `connection_id`, `occurred_at`, `actor_type` (`system`, `user`, `provider_webhook`, `support`)
  - `event_type` (`status_changed`, `provider_sync`, `send_rejected_not_ready`, etc.)
  - `previous_status`, `new_status`
  - `payload` (jsonb, sanitized provider response)
  - `request_id`/`correlation_id` for tracing.
- Add `whatsapp_sender_registry` (optional but recommended if multiple senders per tenant later):
  - `id`, `connection_id`, `twilio_sender_sid`, `from_address`, `is_active`, `activated_at`, `deactivated_at`.
- Add source attribution columns on message/conversation records (or via metadata json):
  - `whatsapp_connection_id` (nullable fk)
  - `whatsapp_connection_mode` (`managed` | `manual`)
  - `whatsapp_sender_sid` (nullable)
  - Keep current schema backward compatible.
- Add indexes:
  - `whatsapp_managed_connections (account_id, status, updated_at desc)`
  - unique active managed connection per tenant rule (partial unique index where status not in terminal disconnected/archive states)
  - `whatsapp_connection_events (connection_id, occurred_at desc)`.

**Non-Destructive Constraints:**
- Do not delete/rename existing `whatsapp_connections` manual table.
- Additive schema only; existing inbox flows remain valid.
- Manual and managed records coexist without shared mutable credential fields.
- RLS enforced by tenant ownership across all new tables.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Runtime channel resolver must explicitly choose one mode:
  - managed: active `whatsapp_managed_connections.status = connected` and valid sender fields.
  - manual: existing manual connection marked usable.
- No implicit fallback: mode selection is explicit per tenant settings (`preferred_whatsapp_mode`) and resolver decision logs.
- Outbound send preflight returns typed result:
  - `ready` + sender metadata, or
  - `not_ready` + status/reason/action_required.

**Recommended Display Patterns:**
- Profile/Channel settings show two cards:
  - Managed WhatsApp (recommended) with lifecycle timeline.
  - Manual Twilio credentials (advanced/legacy).
- Inbox channel badge displays connection health:
  - `Connected`, `Pending Action`, `Provisioning`, `Failed`, `Disconnected`.
- Conversation/message detail includes provider source metadata for support/debug.

---

## Implementation Approach

### Phase 1: Managed Model Foundation
- Define canonical managed state machine and legal transitions.
- Add managed connection + events schema and tenant-safe RLS.
- Build backend resolver contract shared by send and status endpoints.
- Preserve existing manual path untouched except for explicit mode selection integration.

### Phase 2: Provider-Orchestrated Onboarding
- Implement managed onboarding orchestration function(s):
  - initialize managed connection
  - collect required business/profile inputs
  - trigger Twilio/Meta onboarding actions where API-supported
  - capture provider IDs and statuses.
- Implement provider status sync:
  - webhook handlers where available
  - periodic polling for states that are not event-driven.
- Persist every transition/event with correlation ids and visible reason codes.

### Phase 3: Send/Receive Runtime Enforcement
- Outbound logic:
  - resolve tenant mode (`managed` or `manual`) explicitly
  - for managed, reject sends unless status is exactly `connected` and sender identity exists.
- Inbound logic:
  - route by incoming Twilio sender/channel identifiers
  - map deterministically to managed connection or manual connection
  - write source attribution into inbox records.
- Disallow fake success:
  - API must return hard `409 not_ready`/domain error for pending/failed states.

### Phase 4: Frontend UX and Coexistence
- Onboarding wizard states:
  - `Start` -> `Business details` -> `Provider processing` -> `Action required` (if any) -> `Connected`.
- State-specific UX copy and CTAs:
  - `pending_provider_review`: explain waiting and expected timelines
  - `pending_meta_action`: explicit next action with retry/check button
  - `failed`: show reason + recover path
  - `connected`: show sender details and verified timestamp.
- Profile and Inbox surfaces consume backend status only; no optimistic connected rendering.

### Safety Considerations
- `connected` is backend-derived only from persisted provider-verified sender readiness criteria.
- Never infer sender from user phone number; always use Twilio sender SID/from provision data.
- Every send attempt logs resolver decision and failure reason for supportability.
- Keep manual flow fully operational with clear UI separation and no hidden automatic migration.

---

## What NOT to Do

- Do not mark managed connection as connected before Twilio sender exists and is confirmed send-capable.
- Do not assume a user-entered personal/business phone equals WhatsApp sender provisioning output.
- Do not silently fallback from managed to manual (or vice versa) on send failures.
- Do not hide provider-required manual steps (Meta approval, verification, policy review).
- Do not depend on frontend auth/hydration timing to derive connection correctness.
- Do not auto-migrate manual tenants without explicit admin choice and validation.

---

## Open Questions / Considerations

- Twilio account strategy: shared parent account with subaccounts per tenant vs single pooled account with strict sender mapping.
- Which Twilio/Meta onboarding steps are API-automatable in current account tier vs requiring dashboard/user action.
- Whether MVP supports exactly one active managed sender per tenant or allows multiple sender rotation.
- SLA/timeout policy for statuses stuck in provider pending states and escalation workflow.
- Final error taxonomy for send rejection (`not_ready`, `action_required`, `provider_error`, `misconfigured`).

**Provider Reality Clarifications (MVP Contract):**
- Required onboarding typically includes business identity/profile setup and WhatsApp sender provisioning/approval through Twilio + Meta processes.
- Some steps can be API-driven (record creation, status retrieval), while others may require explicit user/provider action and elapsed review time.
- `connected` must mean all are true:
  - a managed connection record exists and is active for tenant
  - Twilio WhatsApp sender SID exists and maps to tenant connection
  - from address is present and verified as usable for messaging channel
  - latest provider sync shows ready/active state (not pending/rejected/suspended)
  - send preflight using resolver returns `ready`.

**Migration & Coexistence Rules (MVP):**
- Manual `whatsapp_connections` remains supported and unchanged for existing customers.
- Tenant-level `preferred_whatsapp_mode` is explicit (`managed` or `manual`) and admin-controlled.
- Resolver behavior:
  - if mode = `managed`, only managed path considered; if not ready, reject with actionable status.
  - if mode = `manual`, use current manual flow.
  - no automatic mode switching at runtime.
- Gradual migration path:
  - opt-in managed onboarding for selected tenants
  - dual visibility in settings
  - manual remains rollback option via explicit toggle.

**Acceptance Criteria (MVP):**
- `Connected` badge appears only when strict connected contract is satisfied.
- Outbound send from managed mode returns domain rejection and no provider call when status != `connected`.
- Outbound send from managed mode uses resolved Twilio sender SID/from address from managed record (never user phone guess).
- Inbound webhook routing maps message to correct tenant/connection using provider identifiers and persists mode/source attribution.
- Manual mode behavior remains backward compatible for existing tenants.
- UI never shows fake instant success; all pending/action-required/failed states are explicit and persisted.
- Non-goals:
  - full automation of all Meta compliance/review steps
  - multi-sender load balancing/advanced routing
  - automatic migration of legacy tenants without admin decision.
