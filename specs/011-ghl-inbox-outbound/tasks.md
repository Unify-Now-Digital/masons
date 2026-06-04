# Tasks: GHL Inbox — Phase 2 (Outbound Send)

**Input**: Design documents from `specs/011-ghl-inbox-outbound/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ghl-send-message.md, quickstart.md; Phase 1 (`009`) + multi-org (`010`) shipped

**Tests**: Not requested — manual verification per [quickstart.md](./quickstart.md) only.

**Organization**: Tasks grouped by user story. **MVP** = Phase 1 + Phase 2 + Phase 3 (US1) + deploy through T018, then manual send test with `outbound_enabled = true` on test org only.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Pre-implementation Gates)

**Purpose**: Verify credentials and API contract before any send code ships to production orgs

**⚠️ CRITICAL**: G1 and G2 MUST pass before Phase 2 Edge Function implements the GHL POST body (T010)

- [X] T001 **User/operator task**: Verify each org PIT includes `conversations/message.write` in GHL → Settings → Private Integrations → token → scopes; regenerate and re-encrypt into `ghl_connections.ghl_api_key` if missing (see [quickstart.md](./quickstart.md) G1) — Verified 2026-06-01: Sears Melvin scope via UI screenshot; Churchill `conversations/message.write` confirmed in client integration.
- [X] T002 Smoke-test `POST https://services.leadconnectorhq.com/conversations/messages` against test sub-account; lock Version header (`2021-07-28` vs `2021-04-15`) and body fields; update [contracts/ghl-send-message.md](./contracts/ghl-send-message.md) with confirmed payload — G2 done 2026-06-01: live 201, payload {type,contactId,conversationId,message}, Version 2021-07-28.
- [X] T003 **User task**: Add developer's own phone/email as test contact in non-Churchill sub-account; confirm read path works in Mason GHL Inbox (see [quickstart.md](./quickstart.md) G3) — Satisfied: own number added as Sears Melvin test contact; live send verified (used in T002/T027).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared client extension, and `ghl-send-message` Edge Function — **MUST complete before frontend send UI**

**Schema discipline**: Cursor commits migration SQL only. **User** applies on `bfwohzcugtwbhhxdqgme` via Dashboard. Cursor must **not** auto-push schema.

- [X] T004 Create migration `supabase/migrations/YYYYMMDDHHmmss_ghl_outbound_send.sql`: add `outbound_enabled boolean not null default false` to `public.ghl_connections`; create `public.ghl_send_idempotency` table per [data-model.md](./data-model.md); enable RLS on idempotency table with no authenticated policies
- [X] T005 **User task (Dashboard)**: Apply `*_ghl_outbound_send.sql` in SQL Editor on `bfwohzcugtwbhhxdqgme`; run `NOTIFY pgrst, 'reload schema';` — Migration applied via dashboard.
- [X] T006 Extend `getActiveGhlConnection` in `supabase/functions/_shared/ghlClient.ts` to select `outbound_enabled`; add `outbound_enabled` to `GhlConnectionRow` type in same file
- [X] T007 Scaffold `supabase/functions/ghl-send-message/index.ts` mirroring `ghl-mark-read/index.ts` (CORS headers, `json()` helper, JWT via `getUserFromRequest`, `requireOrgMember`, `serviceSupabase`)
- [X] T008 Implement request validation in `supabase/functions/ghl-send-message/index.ts`: require `organizationId`, `contactId`, `conversationId`, `type`, `message`, `requestId`; reject whitespace-only `message` with 400
- [X] T009 Implement `outbound_enabled` gate and idempotency logic in `supabase/functions/ghl-send-message/index.ts`: insert `pending` row in `ghl_send_idempotency`; on duplicate `request_id` return cached `completed` or 409 for `pending`/`failed` per [contracts/ghl-send-message.md](./contracts/ghl-send-message.md)
- [X] T010 Implement GHL `POST /conversations/messages` in `supabase/functions/ghl-send-message/index.ts` via `ghlFetch` with locked body from T002; omit `userId`; map errors to `{ ok, error, ghlStatus, ghlMessage }`; update idempotency row on success/failure
- [X] T011 **User task (Dashboard/CLI)**: Deploy `npx supabase functions deploy ghl-send-message --project-ref bfwohzcugtwbhhxdqgme` (do **not** use `--no-verify-jwt`) — Deployed via CLI.

**Checkpoint**: Edge function returns 403 when `outbound_enabled = false`; returns 200 with `messageId` when enabled and test payload valid (curl with JWT against test org)

---

## Phase 3: User Story 1 — Send a reply on the conversation's existing channel (Priority: P1) 🎯 MVP

**Goal**: Staff can type a reply and send it on the conversation's existing channel (SMS / WhatsApp / Email / etc.) without a channel picker

**Independent Test**: Open test conversation → compose text → Send → message arrives on test phone/email and appears in thread after re-fetch

- [X] T012 [P] [US1] Extend `GhlConnectionRow` and `fetchGhlConnection` select in `src/modules/ghl-inbox/api/ghlInbox.api.ts` to include `outbound_enabled`
- [X] T013 [P] [US1] Add `deriveConversationChannelType()` in `src/modules/ghl-inbox/lib/channelType.ts` mapping thread `messageType` values to GHL send `type` enum per [research.md](./research.md) §6
- [X] T014 [US1] Add `sendGhlMessage()` and `GhlSendMessageInput` / response types in `src/modules/ghl-inbox/api/ghlInbox.api.ts` invoking `ghl-send-message` Edge Function per [contracts/ghl-send-message.md](./contracts/ghl-send-message.md)
- [X] T015 [US1] Create `src/modules/ghl-inbox/hooks/useGhlSendMessage.ts`: React Query mutation calling `sendGhlMessage`; generate `crypto.randomUUID()` as `requestId` per attempt; invalidate `ghlInboxKeys.messages` and `ghlInboxKeys.conversations` on success
- [X] T016 [US1] Create `src/modules/ghl-inbox/components/GhlComposer.tsx`: textarea + Send button; accept `contactId`, `conversationId`, `channelType`, `outboundEnabled` props; call `useGhlSendMessage`
- [X] T017 [US1] Wire `GhlComposer` into `src/modules/ghl-inbox/components/GhlMessageThread.tsx` replacing `GhlReadOnlyComposer` import; pass `contactId`, derived `channelType`, and `outboundEnabled`
- [X] T018 [US1] Update `src/modules/ghl-inbox/pages/GhlInboxPage.tsx` to pass `outbound_enabled` from `useGhlConnection()` into `GhlMessageThread`

**Checkpoint**: US1 — end-to-end send works on test org with `outbound_enabled = true`; thread re-fetches sent message from GHL (read-through preserved)

---

## Phase 4: User Story 2 — See clear send states and recover from errors (Priority: P1)

**Goal**: Composing → sending → sent / error states are visible; failed sends preserve draft text

**Independent Test**: Observe sending indicator on send; simulate failure (bad credentials or network) and confirm draft remains + readable error shown

- [X] T019 [US2] Add explicit UI states in `src/modules/ghl-inbox/components/GhlComposer.tsx`: composing (default), sending (`isPending` — disable Send, read-only textarea), success (clear textarea), error (inline banner)
- [X] T020 [US2] Preserve composer draft text on mutation error in `src/modules/ghl-inbox/components/GhlComposer.tsx` (do not clear textarea in `onError`)
- [X] T021 [US2] Disable Send when trimmed message is empty in `src/modules/ghl-inbox/components/GhlComposer.tsx`; show inline validation hint
- [X] T022 [US2] Surface `ghlMessage` from Edge error response via inline error in `src/modules/ghl-inbox/components/GhlComposer.tsx`
- [X] T023 [US2] Add optimistic outbound bubble in `src/modules/ghl-inbox/hooks/useGhlSendMessage.ts` `onMutate` (temporary id `optimistic-{requestId}`); remove/replace on settle via query invalidation

**Checkpoint**: US2 — all send states visible; WhatsApp window / GHL rejection shows human-readable error; empty message not sendable

---

## Phase 5: User Story 3 — Never deliver duplicate messages (Priority: P1)

**Goal**: Double-click, rapid resubmit, or ambiguous retry never produces two customer messages

**Independent Test**: 20× double-click / retry stress attempts → exactly one GHL message per intentional send on test contact

- [X] T024 [US3] Disable Send button and ignore duplicate form submit while `isPending` in `src/modules/ghl-inbox/components/GhlComposer.tsx`
- [X] T025 [US3] Ensure each Send click generates a **new** `requestId` in `src/modules/ghl-inbox/hooks/useGhlSendMessage.ts`; retry after error must not reuse prior id
- [X] T026 [US3] Handle HTTP 409 (`Send already in progress` / reused request) in `src/modules/ghl-inbox/api/ghlInbox.api.ts` and `useGhlSendMessage.ts` with user-visible message
- [X] T027 [US3] **User task**: Run idempotency stress checklist in [quickstart.md](./quickstart.md) — 20 deliberate double-click/retry attempts; confirm zero duplicate messages in GHL — Idempotency verified: client double-click (layer 1) + same-requestId replay returned cached:true (layer 2).

**Checkpoint**: US3 — idempotency verified on test contact before any production org enablement

---

## Phase 6: User Story 4 — Organisation-scoped sending with shared voice (Priority: P2)

**Goal**: Sends use org A's credentials only; messages attributed to org default GHL sender, not individual Mason staff

**Independent Test**: Two staff members send from same org → both appear under org GHL identity; org B member cannot send via org A connection

- [X] T028 [US4] Audit `supabase/functions/ghl-send-message/index.ts` GHL request body: confirm `userId` is never sent; document in code comment referencing spec FR-003
- [X] T029 [US4] **User smoke**: Verify org isolation — member of org A cannot trigger send for org B; confirm JWT + `requireOrgMember` rejects cross-org `organizationId` — Verified by code inspection (live test not possible: sole admin is member of both orgs). requireOrgMember → isUserInOrganization → getMembership matches on BOTH user_id AND organization_id in organization_members, returns null for non-members; index.ts returns 403 before connection resolution. Future: live-test with a single-org user.

**Checkpoint**: US4 — multi-org isolation holds; no per-staff attribution fields in payload

---

## Phase 7: User Story 5 — Progressive enablement per organisation (Priority: P2)

**Goal**: Send disabled by default; enable per org only after clean test

**Independent Test**: Org with `outbound_enabled = false` shows non-sendable composer; org with `true` can send; enabling org A does not enable org B

- [X] T030 [US5] When `outboundEnabled === false`, render disabled composer with explanation copy in `src/modules/ghl-inbox/components/GhlComposer.tsx` (replace Phase 1 read-only label)
- [X] T031 [US5] Verify Edge returns 403 when `outbound_enabled = false` even if frontend bypassed — covered by T009; add **user smoke** step to [quickstart.md](./quickstart.md) checklist if missing
- [X] T032 [US5] **User task (Dashboard)**: Enable outbound for test org only via `UPDATE ghl_connections SET outbound_enabled = true WHERE organization_id = '<TEST_ORG>'`; Sears Melvin after clean test; Churchill last — Both orgs enabled; Churchill tested live on client number during call.

**Checkpoint**: US5 — feature flag kill switch works; production orgs remain disabled until explicit SQL enable

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Module hygiene, copy updates, security verification

- [X] T033 [P] Export new hook/component from `src/modules/ghl-inbox/index.ts` if module public surface requires it
- [X] T034 [P] Update list header copy in `src/modules/ghl-inbox/pages/GhlInboxPage.tsx` when `outbound_enabled` (remove "read-only" label where appropriate)
- [X] T035 Remove or repurpose `src/modules/ghl-inbox/components/GhlReadOnlyComposer.tsx` — delete if fully replaced by `GhlComposer.tsx`
- [X] T036 [P] Run `npm run lint` on touched paths under `src/modules/ghl-inbox/` and `supabase/functions/ghl-send-message/`
- [ ] T037 [P] Run full manual verification checklist in [quickstart.md](./quickstart.md); confirm PIT not visible in browser network tab during send — Deferred to post-launch. Core behavior proven by live sends (Sears Melvin own-number, Churchill client-number on call); PIT-server-only verified by code inspection. Formal checklist (network-tab PIT check, multi-channel matrix, webhook <10s refresh) to be walked during pilot monitoring.
- [X] T038 [P] Grep `src/modules/inbox/` — confirm zero changes to unified inbox module (parallel module constraint)

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 (Gates G1–G3) → Phase 2 (Foundational) → US1 → US2 → US3 → US4 → US5 → Polish
```

T002 blocks T010 (locked GHL body). T004–T005 block T009 (idempotency table). T011 blocks T014+ (frontend invoke). US2/US3 depend on US1 composer existing but can be implemented incrementally on same files.

### User story dependencies

| Story | Depends on | Can start after |
|-------|------------|-----------------|
| US1 (P1) | Phase 2 complete + T011 deployed | T018 = MVP send |
| US2 (P1) | US1 composer exists | T019–T023 refine same files |
| US3 (P1) | US1 + T009 idempotency edge | T024–T027 client + verification |
| US4 (P2) | Phase 2 edge function | T028–T029 audit/smoke |
| US5 (P2) | US1 composer | T030–T032 flag UX + rollout |

### Parallel opportunities

**Phase 2** (after T007):

```text
T006 ghlClient.ts          ||  T007 scaffold ghl-send-message/index.ts
```

**Phase 3 US1** (after T011):

```text
T012 ghlInbox.api.ts types  ||  T013 channelType.ts
         ↓                           ↓
              T14 sendGhlMessage → T15 hook → T16 composer
```

**Polish**:

```text
T033 index.ts  ||  T034 GhlInboxPage  ||  T036 lint  ||  T037 quickstart  ||  T038 grep inbox
```

---

## Parallel Example: User Story 1

```bash
# After T011 deploy, launch in parallel:
Task T012: Extend GhlConnectionRow in src/modules/ghl-inbox/api/ghlInbox.api.ts
Task T013: Add deriveConversationChannelType in src/modules/ghl-inbox/lib/channelType.ts

# Then sequential:
Task T014: sendGhlMessage in ghlInbox.api.ts
Task T015: useGhlSendMessage.ts
Task T016: GhlComposer.tsx
Task T017: GhlMessageThread.tsx
Task T018: GhlInboxPage.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 gates (T001–T003) — **do not skip G1/G2**
2. Complete Phase 2 (T004–T011) — migration + Edge Function deployed
3. Complete Phase 3 US1 (T012–T018)
4. **STOP and VALIDATE**: Send to developer test contact only; `outbound_enabled = true` on test org only
5. Add US2 + US3 before enabling any live business org

### Incremental Delivery

1. Gates + Foundational → Edge send path live behind `outbound_enabled = false`
2. US1 → first successful test send (MVP)
3. US2 → production-quality error UX
4. US3 → idempotency sign-off (required before go-live)
5. US4 + US5 → isolation audit + per-org rollout
6. Polish → lint, copy, module exports

### Rollout order

```text
Test sub-account (own phone) → Sears Melvin → Churchill. Actual: Sears Melvin enabled first and tested (own number); Churchill enabled and live-tested on a client number during the 2026-06 client call (deliberate, with client present).
```

Instant kill switch: `UPDATE ghl_connections SET outbound_enabled = false`

---

## Notes

- `[P]` tasks = different files, no incomplete-task dependencies
- `[USn]` maps to [spec.md](./spec.md) user stories
- User/operator tasks marked explicitly — Cursor does not apply production migrations or enable flags without instruction
- (Resolved) Churchill sends were gated behind T027 idempotency verification; T027 passed and Churchill was enabled and live-tested during the client call.
- Copy GHL location IDs via UI copy button only (I vs l transcription risk)
- Secrets in Bitwarden only — never commit or paste PITs in chat
