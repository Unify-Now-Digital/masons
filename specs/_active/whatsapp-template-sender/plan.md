# Implementation Plan: WhatsApp Template Sender

**Branch**: `feature/whatsapp-template-sender` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/_active/whatsapp-template-sender/spec.md`

---

## Summary

Add a WhatsApp-only template sending mode in the Inbox reply composer so staff can switch between freeform and template sends, fetch approved templates live through a server-mediated `fetch-whatsapp-templates` edge function, edit pre-filled variables, and send through `inbox-twilio-send` using `contentSid` and `contentVariables` while preserving the existing freeform path and timeline behavior.

---

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Deno TypeScript (Supabase Edge Functions)  
**Primary Dependencies**: React 18, Vite, Tailwind, shadcn/ui, React Query, Supabase JS v2, Twilio REST/Content APIs  
**Storage**: Existing Postgres tables only (`inbox_conversations`, `inbox_messages`, `orders`, `customers`, auth user)  
**Testing**: Manual verification via `quickstart.md`  
**Target Platform**: Web Inbox module (staff-facing)  
**Performance Goals**: Template selector open should feel immediate; live template fetch per open  
**Constraints**: No DB migrations/tables; additive-only; do not change email/SMS send paths; freeform WhatsApp must remain working  
**Scale/Scope**: Single conversation composer path; approved templates fetched live at open

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Module boundaries | ✅ Pass | Changes are contained in Inbox module + WhatsApp edge functions |
| Additive-first | ✅ Pass | No schema changes; no removal of freeform flow |
| Secrets server-side | ✅ Pass | Twilio credentials remain in edge function only |
| RLS/auth boundary | ✅ Pass | Existing function auth/ownership checks retained |
| Cross-channel safety | ✅ Pass | Email/SMS paths are untouched |
| Dual router constraint | ✅ Pass | No router/folder migration; changes remain inside existing module/components |

---

## Project Structure

### Documentation (this feature)

```text
specs/_active/whatsapp-template-sender/
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
src/modules/inbox/components/ConversationThread.tsx     MODIFIED
src/modules/inbox/api/inboxTwilio.api.ts                MODIFIED
src/modules/inbox/hooks/useInboxMessages.ts             MODIFIED
supabase/functions/inbox-twilio-send/index.ts           MODIFIED
supabase/functions/fetch-whatsapp-templates/index.ts    NEW
```

---

## Phase 0: Research Findings

See [research.md](./research.md). All major unknowns are resolved:
- Existing reply area is `ConversationThread` with freeform-only composer.
- `inbox-twilio-send` currently accepts only `{ conversation_id, body_text }`.
- Customer name is available from linked conversation person/order context.
- Staff name placeholder `{{2}}` uses authenticated user email for now.

---

## Phase 1: Design

1. **Composer UX extension (WhatsApp only)**  
   Add freeform/template mode switch and template selector + variables form in `ConversationThread`.

2. **Twilio request contract extension (additive)**  
   Extend `sendTwilioMessage` + `useSendReply` + edge function payload to allow either:
   - Freeform: `body_text`
   - Template: `contentSid` + `contentVariables`

3. **Template list loading strategy**  
   Fetch approved templates live each selector-open via `fetch-whatsapp-templates` edge function (server-mediated Twilio Content API call).

4. **Timeline persistence rule**  
   Store fully rendered template text in `inbox_messages.body_text` to keep timeline rendering unchanged.

5. **Safety constraints**  
   Preserve existing freeform path behavior and all non-WhatsApp channel paths.

---

## Complexity Tracking

No constitution violations and no schema-level complexity introduced.
