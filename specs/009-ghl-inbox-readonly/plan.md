# Implementation Plan: GHL Inbox — Phase 1 (Inbound Read-Only)

**Branch**: `009-ghl-inbox-readonly` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/009-ghl-inbox-readonly/spec.md`

## Summary

Deliver a **parallel GHL Inbox** at `/dashboard/ghl-inbox` that read-through proxies GoHighLevel conversations, messages, and contacts via three Edge Functions (`ghl-fetch`, `ghl-webhook`, `ghl-mark-read`). GHL remains the source of truth; Mason stores only `ghl_connections` metadata. Live updates use verified GHL webhooks pulsing `ghl_connections.updated_at` + Supabase Realtime → React Query invalidation (same invalidate-don’t-patch pattern as unified inbox). Phase 1 includes explicit mark-as-read and a disabled composer labelled for Phase 2 outbound messaging.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React 18); Deno (Supabase Edge Functions)  
**Primary Dependencies**: `@supabase/supabase-js`, TanStack React Query, React Router v6, Tailwind + shadcn/gardens UI  
**Storage**: PostgreSQL — new `public.ghl_connections` only; no GHL message tables  
**Testing**: `npm run lint`; manual quickstart + UAT with Arin webhook  
**Target Platform**: Web + Supabase Edge (project `bfwohzcugtwbhhxdqgme`)  
**Project Type**: Web application (feature module + Edge Functions + one migration)  
**Performance Goals**: Conversation list usable &lt;3s; webhook→UI refresh &lt;10s (p95 UAT)  
**Constraints**: PIT server-only; JWT org verification; no unified inbox schema changes; single location per org  
**Scale/Scope**: Pilot single org (Sears Melvin); ~15–20 new source files + 3 edge functions + 1 migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| Dual router (`src/app/` + `src/pages/`) | **Pass** | Add route in `src/app/router.tsx` only |
| Module boundaries | **Pass** | `src/modules/ghl-inbox/`; shared helpers in `_shared` / `@/shared` |
| Supabase + RLS | **Pass** | `ghl_connections` member read / admin write |
| Secrets server-side | **Pass** | `GHL_API_KEY` in Edge secrets only |
| Additive-first | **Pass** | New module + table; inbox tables untouched |

**Post-design re-check**: **Pass** — read-through model avoids cross-feature DB coupling.

## Phase 0: Research

See [research.md](./research.md). Resolved:

- GHL REST endpoints and webhook event names (`InboundMessage`, `OutboundMessage`, `ContactCreate`, `ContactUpdate`)
- Signature verification (Ed25519 `X-GHL-Signature` + RSA fallback)
- Realtime strategy without extra tables (pulse `ghl_connections.updated_at`)
- Mark-read endpoint (confirm `PUT /conversations/:id` body at implementation)

## Phase 1: Design artifacts

| Artifact | Purpose |
|----------|---------|
| [data-model.md](./data-model.md) | `ghl_connections` + logical entities |
| [contracts/ghl-fetch.md](./contracts/ghl-fetch.md) | Read proxy API |
| [contracts/ghl-mark-read.md](./contracts/ghl-mark-read.md) | Write proxy API |
| [contracts/ghl-webhook.md](./contracts/ghl-webhook.md) | Inbound webhook + Realtime pulse |
| [contracts/arin-webhook-setup.md](./contracts/arin-webhook-setup.md) | Client go-live instructions |
| [quickstart.md](./quickstart.md) | Implementation order + verification |

## Project Structure

### Documentation (this feature)

```text
specs/009-ghl-inbox-readonly/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ghl-fetch.md
│   ├── ghl-mark-read.md
│   ├── ghl-webhook.md
│   └── arin-webhook-setup.md
└── tasks.md              # /speckit.tasks (next command)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── YYYYMMDDHHmmss_ghl_connections.sql
├── functions/
│   ├── _shared/
│   │   ├── ghlClient.ts
│   │   └── ghlWebhookVerify.ts
│   ├── ghl-fetch/index.ts
│   ├── ghl-webhook/index.ts
│   └── ghl-mark-read/index.ts

src/
├── app/
│   └── router.tsx                    # + Route ghl-inbox
└── modules/
    └── ghl-inbox/
        ├── api/ghlInbox.api.ts
        ├── hooks/
        │   ├── useGhlConnection.ts
        │   ├── useGhlConversations.ts
        │   ├── useGhlMessages.ts
        │   ├── useGhlContact.ts
        │   └── useGhlInboxRealtime.ts
        ├── components/
        │   ├── GhlConversationList.tsx
        │   ├── GhlMessageThread.tsx
        │   ├── GhlContactPanel.tsx
        │   └── GhlReadOnlyComposer.tsx
        ├── pages/GhlInboxPage.tsx
        └── index.ts
```

**Structure Decision**: New isolated feature module + Edge Functions; zero changes to `src/modules/inbox` data layer.

## Complexity Tracking

No constitution violations requiring justification.

---

## Implementation phases (for `/speckit.tasks`)

### A. Database (deploy first)

| ID | Task |
|----|------|
| M1 | Migration: `ghl_connections` table, RLS, indexes, `updated_at` trigger |
| M2 | Enable Realtime on `ghl_connections` |
| M3 | Seed pilot org row + verify `user_is_member_of_org` |

### B. Edge Functions

| ID | Task |
|----|------|
| E1 | `_shared/ghlClient.ts` + `ghlWebhookVerify.ts` |
| E2 | `ghl-fetch` action router |
| E3 | `ghl-mark-read` (cheap path `unreadCount: 0` first; expensive message-status loop on 4xx) |
| E4 | `ghl-webhook` verify + location map + pulse |
| E5 | Set secrets on `bfwohzcugtwbhhxdqgme` |

### C. Frontend

| ID | Task |
|----|------|
| F1 | API + React Query hooks + keys |
| F2 | `GhlInboxPage` layout (list / thread / contact) |
| F3 | Realtime subscription + debounced invalidation |
| F4 | Mark as read button + error toast |
| F5 | Read-only composer badge |
| F6 | Router + nav link; empty/error states |
| F7 | Minimal admin strip on `GhlInboxPage`: status + Disconnect (`isOrgAdmin`); pilot row seeded in migration |

### D. Go-live

| ID | Task |
|----|------|
| G1 | Share `contracts/arin-webhook-setup.md` with Arin |
| G2 | UAT: inbound WhatsApp + mark-read + no PIT in browser |

## Risk flags

| Risk | Mitigation |
|------|------------|
| Mark-read cheap path undocumented | UAT: `PUT` conversation `{ unreadCount: 0 }`; on 4xx use message-status loop per `research.md` §3 |
| Webhook payload wrapper shape | Log first production payload; support `locationId` at root or nested |
| Email bodies truncated in list API | Optional per-message fetch; defer if UAT accepts previews |
| Realtime not enabled | Migration + quickstart Dashboard check |

## Next command

Run **`/speckit.tasks`** to generate `tasks.md` from this plan.
