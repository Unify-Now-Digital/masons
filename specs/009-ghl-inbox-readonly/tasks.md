# Tasks: GHL Inbox — Phase 1 (Inbound Read-Only)

**Input**: Design documents from `specs/009-ghl-inbox-readonly/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested — manual verification per quickstart.md only.

**Organization**: Tasks grouped by user story for independent delivery. **MVP** = Phase 1 + 2 + User Story 1 (live read-only inbox).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module scaffold and query-key conventions

- [X] T001 Create `src/modules/ghl-inbox/` directory structure and `src/modules/ghl-inbox/index.ts` exporting `GhlInboxPage` per plan.md
- [X] T002 [P] Add `ghlInboxKeys` factory in `src/modules/ghl-inbox/api/ghlInbox.keys.ts` per data-model.md
- [X] T003 [P] Add route placeholder import in `src/app/router.tsx` for `path="ghl-inbox"` (can point to stub page until US1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB, shared Edge helpers, and all three Edge Functions — **MUST complete before user story UI**

**⚠️ CRITICAL**: No user story work until this phase is done

**Schema discipline**: Cursor creates migration SQL in-repo only. The **user** applies SQL on project `bfwohzcugtwbhhxdqgme` via Supabase Dashboard after review. Cursor must **not** run `supabase db push`, `supabase migration up`, or other commands that apply schema directly to production.

- [X] T004a Create migration file `supabase/migrations/YYYYMMDDHHmmss_ghl_connections.sql` only (table, UNIQUE `organization_id`, index on `ghl_location_id`, RLS policies, `updated_at` trigger, SQL comment block for Realtime publication) — **no pilot seed data in this file**
- [ ] T004b **User task (Dashboard)**: Review `supabase/migrations/*_ghl_connections.sql` and run it in Supabase Dashboard → SQL Editor on `bfwohzcugtwbhhxdqgme` (not via Cursor CLI push)
- [ ] T004c **User task (Dashboard)**: Verify `ghl_connections` is in Realtime publication (Database → Replication, or SQL from migration comments); confirm `postgres_changes` UPDATE fires on manual `updated_at` touch
- [ ] T005 **User task (Dashboard)**: After migration, insert pilot row via SQL Editor with real `organization_id` and real `ghl_location_id` (see `quickstart.md` seed snippet) — values must **not** be committed as production IDs in the migration file
- [X] T006 [P] Implement `supabase/functions/_shared/ghlClient.ts`: PIT headers (`Version: 2021-07-28`), `ghlFetch`, `getActiveConnection`, org membership check
- [X] T007 [P] Implement `supabase/functions/_shared/ghlWebhookVerify.ts`: Ed25519 + RSA public keys from [Webhook Integration Guide § Security](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/#security-verifying-webhook-authenticity) — **no** `GHL_WEBHOOK_SECRET`
- [X] T008 Implement `supabase/functions/ghl-fetch/index.ts` per `contracts/ghl-fetch.md` (actions: `listConversations`, `getMessages` with pagination, `getContact`, optional `getConversation`)
- [X] T009 Implement `supabase/functions/ghl-webhook/index.ts` per `contracts/ghl-webhook.md` (verify signature, pulse `updated_at`, no JWT)
- [X] T010 Implement `supabase/functions/ghl-mark-read/index.ts` per `contracts/ghl-mark-read.md`: **cheap path first** `PUT …/conversations/:id` + `{ "unreadCount": 0 }`; on 4xx only, **expensive path** (paginate messages + `PUT …/messages/:id/status` with `{ "status": "read" }`)
- [ ] T011a **User task (Dashboard)**: Set Edge secrets on `bfwohzcugtwbhhxdqgme`: `GHL_API_KEY`, `GHL_LOCATION_ID` only (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — do not set manually)
- [ ] T011b **User task (Dashboard)**: Verify secrets exist (Edge Functions → Secrets) and match pilot location / PIT scopes per `contracts/arin-webhook-setup.md`
- [ ] T011c Deploy Edge Functions `ghl-fetch`, `ghl-webhook`, `ghl-mark-read` to `bfwohzcugtwbhhxdqgme` (CLI deploy functions only — not schema)
- [ ] T011d Smoke test deployed `ghl-fetch` with a user JWT (`listConversations`) and `ghl-webhook` with a signed test payload or first live GHL delivery
- [X] T012 [P] Implement `src/modules/ghl-inbox/api/ghlInbox.api.ts` wrapping `supabase.functions.invoke` for `ghl-fetch` and `ghl-mark-read`
- [X] T013 [P] Implement `src/modules/ghl-inbox/hooks/useGhlConnection.ts` reading `ghl_connections` via Supabase client + RLS

**Checkpoint**: T004b–T005 and T004c done by user; T011a–T011d complete; `ghl-fetch` returns conversations with user JWT

---

## Phase 3: User Story 1 — View live GHL conversations (Priority: P1) 🎯 MVP

**Goal**: Two-pane inbox with live GHL conversation list and message thread

**Independent test**: Member of org with active connection opens `/dashboard/ghl-inbox`, sees conversations, selects one, sees messages from GHL (not `inbox_messages`)

- [X] T014 [US1] Implement `useGhlConversations.ts` in `src/modules/ghl-inbox/hooks/useGhlConversations.ts` calling `listConversations`
- [X] T015 [US1] Implement `useGhlMessages.ts` in `src/modules/ghl-inbox/hooks/useGhlMessages.ts` calling `getMessages` (handles aggregated pagination response)
- [X] T016 [P] [US1] Build `GhlConversationList.tsx` in `src/modules/ghl-inbox/components/GhlConversationList.tsx` with unread badges from `unreadCount`
- [X] T017 [P] [US1] Build `GhlMessageThread.tsx` in `src/modules/ghl-inbox/components/GhlMessageThread.tsx` with loading/error/empty states
- [X] T018 [US1] Compose `GhlInboxPage.tsx` in `src/modules/ghl-inbox/pages/GhlInboxPage.tsx` (list + thread layout, connection inactive empty state)
- [X] T019 [US1] Wire `GhlInboxPage` in `src/app/router.tsx` at `/dashboard/ghl-inbox` and add sidebar/nav entry

**Checkpoint**: US1 independently testable without webhooks or mark-read

---

## Phase 4: User Story 2 — Inbound messages within seconds (Priority: P1)

**Goal**: Webhook → Realtime pulse → React Query invalidation

**Independent test**: With inbox open, inbound message to GHL number appears within ~10s without manual refresh

- [X] T020 [US2] Implement `useGhlInboxRealtime.ts` in `src/modules/ghl-inbox/hooks/useGhlInboxRealtime.ts` subscribing to `ghl_connections` UPDATE with 300–500ms debounced invalidation per `contracts/ghl-webhook.md`
- [X] T021 [US2] Integrate realtime hook in `GhlInboxPage.tsx`
- [ ] T022 [US2] Share `contracts/arin-webhook-setup.md` with Arin; register webhook URL and events on GHL after deploy
- [ ] T023 [US2] Manual UAT: inbound WhatsApp/SMS updates Mason within 10s

**Checkpoint**: US2 testable with Arin webhook registration complete

---

## Phase 5: User Story 3 — Mark conversation as read (Priority: P2)

**Goal**: Explicit button clears unread in Mason and GHL

**Independent test**: Open unread thread → Mark as read → badge clears in Mason and GHL native UI

- [X] T024 [US3] Add `useGhlMarkRead.ts` mutation in `src/modules/ghl-inbox/hooks/useGhlMarkRead.ts` invoking `ghl-mark-read` and invalidating queries
- [X] T025 [US3] Add Mark as read button to `GhlMessageThread.tsx` with error toast on failure
- [ ] T026 [US3] Live validation: confirm cheap path `PUT …/conversations/:id` + `{ "unreadCount": 0 }` returns 2xx; if 4xx, confirm expensive path `{ "status": "read" }` per `research.md` §3

**Checkpoint**: US3 testable independently of US4–US6

---

## Phase 6: User Story 4 — Contact details (Priority: P2)

**Goal**: Contact panel for selected conversation

**Independent test**: Select conversation → contact panel shows name, phone, email from GHL

- [X] T027 [US4] Implement `useGhlContact.ts` in `src/modules/ghl-inbox/hooks/useGhlContact.ts` for `getContact`
- [X] T028 [US4] Build `GhlContactPanel.tsx` in `src/modules/ghl-inbox/components/GhlContactPanel.tsx` with error/empty states
- [X] T029 [US4] Add contact panel to `GhlInboxPage.tsx` layout

**Checkpoint**: US4 testable with US1 only

---

## Phase 7: User Story 5 — Read-only composer placeholder (Priority: P3)

**Goal**: Disabled composer with Phase 2 label

**Independent test**: Every thread shows non-interactive composer with “Read-only preview — outbound coming in Phase 2”

- [X] T030 [US5] Build `GhlReadOnlyComposer.tsx` in `src/modules/ghl-inbox/components/GhlReadOnlyComposer.tsx` and mount at bottom of `GhlMessageThread.tsx`

**Checkpoint**: US5 testable with US1

---

## Phase 8: User Story 6 — Admin status + disconnect (Priority: P3 — pilot-minimal)

**Goal**: Seeded connection; admin can disconnect; non-admin cannot

**Independent test**: Admin disconnects → inbox shows inactive state; member never sees disconnect

- [X] T031 [US6] Add `GhlConnectionAdminStrip.tsx` in `src/modules/ghl-inbox/components/GhlConnectionAdminStrip.tsx`: show `status`, masked `ghl_location_id`, `last_verified_at`; Disconnect updates row to `disconnected` via Supabase (gated `isOrgAdmin`)
- [X] T032 [US6] Integrate admin strip and member-safe status messaging in `GhlInboxPage.tsx`

**Checkpoint**: US6 testable; no in-app connect wizard required

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: Security check, lint, docs

- [X] T033 [P] Verify no PIT in browser network tab or frontend bundle (`npm run build` grep / manual DevTools)
- [X] T034 [P] Run `npm run lint` and fix any issues in `src/modules/ghl-inbox/`
- [X] T035 Confirm unified inbox (`src/modules/inbox/`) unchanged — no imports from `ghl-inbox` into inbox module
- [ ] T036 Update `specs/009-ghl-inbox-readonly/checklists/requirements.md` notes if UAT findings change mark-read body

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 (Setup) → Phase 2 (Foundational) → User Stories (3–8) → Phase 9 (Polish)
```

### User story dependencies

| Story | Depends on | Can start after |
|-------|------------|-----------------|
| US1 | Phase 2 | Foundational checkpoint |
| US2 | US1 (page exists) | T018+ |
| US3 | US1 | T018+ |
| US4 | US1 | T018+ |
| US5 | US1 | T017+ |
| US6 | Phase 2 (table + hook) | T013+; UI after T018 |

### Parallel opportunities

- **Phase 2**: T006 + T007 parallel; T012 + T013 parallel after T008–T010 (T004b–T005 user steps gate runtime behaviour)
- **US1**: T016 + T017 parallel after hooks
- **US4 + US5 + US6**: Can run in parallel after US1 checkpoint
- **US2**: Blocks on Arin (T022) for full UAT only

---

## Parallel example: User Story 1

```bash
# After T014–T015:
Task: "T016 GhlConversationList.tsx"
Task: "T017 GhlMessageThread.tsx"
# Then sequentially:
Task: "T018 GhlInboxPage.tsx"
```

---

## Implementation strategy

### MVP first (US1 only)

1. Complete Phase 1 + 2 (T001–T013, including user Dashboard steps T004b–T005, T004c, T011a–T011b)
2. Complete Phase 3 (T014–T019)
3. **STOP and validate** US1 independent test
4. Deploy for internal read-only preview

### Incremental delivery

1. Foundation → US1 (MVP)
2. US2 (live updates) — requires Arin webhook
3. US3 (mark read) — validate GHL bodies in T026
4. US4 (contacts) + US5 (composer) + US6 (admin strip)
5. Polish (T033–T036)

---

## Task summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 41 |
| **Phase 1** | 3 |
| **Phase 2** | 15 (includes 6 user Dashboard steps: T004b–T005, T004c, T011a–T011b) |
| **US1** | 6 |
| **US2** | 4 |
| **US3** | 3 |
| **US4** | 3 |
| **US5** | 1 |
| **US6** | 2 |
| **Polish** | 4 |
| **Suggested MVP scope** | T001–T019 + user steps T004b–T005, T004c, T011a–T011d before US1 UAT |
| **Format validation** | All tasks use `- [ ] Tnnn [P]? [USn]? Description with path` |
