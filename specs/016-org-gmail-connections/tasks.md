# Tasks: Org-level Email (Gmail) Connections

**Input**: Design documents from `specs/016-org-gmail-connections/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: The spec does not request automated tests, and the repo has no edge-function test harness.
Verification is **manual**, per `quickstart.md` V1–V6. No contract/integration test tasks are emitted;
verification tasks reference the quickstart checks instead.

**Organization**: Grouped by user story (US1/US2/US3/US4) per spec priorities. US1, US2, US4 are P1;
US3 is P2. Foundational work (import fix, RLS, migration) blocks the stories.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: can run in parallel (different files, no dependency)
- **[Story]**: US1 / US2 / US3 / US4 (or FOUND / SETUP / POLISH)
- Exact paths included. Multi-tenancy guardrails apply: migrations run by the **maintainer** in the
  Supabase Dashboard SQL editor (no `db push`); edge functions deploy via `supabase functions deploy`;
  never test-write to Churchill (LIVE) — use SM (pre-launch) or a test org.

---

## Phase 1: Setup / Live-state investigation (research VERIFY items)

**Purpose**: confirm the assumptions the design flagged before writing code. All read-only.

- [x] T001 [P] [SETUP] Verified `_shared/*` exports match all three functions' imports (auth,
  organizationMembership, gmailBody, autoLinkConversation) — T006 is a pure path change. (research D1)
- [x] T002 [P] [SETUP] Verified standalone `gmail-oauth` is legacy — unreferenced in `src/`; frontend
  uses only `gmail-oauth-start`. **Confirmed by maintainer**: live authorization URL carries
  `redirect_uri=…/functions/v1/gmail-oauth-callback`, so `gmail-oauth-callback` is the live callback.
  No delete (out of scope). (research D6)
- [x] T003 [P] [SETUP] Verified **no scheduled/cron Gmail sync** exists (no config/pg_cron/`.github`;
  frontend-triggered only). → T017 no-op. (research D5)
- [x] T004 [P] [SETUP] Read live `pg_policies`. **Finding**: `gmail_connections` clean (4 org-scoped);
  `inbox_conversations`/`inbox_messages` SELECT+UPDATE gate **email by `user_id`** via a CASE branch →
  T007 is a required migration. (research D9 / FR-015)
- [x] T005 [P] [SETUP] Confirmed index-swap preconditions on LIVE: (a) 0 active rows with null org;
  (b) no org with >1 active row; (c) exactly one active row per org — SM `info@searsmelvin.co.uk`,
  Churchill `kotchlamazashvili.giorgi.usa@gmail.com`. Migration Step-1 guard will pass. (FR-012)
- [x] T004b [SETUP] Checked null-org `channel='email'` rows: **0 conversations, 0 messages** → T007 is
  a pure policy swap, no backfill.

**Checkpoint**: assumptions confirmed or discrepancies logged; proceed to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: nothing deploys until T006 lands; the OAuth story (US3) needs `oauth_state` + the
per-org invariant from T008–T009.

- [x] T006 [FOUND] **Prerequisite import fix (FR-014)** — changed local `./…` imports to `../_shared/…`
  in `gmail-send-reply`, `gmail-send-first-message`, `gmail-sync-now` (auth, organizationMembership,
  gmailBody, autoLinkConversation). Verified no `./`-local imports remain. (Bundle confirmation on
  deploy in T014/T018.)
- [ ] T007 [FOUND] **Close the email RLS gap (FR-015) — REQUIRED migration** (T004 finding, not a
  no-op). `gmail_connections` = clean (4 org-scoped policies). But `inbox_conversations` and
  `inbox_messages` **SELECT + UPDATE** policies use `CASE WHEN channel='email' THEN user_id=auth.uid()
  ELSE user_is_member_of_org(organization_id) END` on role `{public}` — i.e. **email is still
  per-user at the DB layer**, so non-connector members cannot see the org's email threads (this gates
  US1 visibility / V1, independent of the frontend).
  **AUTHORED**: `supabase/migrations/20260703143000_inbox_email_org_rls.sql` — uses `ALTER POLICY`
  (in-place, preserves role `public`, name, command; only the email arm changes → non-email behavior
  byte-identical), with per-step run-gate verification + a Step-0 null-org safety recheck. **Awaiting
  maintainer Dashboard run.** Blocks US1 visibility (T015) and US2 read-back (T019).
- [x] T008 [FOUND] [US4] **AUTHORED** `supabase/migrations/20260703143100_gmail_org_connection.sql`:
  PART A precondition selects → verify per-user index → drop → verify → create per-org partial unique
  index → verify invariant; PART B additive `oauth_state` (+ expiry index, RLS deny-all, comment) →
  verify. Run-gate annotated (EXPECT after each statement); rollback block included. Awaiting T009 run.
- [ ] T009 [FOUND] [US4] **Maintainer** runs T008's migration in the Supabase Dashboard SQL editor in
  one session, statement-by-statement, showing output at each step; abort if Step 1 raises. Verifies
  against Churchill (LIVE) + SM. (Guardrails: no `db push`; ID-scoped; re-verify.)

**Checkpoint**: functions bundle; RLS confirmed org-scoped; per-org unique index + `oauth_state` live.

---

## Phase 3: User Story 1 — Any org member can read + reply (Priority: P1) 🎯 MVP

**Goal**: a non-connector org member sees the org's email threads and sends replies from the org
mailbox. **Independent test**: quickstart **V1** (+ V2 for no-cross-tenant).

- [x] T010 [US1] Re-scoped `gmail-send-reply/index.ts`: conversation by id only; `orgId =
  conversation.organization_id` + `isUserInOrganization` guard moved up; message-history drops
  `user_id`; connection resolved by `.eq('organization_id', orgId).eq('status','active')`;
  `preferredConnectionId` hint + user-scoped fallback + redundant org-mismatch guard removed;
  `resolveOrganizationIdForUser` import dropped. Verified no dangling refs. (FR-003/004/005/006)
- [x] T011 [US1] `gmail-send-reply`: token refresh HTTP 400 + `invalid_grant` → set org connection
  `status='revoked'` (+ "reconnect required" 502); transient → 502 unchanged. (FR-016)
- [x] T012 [P] [US1] Re-scoped `gmail-send-first-message/index.ts` identically (reordered
  conversation→org→membership→connection-by-org; dropped `user_id` filters + `resolveOrganizationIdForUser`;
  org mailbox `From:`; new-thread compose + `external_thread_id` stamp preserved; `invalid_grant →
  revoked`). Verified no dangling refs. (FR-003/004/005/006/016)
- [x] T013 [P] [US1] FR-018 guard: confirmed no `user_id` filter on conversation/message queries;
  added anti-regression comments in `inboxConversations.api.ts` (`fetchConversations`) and
  `inboxMessages.api.ts` (`fetchMessagesByConversation`). (FR-018)
- [x] T010b [P] [US1] Org-scoped the two Gmail **read-path** functions, same pattern as T010:
  `gmail-fetch-message-html/index.ts` and `gmail-refresh-body/index.ts`. (1) **Import fix (FR-014,
  same as commit 6c59aa1)**: both imported local `./auth.ts` / `./gmailBody.ts` (undeployable) →
  `../_shared/…`. (2) **Org from the row, never the caller**: `fetch-message-html` looks up the
  `inbox_messages` row by `meta->gmail->messageId` and reads `organization_id` (backend-only lookup,
  no frontend change — the caller still passes only `messageId`); `refresh-body` derives the org from
  its `message_id` (Gmail id) or `conversation_id` param, and now **requires** one of them (400 if
  neither — cannot scope an org connection without a row). (3) **Membership guard**:
  `isUserInOrganization(caller, orgId)` → mirror T010's 404 shape (same "not found" for missing row
  and non-member, no existence leak). (4) **Connection by `.eq('organization_id', orgId)
  .eq('status','active')`** — dropped the `user_id` filter, no fallback. (5) `refresh-body` eligible-
  rows + preview-max queries re-scoped from `user_id` to `organization_id` (shared-inbox backfill).
  (6) `invalid_grant → revoked` in both token-refresh blocks (same as T011). Verified no `user_id`
  filters or `./`-local imports remain. Deploy with the US1 batch (see T014). (FR-003/004/005/006/014/016)
- [x] T014 [US1] Deployed `gmail-send-reply`, `gmail-send-first-message`, `gmail-fetch-message-html`,
  and `gmail-refresh-body` (`supabase functions deploy …`); read-path org-scoping fix in commit a2276c3.
  Depends on T006, T009, T010–T012, T010b.
- [x] T015 [US1] Verified quickstart **V1** end-to-end (visibility in the list, org-mailbox send,
  delivery, body rendering) and **V2** (SM send uses SM's connection only; no-connection org → clean
  error). (SC-001, SC-003, SC-004-list-visibility)

**Checkpoint**: US1 shippable — email is a shared org channel for send + visibility.

---

## Phase 4: User Story 2 — Incoming email syncs into the shared org inbox (Priority: P1)

**Goal**: sync polls the org's connection and stamps `organization_id` on all inserts; all members
see synced threads. **Independent test**: quickstart **V4**.

- [x] T016 [US2] Re-scoped `supabase/functions/gmail-sync-now/index.ts` per
  `contracts/gmail-sync-now.md`: **target org comes from the request body** (`organizationId`), not
  inferred from the caller — the maintainer belongs to both Churchill + SM, so first-membership
  inference could sync the wrong org. Missing `organizationId` → 400; `isUserInOrganization(caller,
  org)` → 403 otherwise; **no** first-membership fallback (dropped `resolveOrganizationIdForUser`).
  Connection polled by `.eq('organization_id', orgId).eq('status','active')` (dropped the `user_id`
  filter); no active connection → clean 200 no-op `{ ok, synced: 0, reason: 'no_active_connection' }`;
  `tenantOrgId = connection.organization_id` stamped on all inserts (already in place);
  `invalid_grant → revoked`; `last_synced_at`-on-success preserved. Org-scoped dedup/thread-match:
  dropped `user_id` from all four INBOX lookups (dup + debug + thread-match + meta-fallback) and both
  SENT lookups, keying on `organization_id` (+ `gmail_connection_id` + `external_message_id` for
  messages, `external_thread_id` for threads); inserts keep `user_id` as provenance. **Frontend:**
  `syncGmail` (`inboxGmail.api.ts`) now requires `organizationId`; `useSyncGmail` passes the active
  org from `OrganizationContext`. Deploy in T018. (FR-007/013/016)
- [x] T017 [US2] ~~Scheduled sync conversion~~ — **VERIFIED none exists** (no cron/pg_cron/config/
  `.github`; `gmail-sync-now` is frontend-triggered only). No-op; adding a scheduler is out of scope.
- [x] T018 [US2] Deployed `gmail-sync-now` (commit 561f8a0). No scheduled sync entrypoint exists
  (T017). Depends on T006, T009, T016.
- [x] T019 [US2] Verified quickstart **V4**: sync clean under continuous auto-poll + real inbound
  traffic; new conversations/messages carry the org's `organization_id` and are visible to a second
  org member; **zero** new same-thread duplicates since deploy. The single pre-deploy duplicate
  (empty shell `ae251f9a…`) was removed manually with dry-run/re-verify. (SC-004)

**Checkpoint**: US1 + US2 = a working shared org email channel (send + receive).

---

## Phase 5: User Story 3 — Admin connects/disconnects from org settings (Priority: P2)

**Goal**: an admin connects/disconnects the org mailbox; non-admins are refused server-side; the
connect flow is not forgeable. **Independent test**: quickstart **V3** (+ **V5** revoked indicator).

- [x] T020 [US3] `supabase/functions/gmail-oauth-start/index.ts` per `contracts/gmail-oauth-connect.md`:
  after JWT auth, add the admin check (`organization_members` role='admin' → `organization_id`; 403
  otherwise); **create a service-role client** and persist an `oauth_state` row
  `{ nonce, user_id, organization_id, expires_at=now()+10min }`; set redirect `state = base64({nonce})`
  only (no identity in payload); opportunistically prune `expires_at < now()`. (FR-008)
- [x] T021 [US3] `supabase/functions/gmail-oauth-callback/index.ts` per the same contract: atomically
  consume the nonce (`update oauth_state set consumed_at=now() where nonce=? and consumed_at is null
  and expires_at>now() returning user_id, organization_id`; zero rows → `invalid_state`); take
  identity from the **record** (never state); re-run the admin check on the record ids (→ `forbidden`);
  org-scoped revoke (`.eq('organization_id', orgId).eq('status','active')`); insert active row stamped
  org + user. Replaces the earliest-membership lookup and the `user_id`-scoped revoke. (FR-008/009)
- [x] T022 [US3] Disconnect gating (**DECIDED: dedicated edge function**): add
  `supabase/functions/gmail-disconnect/index.ts` (POST, JWT) running the same admin check
  (`organization_members` role='admin' → `organization_id`) and setting the org's active row to
  `status='revoked'` with an explicit `.eq('organization_id', orgId)` filter (service-role bypasses
  RLS). Frontend `disconnectGmail` (T024) calls it via `supabase.functions.invoke`. (FR-010/011)
- [x] T023 [US3] Deploy `gmail-oauth-start`, `gmail-oauth-callback` (+ `gmail-disconnect` if T022).
  Depends on T006, T009 (needs `oauth_state`), T020–T022.
- [x] T024 [US3] Frontend `src/modules/inbox/api/gmailConnections.api.ts`: change
  `fetchActiveGmailConnection` to fetch the **org's** connection (drop `user_id`; scope by current org,
  return `email_address` + `status`, including the `revoked` row for the indicator); `getGmailOAuthUrl`
  surfaces the 403 as "Admin access required to connect Gmail"; disconnect calls `gmail-disconnect`
  (or the gated client update per T022). (FR-008/010/011/017)
  DONE: org-scoped fetch (kept `status='active'` filter — the revoked-row "reconnect required"
  indicator moves to T025); `{ organizationId }` body on `gmail-oauth-start` + `gmail-disconnect`
  invokes with 401/403/generic error surfacing (`noActiveConnection` = success); org id in the
  React Query key (`gmailConnectionKeys.active(orgId)`). `npx tsc --noEmit` clean.
- [x] T025 [US3] Move the connect/disconnect status component into the org-settings surface, visible to
  admins (`isOrgAdmin` from `OrganizationContext`, cosmetic gate); show connected mailbox, Connect
  (admin) / Disconnect (admin), and a **"reconnect required"** indicator when the org connection is
  `revoked` or absent. (FR-011/017) `npx tsc --noEmit` clean.
  DONE: extended `GmailConnectionStatus` (already mounted in Settings → Integrations) rather than
  mounting the Card-based panel — deleted dead `GmailConnectionPanel.tsx`. `isAdmin` prop mirrors
  `WhatsAppConnectionStatus` (non-admins: disabled read-only pill with status label); admins get
  mailbox + last-synced + amber **"Reconnect required"** state with a Reconnect action, and
  disconnect behind an `AlertDialog` confirm. Deferred T024 item landed: `fetchOrgGmailConnection`
  (renamed) now includes the newest `revoked` row ('active' sorts first, so the unique active row
  wins); consumers gate on `status==='active'` (inbox auto-sync poll, `hasGmailConnection`).
  Inbox empty-state copy points to Settings; added `?error=<code>` toast handling next to the
  `?gmail=connected` handler on `UnifiedInboxPage` (callback failure redirects were silent).
  `npx tsc --noEmit` clean.
- [x] T026 [US3] Verify quickstart **V3** (admin connect → 1 active row; non-admin `-start` → 403;
  forged/replayed `state` → `invalid_state`, no insert; reconnect retires prior active row) and **V5**
  (invalid_grant → revoked → "reconnect required" shown). (SC-005, FR-016/017)
  DONE: lifecycle verified on test org `15486fe5`, not SM; SM's connection verified untouched
  throughout.

**Checkpoint**: full connect/disconnect lifecycle, admin-gated and non-forgeable.

---

## Phase 6: User Story 4 — Migration to the org model (Priority: P1)

US4's implementation is the migration authored/run in **T008–T009** (Foundational, because US3 depends
on `oauth_state` and the per-org invariant). This phase is its **independent verification**.

- [x] T027 [US4] Verify quickstart migration checks: Step 1 precondition prints OK against live data;
  Step 3 index builds with no violation; Step 4 shows every org with exactly one active row; Step 6
  shows `oauth_state` exists with RLS enabled and 0 rows. (SC-002, FR-001/012)
  DONE: all checks ran (and passed) during the T009 Dashboard session.

**Checkpoint**: one active connection per org enforced; `oauth_state` ready.

---

## Phase 7: Polish & Cross-Cutting

- [x] T028 [POLISH] Full quickstart pass V1–V6 against SM + a test org (never Churchill writes);
  capture results. DONE: V1–V6 verified (V5 invalid_grant flip proven live on test org; V5.3
  verified by review; V3.3 superseded per quickstart edit). APP_URL set to
  staging.unifynow.digital; gmail_connections token-column privileges narrowed
  (20260704153000_gmail_connections_column_privileges.sql).
- [x] T029 [POLISH] `npx tsc --noEmit` clean and `npm run lint` on the frontend changes before
  merging to `staging`. DONE: tsc clean; lint clean on all 016-touched files; 7 pre-existing lint
  errors in unrelated files noted to housekeeping.
- [x] T030 [POLISH] Once deployed + verified, update `specs/mason-pentest-summary.md`: move the
  "gmail-oauth-callback trusts unsigned OAuth state" item from OPEN (HIGH) to FIXED, referencing the
  deployed `gmail-oauth-start`/`-callback` + `oauth_state`. DONE 2026-07-04: entry flipped to FIXED
  with T026 evidence; new FIXED entry added for the token-column privilege narrowing.
- [ ] T031 [P] [POLISH] Add an `oauth_state` expired-row cleanup path if not already covered by T020's
  opportunistic prune (optional periodic job).

---

## Dependencies & Execution Order

### Phase order
- **Setup (P1 tasks T001–T005)**: read-only, run first, all `[P]`.
- **Foundational (T006–T009)**: T006 (imports) blocks every deploy; T008→T009 (migration author→run)
  blocks US3 and US4 verification. **T007 (email RLS migration) is REQUIRED, not a no-op** — it gates
  the frontend read/visibility for email; **T004b** must resolve before T007 is authored.
- **US1 (T010–T015)** and **US2 (T016–T019)**: send/sync code depends on T006 + T009; **the
  visibility/read-back acceptance (T015 V1 "sees the thread", T019) additionally depends on T007**
  (email RLS). Send itself (service-role) does not need T007. Each story is independently shippable
  once its deps land.
- **US3 (T020–T026)**: depends on T006 + T009 (needs `oauth_state`). P2 — after US1/US2 or in parallel.
- **US4 verify (T027)**: after T009.
- **Polish (T028–T031)**: after the stories being shipped are complete.

### Key intra-story dependencies
- T010 → T011 (same file, sequential). T010/T011 vs T012 → different files, `[P]`.
- T014 depends on T010–T012 + T006 + T009. T018 depends on T016 + T006 + T009.
- T020 → T021 (callback consumes what start persists) → T023 deploy. T024/T025 (frontend) after T023
  for end-to-end, but can be written in parallel with T020–T022.
- T009 (maintainer Dashboard run) gates T014, T018, T023, T027.

### Parallel opportunities
- All of T001–T005 together.
- T012 ∥ T010/T011 (send-first-message vs send-reply). T013 ∥ both (frontend audit).
- US1 ∥ US2 once Foundational is done. Frontend T024/T025 ∥ backend T020–T022.

## Implementation Strategy

- **MVP = Foundational + US1** (T006–T015): fixes the live SM send failure and makes email a shared
  read/send channel. Stop and validate (V1/V2) before proceeding.
- **Then US2** (shared receive), **then US3** (admin connect/disconnect + close the HIGH pentest
  finding). US4's migration lands in Foundational and is verified in T027.
- Commit after each task or logical group. Never test-write to Churchill.

## Notes
- No automated tests emitted (none requested; manual verification via quickstart V1–V6).
- Open design flag still to confirm before T022: disconnect via dedicated edge function (recommended)
  vs. gated client update (research Open Question 1).
- FR-016 (`invalid_grant → revoked`) is implemented in T011 (send-reply), T012 (send-first-message),
  and T016 (sync) — three sites, one rule.
