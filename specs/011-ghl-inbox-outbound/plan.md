# Implementation Plan: GHL Inbox — Phase 2 (Outbound Send)

**Branch**: `011-ghl-inbox-outbound` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/011-ghl-inbox-outbound/spec.md` + brownfield architecture brief

## Summary

Enable **two-way GHL Inbox** by adding a single new Edge Function (`ghl-send-message`) and replacing the disabled `GhlReadOnlyComposer` with a working send composer. Outbound replies use the conversation's existing channel (SMS / WhatsApp / Email / etc.), org-default sender voice (no `userId`), and the established multi-org credential path (`getActiveGhlConnectionWithKey`). Message bodies remain read-through from GHL — no Mason persistence. **Idempotency** is enforced client-side (in-flight lock) plus server-side (durable `requestId` dedupe table). **Progressive rollout** via `ghl_connections.outbound_enabled` (default `false`).

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React 18); Deno (Supabase Edge Functions)  
**Primary Dependencies**: `@supabase/supabase-js`, TanStack React Query, React Router v6, Tailwind + shadcn UI  
**Storage**: PostgreSQL — additive columns on `public.ghl_connections`; new `public.ghl_send_idempotency` (metadata only, no message bodies)  
**Testing**: `npm run lint`; manual quickstart against developer test contact; idempotency stress tests  
**Target Platform**: Web + Supabase Edge (project `bfwohzcugtwbhhxdqgme`)  
**Project Type**: Brownfield extension — `src/modules/ghl-inbox/` + one Edge Function + one migration  
**Performance Goals**: Send acknowledgement to UI &lt;5s (p95); thread refresh with sent message &lt;10s after success  
**Constraints**: PIT server-only; JWT org membership gate; no `inbox_*` changes; no customer message bodies in Mason; idempotency hard requirement  
**Scale/Scope**: Two production orgs (Churchill, Sears Melvin); ~8–12 source file edits + 1 edge function + 1 migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| Dual router (`src/app/` + `src/pages/`) | **Pass** | No routing changes; composer swap inside existing thread |
| Module boundaries | **Pass** | All work in `src/modules/ghl-inbox/`; shared UI from `@/shared` |
| Supabase + RLS | **Pass** | `outbound_enabled` on existing RLS-protected table; idempotency table service-role-only |
| Secrets server-side | **Pass** | PIT decrypted only in Edge; never in browser |
| Additive-first | **Pass** | New column + new table + new function; Phase 1 paths untouched |

**Post-design re-check**: **Pass** — read-through preserved; parallel inbox untouched; dedupe table stores IDs only.

## Phase 0: Research

See [research.md](./research.md). Resolved:

- GHL send endpoint: `POST /conversations/messages`, scope `conversations/message.write`
- Request body fields and Version header discrepancy (docs vs project standard)
- No GHL-native idempotency key on outbound send → Mason-side dedupe table mandatory
- Channel `type` derived from thread `messageType` with explicit enum mapping
- `status: "pending"` required by GHL schema (omitted from user brief — added at implementation)

## Phase 1: Design artifacts

| Artifact | Purpose |
|----------|---------|
| [data-model.md](./data-model.md) | `outbound_enabled` column + `ghl_send_idempotency` table |
| [contracts/ghl-send-message.md](./contracts/ghl-send-message.md) | Send Edge Function API |
| [quickstart.md](./quickstart.md) | Pre-gates, deploy order, test rollout |

## Project Structure

### Documentation (this feature)

```text
specs/011-ghl-inbox-outbound/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ghl-send-message.md
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit.tasks (next command)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── YYYYMMDDHHmmss_ghl_outbound_send.sql   # outbound_enabled + ghl_send_idempotency
├── functions/
│   ├── _shared/
│   │   └── ghlClient.ts                       # + outbound_enabled on connection row (optional extend)
│   └── ghl-send-message/
│       └── index.ts                           # NEW

src/
└── modules/
    └── ghl-inbox/
        ├── api/
        │   ├── ghlInbox.api.ts                # + sendGhlMessage, extend GhlConnectionRow
        │   └── ghlInbox.keys.ts               # unchanged keys suffice
        ├── hooks/
        │   └── useGhlSendMessage.ts           # NEW
        ├── components/
        │   ├── GhlComposer.tsx                # NEW (replaces GhlReadOnlyComposer)
        │   ├── GhlMessageThread.tsx           # wire composer + channel props
        │   └── GhlReadOnlyComposer.tsx        # DELETE or keep as disabled fallback
        └── pages/
            └── GhlInboxPage.tsx               # pass contactId, channel type, outbound_enabled
```

**Structure Decision**: Brownfield extension inside existing `ghl-inbox` module; mirror `ghl-mark-read` Edge Function patterns (CORS, JWT auth, org gate, `getActiveGhlConnectionWithKey`, `json()` helper).

## Complexity Tracking

No constitution violations requiring justification.

---

## Pre-implementation gates (sequence first)

| ID | Gate | Owner | Blocker for |
|----|------|-------|-------------|
| **G1** | Verify each org PIT includes `conversations/message.write` in GHL → Settings → Private Integrations → token → scopes. Regenerate + re-encrypt into `ghl_connections` if missing. | Operator | All send code |
| **G2** | Smoke-test `POST /conversations/messages` against test sub-account: confirm Version header (`2021-07-28` vs `2021-04-15`) and exact body fields (`type`, `contactId`, `message`, `conversationId`, `status`). Document locked payload in contract. | Developer | Edge function body |
| **G3** | Add self as test contact in non-Churchill sub-account; confirm receive on own phone/email. | Developer | Feature-flag enable |

## Implementation phases (for `/speckit.tasks`)

### A. Database

| ID | Task |
|----|------|
| M1 | Migration: `ghl_connections.outbound_enabled boolean NOT NULL DEFAULT false` |
| M2 | Migration: `ghl_send_idempotency` table (see data-model.md) |
| M3 | RLS on idempotency table (deny authenticated; service role writes) |
| M4 | Operator applies migration in Dashboard; `NOTIFY pgrst, 'reload schema'` |

### B. Edge Function — `ghl-send-message`

| ID | Task |
|----|------|
| E1 | Scaffold `ghl-send-message/index.ts` — copy structure from `ghl-mark-read` (CORS, JWT, org gate) |
| E2 | Validate body: `organizationId`, `contactId`, `conversationId`, `type`, `message`, `requestId` (UUID) |
| E3 | Reject whitespace-only `message`; reject if `outbound_enabled = false` |
| E4 | Idempotency: insert `requestId` → on conflict return cached result; `pending` → 409 in-flight |
| E5 | Call GHL `POST /conversations/messages` via `ghlFetch` with locked body from G2 |
| E6 | Map GHL errors to `{ ok: false, error, ghlStatus, ghlMessage }` for UI |
| E7 | On success: update idempotency row `completed` + `ghl_message_id`; return `{ ok: true, messageId, conversationId, status }` |
| E8 | Deploy: `npx supabase functions deploy ghl-send-message --project-ref bfwohzcugtwbhhxdqgme` (JWT verified — no `--no-verify-jwt`) |

### C. Frontend

| ID | Task |
|----|------|
| F1 | Extend `GhlConnectionRow` + `fetchGhlConnection` select with `outbound_enabled` |
| F2 | Add `sendGhlMessage()` in `ghlInbox.api.ts` invoking `ghl-send-message` |
| F3 | Add `deriveConversationChannelType()` helper (messageType → GHL send `type` enum) |
| F4 | Implement `useGhlSendMessage` mutation: generate `requestId` per attempt, optimistic append, invalidate on success |
| F5 | Replace `GhlReadOnlyComposer` with `GhlComposer`: textarea, Send button, states (disabled / composing / sending / error) |
| F6 | Wire `GhlMessageThread`: pass `contactId`, `channelType`, `outboundEnabled`; preserve draft on error |
| F7 | Update `GhlInboxPage` header copy when outbound enabled; pass connection flag |
| F8 | Client idempotency: disable Send while `isPending`; ignore duplicate submit handlers |

### D. Rollout & verification

| ID | Task |
|----|------|
| R1 | Test send to developer's own number in test sub-account (`outbound_enabled = true` via Dashboard SQL) |
| R2 | Idempotency stress: 20× double-click / retry scenarios — zero duplicate GHL messages |
| R3 | Failure paths: WhatsApp window rejection surfaces readable error; draft preserved |
| R4 | Enable `outbound_enabled` for Sears Melvin only after clean test; Churchill last |
| R5 | Update module `index.ts` exports if needed |

## Dependencies

- Phase 1 GHL Inbox (`009`) and multi-org credentials (`010`) shipped
- `GHL_API_KEY_ENCRYPTION_KEY` Edge secret configured
- G1 + G2 gates complete before E5
- PostgREST schema cache refresh after migration before Edge relies on new columns/table

## Risks

| Risk | Mitigation |
|------|------------|
| Version header mismatch (`2021-07-28` vs `2021-04-15`) | G2 smoke test locks header before merge |
| Missing `status` field in send body | Include `status: "pending"` per GHL OpenAPI (see research.md §2) |
| Duplicate send on retry | Durable idempotency table + client lock |
| Live customer impact | `outbound_enabled` default false; test on own number first |
| Location ID transcription errors | Copy via GHL UI copy button only |
