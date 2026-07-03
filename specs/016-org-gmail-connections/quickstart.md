# Quickstart: Org-level Gmail Connections

How to build, deploy, and verify this feature. **Churchill is LIVE** — do not test-write to it. Use
**SM (pre-launch)** and/or a test org for writes.

## Deploy order (dependencies matter)

1. **Prerequisite — import fix (FR-014)**. Fix `_shared` import paths in `gmail-send-reply`,
   `gmail-send-first-message`, `gmail-sync-now`. Until this lands nothing else can redeploy.
   Verify locally that each function bundles.
2. **RLS verification (FR-015)**. Confirm live policies on `gmail_connections`,
   `inbox_conversations`, `inbox_messages` are org-scoped (`user_is_member_of_org`). Close any gap
   with a migration before proceeding.
3. **Migration — one active per org + `oauth_state` (FR-001/008/012)**. In the Supabase Dashboard SQL
   editor, run the steps in `contracts/migration-one-active-per-org.md` in order, in one session:
   precondition guard → drop per-user index → create per-org index → post-verify → create `oauth_state`
   → post-verify. Abort and consult maintainer if the guard raises. `oauth_state` must exist before the
   OAuth functions are deployed.
4. **Edge functions** (`supabase functions deploy <name>`), in any order after steps 1 & 3:
   `gmail-send-reply`, `gmail-send-first-message`, `gmail-sync-now`, `gmail-oauth-start`,
   `gmail-oauth-callback` (+ `gmail-disconnect` if adopted).
5. **Frontend** — connection API re-scoping + org-settings surface; `npx tsc --noEmit` clean, then
   ship.

## Build / typecheck

```bash
npm run build        # transpiles only — does NOT typecheck
npx tsc --noEmit     # run separately; must be clean before merging to staging
npm run lint
```

## Verification (maps to Success Criteria)

### V1 — any member can see + send (SC-001, SC-004; US1)
1. Ensure SM has one active connection (`info@searsmelvin.co.uk`).
2. Sign in as an SM member who is **not** the connection's `user_id` owner.
3. Open the inbox → the SM email conversation **appears in the list** (was hidden).
4. Open it, send a reply → **HTTP 200**, delivered from `info@searsmelvin.co.uk`, message appears in
   the thread. (Previously 404.)
5. Start a first email in a no-prior-email conversation → `gmail-send-first-message` succeeds.

### V2 — no cross-tenant send (SC-003; FR-013)
1. With SM and a test org each holding their own active connection, send from an SM conversation.
2. Confirm (function logs / delivered `From:`) the SM connection was used — never the other org's.
3. Point a conversation at an org with **no** active connection → clear no-connection error, no
   fallback.

### V3 — admin connect gate (SC-005; US3)
1. As an org **admin**, connect from org settings → exactly one active row for the org (post-verify
   query shows count = 1).
2. As a **non-admin**, call `gmail-oauth-start` directly → **403**.
3. The `state` carries no org id to forge — it is only an opaque single-use nonce; identity is
   resolved server-side from `oauth_state`. Verify instead: forged/garbage `state` to
   `gmail-oauth-callback` → `invalid_state` redirect; replayed already-consumed nonce →
   `invalid_state` redirect; no row inserted in either case.
4. Connect again as admin while an active row exists → prior active row becomes `revoked`, still one
   active row.

### V4 — sync stamps org (SC-004; US2)
1. Trigger `gmail-sync-now` for the org.
2. Newly inserted `inbox_conversations`/`inbox_messages` carry the org's `organization_id`.
3. A second org member sees the synced threads.

### V5 — revoked on invalid_grant (FR-016/017)
1. Simulate a permanent token failure (revoke the Google grant, or point at a stale refresh token).
2. Send/sync → connection flips to `status='revoked'`; org settings shows **"reconnect required"**.
3. Transient failure (5xx) → status stays `active`.

### V6 — deployability (SC-006; FR-014)
- All three send/sync functions deploy without unresolved `_shared` import errors.

## Rollback

- Migration: `drop index …_one_active_per_org;` then recreate `…_one_active_per_user`.
- Functions: redeploy the previous version (note deployed versions predate the repo import fix, so a
  clean rollback still requires FR-014).
