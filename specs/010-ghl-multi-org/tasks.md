# Tasks: GHL Inbox — Multi-org support

**Input**: Design documents from `specs/010-ghl-multi-org/`  
**Prerequisites**: plan.md, spec.md, data-model.md, quickstart.md; Phase 1 code on staging (`009-ghl-inbox-readonly`)

**Tests**: Not requested — manual verification per quickstart.md only.

**Organization**: Tasks grouped by user story. **MVP** = Phase 1 + 2 + US1 + US2 + user seed/deploy steps through T018.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature docs and branch context

- [X] T001 Create `specs/010-ghl-multi-org/` docs (`spec.md`, `plan.md`, `data-model.md`, `quickstart.md`) aligned with settled decisions
- [X] T002 [P] Add `specs/010-ghl-multi-org/contracts/ghl-credentials.md` documenting `get_ghl_api_key`, deprecated Edge secrets, and per-org `ghlFetch(pit)` contract for Edge callers
- [X] T003 [P] Update `specs/009-ghl-inbox-readonly/quickstart.md` with a short pointer to `010-ghl-multi-org` for multi-org credential setup (no change to Phase 1 behaviour docs beyond deprecation note)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Encrypted column, decrypt RPC, column-level isolation — **MUST complete before Edge refactor**

**Schema discipline**: Cursor commits migration SQL only. **User** applies on `bfwohzcugtwbhhxdqgme` via Dashboard. Cursor must **not** `db push` / `migration up` to production.

- [X] T004a Create migration `supabase/migrations/YYYYMMDDHHmmss_ghl_connections_api_key.sql`: enable `extensions.pgcrypto` if needed; add `ghl_api_key bytea` to `public.ghl_connections`; comment that plaintext PITs are never stored
- [X] T004b In same migration: `revoke select (ghl_api_key) on public.ghl_connections from authenticated, anon` (and `public` if required) so client `select` cannot read ciphertext
- [X] T004c In same migration: implement `public.get_ghl_api_key(connection_id uuid, encryption_key text) returns text` as **SECURITY DEFINER** with `set search_path = ''`, using `extensions.pgp_sym_decrypt(ghl_api_key, encryption_key)`; raise if `encryption_key` empty; `grant execute` to `service_role` only; `revoke all` from `public`, `authenticated`, `anon`
- [ ] T005 **User task (Dashboard)**: Review and apply `*_ghl_connections_api_key.sql` in SQL Editor on `bfwohzcugtwbhhxdqgme`
- [ ] T006 **User task (Dashboard)**: Create Edge secret `GHL_API_KEY_ENCRYPTION_KEY` (strong random) — sole encryption key source (no Postgres GUC)
- [ ] T007 **User task (Dashboard)**: Confirm `GHL_API_KEY` and `GHL_LOCATION_ID` secrets remain present but are **deprecated** (not deleted — rollback safety)

**Checkpoint**: Migration applied; `select get_ghl_api_key('<connection_uuid>', '<encryption-key>')` returns PIT after seed; authenticated cannot read `ghl_api_key` column

---

## Phase 3: User Story 1 — Per-org encrypted credential storage (Priority: P1)

**Goal**: Database holds per-org encrypted PITs; decryption is service-role-only via RPC + key parameter

**Independent test**: Service role RPC returns decrypted PIT for seeded connection; browser query for connection metadata never includes `ghl_api_key`

- [X] T008 [US1] Update `specs/010-ghl-multi-org/data-model.md` with RPC signature `(connection_id, encryption_key)`
- [X] T009 [US1] Change `fetchGhlConnection` in `src/modules/ghl-inbox/api/ghlInbox.api.ts` to explicit `select` list **excluding** `ghl_api_key` (e.g. `id, organization_id, ghl_location_id, status, last_verified_at, created_at, updated_at`)
- [ ] T010 [US1] **User task (Dashboard)**: Run seed SQL from `quickstart.md` — `update` Churchill row with `pgp_sym_encrypt('<pit>', '<encryption-key>')`; verify `get_ghl_api_key(id, '<encryption-key>')` returns non-null

**Checkpoint**: US1 — credential storage and client isolation verified before Edge deploy

---

## Phase 4: User Story 2 — Edge functions use connection-scoped PIT (Priority: P1) 🎯 MVP

**Goal**: Remove global `GHL_API_KEY` / `GHL_LOCATION_ID` reads; each request uses org connection + decrypted PIT

**Independent test**: With legacy `GHL_API_KEY` unset or invalid, `ghl-fetch` `listConversations` still succeeds for an org whose row has `ghl_api_key` set

- [X] T011 [US2] Refactor `supabase/functions/_shared/ghlClient.ts`: remove `ghlApiKey`, `envLocationId`, `locationMatchesEnv`; change `ghlFetch(path, apiKey, init?)`; add `getActiveGhlConnectionWithKey` reading `Deno.env.get('GHL_API_KEY_ENCRYPTION_KEY')` and `.rpc('get_ghl_api_key', { p_connection_id, p_encryption_key })`
- [X] T012 [US2] Update `supabase/functions/ghl-fetch/index.ts`: use `getActiveGhlConnectionWithKey`; pass `apiKey` into every `ghlFetch` call; use `connection.ghl_location_id` for `listConversations`
- [X] T013 [US2] Update `supabase/functions/ghl-mark-read/index.ts`: same pattern as T012 (per-org `apiKey` on all GHL calls)
- [X] T014 [P] [US2] Audit `supabase/functions/ghl-webhook/index.ts`: confirm no `ghlFetch` / `GHL_API_KEY`; add comment that `locationId` routing supports multi-org
- [ ] T015 **User task (Dashboard)**: Deploy `ghl-fetch` and `ghl-mark-read` to `bfwohzcugtwbhhxdqgme`

**Checkpoint**: US2 — Edge uses per-org PIT; no `GHL_API_KEY`, `GHL_LOCATION_ID`, or `locationMatchesEnv` in `supabase/functions/`

---

## Phase 5: User Story 3 — Dual-org production readiness (Priority: P1)

**Goal**: Churchill + Sears Melvin both operational with isolated data

**Independent test**: quickstart.md smoke table passes for both orgs

- [ ] T016 **User task (Dashboard)**: `insert` Sears Melvin `ghl_connections` row per `quickstart.md` (no values in repo)
- [ ] T017 [US3] **User smoke**: Churchill member → `/dashboard/ghl-inbox` loads Churchill data only
- [ ] T018 [US3] **User smoke**: Sears Melvin member → `/dashboard/ghl-inbox` loads Sears data only
- [ ] T019 [US3] **User smoke**: Mark as read in each org
- [ ] T020 [US3] **User smoke**: RLS — org A member cannot see org B conversations

**Checkpoint**: US3 — two live orgs on one deployment

---

## Phase 6: User Story 4 — Secrets and documentation (Priority: P2)

**Goal**: Operators know new secret + deprecated globals

**Independent test**: `contracts/ghl-credentials.md` and quickstart list `GHL_API_KEY_ENCRYPTION_KEY` and deprecation

- [X] T021 [P] [US4] Add deprecation comments at top of `supabase/functions/_shared/ghlClient.ts` referencing removed env vars

**Checkpoint**: US4 — docs match deployed behaviour

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Security verification and repo hygiene

- [ ] T022 [P] Run `npm run build` and grep `dist/` for PIT / `GHL_API_KEY` literals — expect no matches
- [X] T023 [P] Grep `supabase/functions/` for `GHL_API_KEY`, `GHL_LOCATION_ID`, `locationMatchesEnv`, `ghlApiKey`, `app.ghl_encryption_key` — expect no matches after US2
- [ ] T024 [P] Run `npm run lint` on touched paths
- [X] T025 Confirm `src/modules/inbox/` unchanged (no multi-org credential coupling)

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 (Setup) → Phase 2 (Foundational) → US1 → US2 → US3 → US4 → Polish
```

### User story dependencies

| Story | Depends on | Can start after |
|-------|------------|-----------------|
| US1 | Phase 2 migration in repo | T004a–T004c |
| US2 | US1 Churchill seed | T010 + T005–T006 |
| US3 | US2 deployed + Sears row | T015–T016 |
| US4 | US2 complete | T011–T014 |

### Parallel opportunities

- **Phase 1**: T003 (after T001–T002 done)
- **US2**: T012 + T013 parallel after T011
- **Polish**: T022 + T023 + T024 parallel

---

## Implementation strategy

### MVP first

1. Phase 1 + 2 (T003–T007, user T005–T007)
2. US1 (T009–T010)
3. US2 (T011–T015)
4. **STOP** — validate Churchill before Sears (T016–T020)
5. US4 + Polish

---

## Task summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 25 |
| **Phase 1** | 3 |
| **Phase 2** | 6 (3 migration + 3 user Dashboard) |
| **US1** | 3 |
| **US2** | 5 (+1 user deploy) |
| **US3** | 5 |
| **US4** | 1 |
| **Polish** | 4 |
| **Suggested MVP scope** | T003–T015 + user T005–T007, T010, T015 |
| **Format validation** | All tasks use `- [ ] Tnnn [P]? [USn]? Description with path` |
