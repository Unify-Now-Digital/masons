# Implementation Plan: Shared WhatsApp UI and Sender Identity

**Branch**: `feature/shared-whatsapp-ui` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/_active/shared-whatsapp-ui/spec.md`

---

## Summary

Restrict WhatsApp connection controls to admin only while keeping status visible to all logged-in users, and add WhatsApp-only outbound sender identity tracking/display by storing `meta.sender_email` in `inbox_messages` via `inbox-twilio-send` and rendering `You/email` labels on outbound WhatsApp bubbles with backward-compatible fallback.

---

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Deno TypeScript (Supabase Edge Functions)  
**Primary Dependencies**: React 18, Vite, Tailwind, shadcn/ui, React Query, Supabase JS v2  
**Storage**: Existing Postgres tables only (`inbox_messages`, `inbox_conversations`)  
**Testing**: Manual verification via `quickstart.md`  
**Target Platform**: Web Inbox module (staff-facing)  
**Performance Goals**: No noticeable latency added to thread rendering or send flow  
**Constraints**: No DB migrations/tables; WhatsApp-only scope for sender metadata/display; email/SMS untouched; `VITE_ADMIN_EMAIL` is only admin mechanism  
**Scale/Scope**: Top-bar WhatsApp status component, thread bubble labeling, WhatsApp edge send persistence

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Module boundaries | ✅ Pass | Changes are contained in Inbox module + WhatsApp edge functions |
| Additive-first | ✅ Pass | No schema changes; metadata extension only |
| Secrets server-side | ✅ Pass | No credential movement to client |
| RLS/auth boundary | ✅ Pass | Existing auth checks retained in edge functions |
| Cross-channel safety | ✅ Pass | Email/SMS send and rendering paths remain unchanged |
| Dual router constraint | ✅ Pass | No route structure changes |

---

## Project Structure

### Documentation (this feature)

```text
specs/_active/shared-whatsapp-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── api-contracts.md
    └── ui-contracts.md
```

### Source Code Layout (planned touch points)

```text
src/modules/inbox/types/inbox.types.ts                    MODIFIED
src/modules/inbox/components/WhatsAppConnectionStatus.tsx  MODIFIED
src/app/layout/DashboardLayout.tsx                         MODIFIED
src/modules/inbox/components/ConversationThread.tsx        MODIFIED
src/modules/inbox/components/InboxMessageBubble.tsx        MODIFIED
supabase/functions/inbox-twilio-send/index.ts              MODIFIED
```

---

## Phase 0: Research Findings

See [research.md](./research.md). All major unknowns are resolved:
- Existing WhatsApp status UI has no admin gating.
- Top bar already renders WhatsApp status globally for logged-in users.
- Outbound labels are currently hardcoded to `You`.
- WhatsApp outbound persistence currently does not write `meta`.

---

## Phase 1: Design

1. **Admin-only control gating in WhatsApp top-bar UI**  
   Extend status component props to accept `isAdmin`; render status for all users and action controls only for admin.

2. **Admin identity source**  
   Compute admin in layout from authenticated user email and `VITE_ADMIN_EMAIL`; pass through to WhatsApp status component.

3. **WhatsApp outbound sender persistence**  
   Update `inbox-twilio-send` inserts to include `meta.sender_email` for outbound WhatsApp messages.

4. **WhatsApp outbound sender display logic**  
   In thread rendering, apply label logic only to outbound WhatsApp messages:
   - `sender_email` == current user -> `You`
   - different `sender_email` -> that email
   - missing `sender_email` -> `You`

5. **Safety constraints**  
   Keep non-WhatsApp label behavior unchanged; do not modify email/SMS edge paths.

---

## Complexity Tracking

No constitution violations and no schema-level complexity introduced.
