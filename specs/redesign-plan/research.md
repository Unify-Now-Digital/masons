# Phase 0 Research — Managed WhatsApp Onboarding Redesign

## Source spec
- `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign.md`

## Verified baseline (codebase)

- Manual WhatsApp connection table already exists: `public.whatsapp_connections`.
- Current manual statuses are `connected | disconnected | error` and are used by:
  - `supabase/functions/whatsapp-connect/index.ts`
  - `supabase/functions/whatsapp-test/index.ts`
  - `supabase/functions/inbox-twilio-send/index.ts`
  - `supabase/functions/twilio-sms-webhook/index.ts`
- Inbound webhook already maps ownership via Twilio Account SID + `To` phone normalization and writes `user_id`.
- Outbound already enforces signed-in user ownership of `inbox_conversations`.

## Gaps against approved spec

1. No first-class managed connection model (no provider lifecycle states).
2. No explicit mode choice (`managed` vs `manual`) at tenant runtime.
3. No strict "provider-ready" contract before marking managed connected.
4. No managed status sync loop (webhook/polling) and structured action-required UX contract.
5. No dedicated event/audit stream for managed onboarding transitions.
6. Existing manual connect marks connected without provider readiness verification.

## Design decisions locked for implementation

1. **Dual-model coexistence**
   - Keep existing `whatsapp_connections` as manual path.
   - Add managed path in new tables/functions.
   - Runtime mode is explicit and tenant-scoped; no silent fallback.

2. **Connected definition (managed)**
   - Only true when provider-side sender identity and readiness are confirmed and persisted.
   - Never inferred from user phone number or frontend optimistic state.

3. **Resolver-first backend**
   - Shared backend resolver determines:
     - selected mode,
     - readiness,
     - sender identity to use.
   - All send/webhook/status flows use this shared resolver contract.

4. **Additive rollout**
   - New schema and functions first.
   - Manual path remains default (`preferred_whatsapp_mode = manual`).
   - Tenant-by-tenant opt-in to managed mode.

## Risks + mitigations

- **Risk:** accidental fallback causing wrong sender usage.  
  **Mitigation:** resolver returns deterministic mode; outbound rejects instead of fallback.

- **Risk:** fake connected state from stale frontend data.  
  **Mitigation:** connected badge derived from backend status endpoint only; polling and refresh on transitions.

- **Risk:** Twilio/Meta async delays misrepresented as success.  
  **Mitigation:** explicit `pending_provider_review` / `pending_meta_action` / `action_required` states with timestamps and reasons.

- **Risk:** inbound ownership ambiguity.  
  **Mitigation:** route by provisioned sender identity (sender SID / From), store mode + connection attribution.

## Files confirmed relevant

- Backend:
  - `supabase/functions/inbox-twilio-send/index.ts`
  - `supabase/functions/twilio-sms-webhook/index.ts`
  - `supabase/functions/whatsapp-connect/index.ts`
  - `supabase/functions/whatsapp-test/index.ts`
  - `supabase/functions/_shared/whatsappCrypto.ts`
- Frontend:
  - `src/modules/inbox/api/whatsappConnections.api.ts`
  - `src/modules/inbox/api/inboxTwilio.api.ts`
  - `src/modules/inbox/hooks/useWhatsAppConnection.ts`
  - `src/modules/inbox/components/WhatsAppConnectionStatus.tsx`
  - `src/modules/inbox/components/ChannelConnectionsCard.tsx`
  - `src/modules/inbox/pages/UnifiedInboxPage.tsx`
  - `src/app/layout/DashboardLayout.tsx`

## Phase gate outcome
- Research complete, no blocking contradictions with approved spec.
