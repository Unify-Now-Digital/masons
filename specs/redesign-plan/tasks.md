# Tasks — Managed WhatsApp Onboarding Redesign

Reference: `../redesign.md`, `../redesign-implementation-plan.md`

---

## Phase 1 — Schema, RLS, and migration safety

### 1.1 Add managed connection table [ ]
**Create:** `supabase/migrations/YYYYMMDDHHmmss_create_whatsapp_managed_connections.sql`
- Create `public.whatsapp_managed_connections` with lifecycle statuses from spec.
- Add indexes for tenant status views and sender-identity routing.
- Add partial unique constraint for active managed connection per tenant.
- Enable RLS and tenant-scoped policies.

### 1.2 Add managed event log table [ ]
**Create:** `supabase/migrations/YYYYMMDDHHmmss_create_whatsapp_connection_events.sql`
- Create append-only event table.
- Add indexes for timeline/debug queries.
- Add insert/select policies appropriate for service-role + tenant visibility.

### 1.3 Add inbox source attribution fields [ ]
**Create:** `supabase/migrations/YYYYMMDDHHmmss_add_whatsapp_source_fields_to_inbox.sql`
- Add `whatsapp_connection_mode` + managed connection sender attribution columns to `inbox_messages` and `inbox_conversations`.
- Keep columns nullable and backward-compatible.

### 1.4 Add tenant mode preference [ ]
**Create:** `supabase/migrations/YYYYMMDDHHmmss_add_preferred_whatsapp_mode.sql`
- Add `preferred_whatsapp_mode` (`manual|managed`) with default `manual`.
- Ensure no existing tenant behavior changes on deploy.

### 1.5 Migration verification gate [ ]
- Validate migrations are additive only (no drops/renames).
- Validate existing `whatsapp_connections` table and manual paths remain untouched.

---

## Phase 2 — Shared resolver and backend contracts

### 2.1 Add resolver shared module [ ]
**Create:** `supabase/functions/_shared/whatsappRoutingResolver.ts`
- Resolve tenant mode from preference.
- Resolve active manual/managed connection record for mode.
- Return typed readiness (`ready` or structured `not_ready`).
- Explicitly forbid fallback to the other mode.

### 2.2 Add managed status mapping helper [ ]
**Create:** `supabase/functions/_shared/whatsappManagedStatus.ts`
- Normalize provider payload into internal lifecycle statuses.
- Implement connected invariant checks.

### 2.3 Add event logger helper [ ]
**Create:** `supabase/functions/_shared/whatsappConnectionEvents.ts`
- Centralized append-only event writing with correlation ids.

---

## Phase 3 — Managed onboarding + status functions

### 3.1 Create onboarding start function [ ]
**Create:** `supabase/functions/whatsapp-managed-start/index.ts`
- Authenticated start/resume endpoint.
- Create managed row in `collecting_business_info` when absent.

### 3.2 Create onboarding submission function [ ]
**Create:** `supabase/functions/whatsapp-managed-submit-business/index.ts`
- Validate required inputs.
- Trigger Twilio/Meta onboarding calls where supported.
- Move state to `provisioning` or `pending_provider_review`.

### 3.3 Create status read function [ ]
**Create:** `supabase/functions/whatsapp-managed-status/index.ts`
- Return authoritative status payload for frontend.
- Include action_required flags and reason codes.

### 3.4 Create provider sync function [ ]
**Create:** `supabase/functions/whatsapp-managed-sync/index.ts`
- Service-role/scheduled sync endpoint.
- Poll provider state and transition statuses.

### 3.5 Create provider webhook function [ ]
**Create:** `supabase/functions/whatsapp-managed-provider-webhook/index.ts`
- Validate provider signatures.
- Process idempotent state updates into managed tables and events.

---

## Phase 4 — Runtime routing and send/receive enforcement

### 4.1 Modify outbound send routing [ ]
**Modify:** `supabase/functions/inbox-twilio-send/index.ts`
- Use resolver for explicit mode.
- `managed`: send only when resolved managed status is `connected`.
- Return clear `409 managed_whatsapp_not_ready` for non-ready managed states.
- Never fallback to manual when mode is managed.
- Persist source attribution columns on message inserts.

### 4.2 Modify inbound webhook routing [ ]
**Modify:** `supabase/functions/twilio-sms-webhook/index.ts`
- Resolve owner by provisioned sender identity:
  - managed sender SID/from mapping
  - manual existing mapping
- Persist mode + connection attribution on inserts.
- Keep no-match behavior as `200` with no write.

### 4.3 Harden manual connect/test behavior [ ]
**Modify:** `supabase/functions/whatsapp-connect/index.ts`, `supabase/functions/whatsapp-test/index.ts`
- Ensure these remain manual-mode specific.
- Prevent accidental writes to managed tables from manual endpoints.

---

## Phase 5 — Frontend managed UX + coexistence

### 5.1 Managed API client layer [ ]
**Create:** `src/modules/inbox/api/whatsappManaged.api.ts`
- Typed calls: start, submit business, status, refresh.

### 5.2 Managed hooks [ ]
**Create:** `src/modules/inbox/hooks/useWhatsAppManagedStatus.ts`
**Create:** `src/modules/inbox/hooks/useWhatsAppManagedOnboarding.ts`
- Polling/refetch strategy for pending states.
- Surface action-required and failed details.

### 5.3 Managed onboarding UI [ ]
**Create:** `src/modules/inbox/components/whatsapp-managed/WhatsAppManagedOnboardingPanel.tsx`
**Create:** `src/modules/inbox/components/whatsapp-managed/WhatsAppManagedStatusBadge.tsx`
- States: `start`, `provisioning`, `pending_provider_review`, `action_required`, `failed`, `connected`.
- No optimistic connected state.

### 5.4 Keep manual UI separate [ ]
**Modify:** `src/modules/inbox/components/WhatsAppConnectionStatus.tsx`
**Modify:** `src/modules/inbox/components/ChannelConnectionsCard.tsx`
- Render clear separation of manual vs managed.
- Show current mode and explicit mode switch control.

### 5.5 Profile/inbox wiring [ ]
**Modify:** `src/app/layout/DashboardLayout.tsx`
**Modify:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
**Modify:** `src/modules/inbox/api/inboxTwilio.api.ts`
- Ensure outbound send shows actionable blocking errors for managed not-ready.
- Show connection health indicator from backend status endpoint.

---

## Phase 6 — Verification and rollout

### 6.1 Test checklist execution [ ]
- No connection (manual and managed mode).
- Requested/draft.
- Provisioning.
- Pending verification/review.
- Action required.
- Connected.
- Failed.
- Send blocked while not ready (managed mode).
- Inbound on connected managed sender.
- Manual flow still works end-to-end.
- No silent fallback confusion.

### 6.2 Deploy/ops checklist [ ]
- Run migrations first.
- Deploy new functions then modified functions.
- Configure secrets/webhook signatures.
- Deploy frontend.
- Smoke both modes.
- Gradually switch tenant cohorts to managed.

### 6.3 Rollback readiness [ ]
- Document mode toggle rollback to `manual`.
- Keep additive schema untouched if disabling managed rollout.
- Preserve event logs for post-incident analysis.
