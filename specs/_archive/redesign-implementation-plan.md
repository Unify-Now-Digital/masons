# Managed WhatsApp Onboarding Redesign — Implementation Plan

**Feature spec:** `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign.md`  
**Plan artifacts:** `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign-plan`

*Note: `.specify/templates/plan-template.md` and `.specify/memory/constitution.md` are not present in this repository, so this plan follows the repo's existing manual planning artifact structure (`research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `tasks.md`) and the approved feature spec directly.*

---

## Technical context (from arguments)

- Stack: React + TypeScript (Vite), Tailwind, shadcn/ui, Supabase (Postgres + RLS + Edge Functions).
- Existing manual WhatsApp path is already live (`whatsapp_connections`, `twilio-sms-webhook`, `inbox-twilio-send`) and must keep working.
- Managed onboarding must coexist with manual mode, with explicit runtime mode selection and no silent fallback.
- `connected` for managed mode is strict and provider-derived; never inferred from client assumptions.
- Outbound must fail clearly for managed mode when sender/provider is not ready.
- Inbound ownership routing must be based on actual provisioned sender identity, not user-entered phone assumptions.
- Rollout must be additive and low-risk; reuse current inbox architecture.

---

## Progress tracking

| Phase | Status | Artifact(s) |
|-------|--------|-------------|
| 0 – Research | ✅ Complete | `research.md` |
| 1 – Data model & contracts | ✅ Complete | `data-model.md`, `contracts/`, `quickstart.md` |
| 2 – Tasks | ✅ Complete | `tasks.md` |

---

## Engineering phases (safe execution order)

### Phase 0 — Baseline verification
- Confirm current manual behavior and all touchpoints before changing anything.
- Freeze contracts for "explicit mode" and "strict connected".
- Artifact: `redesign-plan/research.md`.

### Phase 1 — Additive schema and RLS
- Add managed tables/state machine and event logging.
- Add mode/source attribution fields on inbox records.
- Add explicit tenant mode selector (`preferred_whatsapp_mode`) with default `manual`.
- Keep existing `whatsapp_connections` untouched.

### Phase 2 — Shared backend contracts and resolver
- Introduce a shared resolver in Edge Function shared module to decide routing mode and readiness.
- Return typed outcomes (`ready`, `not_ready`, `misconfigured`) with reason/action metadata.
- Ensure no implicit managed/manual fallback.

### Phase 3 — Managed onboarding/status backend
- Create managed onboarding functions and status query endpoint.
- Implement status update path (provider webhook + polling function).
- Persist lifecycle transitions and provider event snapshots.

### Phase 4 — Outbound/inbound runtime enforcement
- Update outbound send function to route by explicit mode:
  - `managed` -> only managed connected sender allowed.
  - `manual` -> existing manual path.
- Update inbound webhook to map by provisioned sender identity and record mode/source attribution.
- Return clear hard failures for managed not-ready sends.

### Phase 5 — Frontend UX (managed + manual coexistence)
- Build managed onboarding stateful UI (pending/action_required/failed/connected).
- Keep manual UI accessible and separate.
- Show backend truth only; no optimistic "connected" state.

### Phase 6 — Rollout, verification, and guardrails
- Deploy in migration/function/frontend sequence.
- Enable managed mode per tenant gradually.
- Run smoke suite for both modes and inbound/outbound invariants.

---

## Exact modules likely to change

### Supabase migrations
- `supabase/migrations/*_create_whatsapp_managed_connections.sql` (new)
- `supabase/migrations/*_create_whatsapp_connection_events.sql` (new)
- `supabase/migrations/*_add_whatsapp_mode_and_source_attribution.sql` (new)
- `supabase/migrations/*_add_preferred_whatsapp_mode_to_profile_or_company.sql` (new)

### Edge Functions (new)
- `supabase/functions/whatsapp-managed-start/index.ts`
- `supabase/functions/whatsapp-managed-submit-business/index.ts`
- `supabase/functions/whatsapp-managed-status/index.ts`
- `supabase/functions/whatsapp-managed-sync/index.ts`
- `supabase/functions/whatsapp-managed-provider-webhook/index.ts`

### Edge Functions (modify)
- `supabase/functions/inbox-twilio-send/index.ts`
- `supabase/functions/twilio-sms-webhook/index.ts`
- `supabase/functions/whatsapp-connect/index.ts` (manual-only hardening)
- `supabase/functions/whatsapp-test/index.ts` (mode-aware test behavior)
- `supabase/functions/_shared/*` (new shared resolver and status helpers)

### Frontend modules (modify/new)
- `src/modules/inbox/api/whatsappConnections.api.ts`
- `src/modules/inbox/api/inboxTwilio.api.ts`
- `src/modules/inbox/hooks/useWhatsAppConnection.ts`
- `src/modules/inbox/components/WhatsAppConnectionStatus.tsx`
- `src/modules/inbox/components/ChannelConnectionsCard.tsx`
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- `src/app/layout/DashboardLayout.tsx`
- New managed onboarding components/hooks under:
  - `src/modules/inbox/components/whatsapp-managed/*`
  - `src/modules/inbox/hooks/useWhatsAppManaged*`
  - `src/modules/inbox/api/whatsappManaged.api.ts`

---

## Output artifacts

- `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign-plan\research.md`
- `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign-plan\data-model.md`
- `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign-plan\contracts\managed-whatsapp-api.md`
- `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign-plan\quickstart.md`
- `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\redesign-plan\tasks.md`

---

*End of implementation plan.*
