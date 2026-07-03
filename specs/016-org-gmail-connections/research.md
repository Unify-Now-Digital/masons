# Phase 0 Research: Org-level Gmail Connections

Grounded in a read of the live code (2026-07-03). Each decision records what the code currently does,
the chosen approach, and rejected alternatives. Items marked **VERIFY (live)** require checking the
running database because the repo migrations may lag deployed state.

## D1. `_shared` import-path fix (prerequisite, blocking)

**Current state**: `gmail-send-reply`, `gmail-send-first-message`, `gmail-sync-now` import local
sibling files that do not exist in their own directories:
- `./auth.ts` → real file `_shared/auth.ts`
- `./organizationMembership.ts` → `_shared/organizationMembership.ts`
- `./gmailBody.ts` → `_shared/gmailBody.ts` (sync only)
- `./autoLinkConversation.ts` → `_shared/autoLinkConversation.ts` (sync only)

All target files exist under `_shared/`. As committed the three functions are **unbundleable** and
cannot be redeployed. (`gmail-oauth-start` has its OWN local `auth.ts`, so it bundles — leave it.)

**Decision**: Change the imports to `../_shared/<file>.ts`. Verify the exported symbols match what
each function imports: `getUserFromRequest` (auth), `isUserInOrganization` +
`resolveOrganizationIdForUser` (organizationMembership), `extractBodyHtml` + `extractBodyText`
(gmailBody), `attemptAutoLink` (autoLinkConversation). This must land first — nothing else deploys
until it does.

**Alternatives rejected**: Copying `_shared` files locally (duplicates the crypto/auth surface,
diverges over time — rejected). Vendoring via import map (over-engineered for a path typo).

## D2. Uniqueness — swap per-user index for per-org

**Current state** (`20260218120000_create_gmail_connections.sql`):
```sql
create unique index idx_gmail_connections_one_active_per_user
  on public.gmail_connections (user_id) where status = 'active';
```

**Decision**: In the new migration, **drop** that index and create:
```sql
create unique index idx_gmail_connections_one_active_per_org
  on public.gmail_connections (organization_id) where status = 'active';
```
Keeping multiple-per-org as a future-additive change means: to allow multiple later, drop this index
and add a `is_default`/`is_primary` boolean — no other rework.

**Why not keep both indexes**: The per-user index forbids a user who is admin of two orgs from
holding an active connection in each — a legitimate case under the org model. The per-org invariant
is the one the client signed off. Documented as the single destructive step (plan Complexity
Tracking).

**Column nullability**: `organization_id` is nullable (added by `…140300`). Do **not** add a global
`NOT NULL` — legacy `revoked` rows may carry null org and NOT NULL would fail. The precondition (D3)
guarantees every *active* row has an org, and the OAuth callback always stamps org going forward, so
the partial index over `status='active'` is always well-defined.

## D3. Migration precondition check (per spec FR-012)

**Decision**: The migration begins with a guard that **aborts** (raises) before touching the index if
either invariant is already violated at migration time:
```sql
do $$
declare null_org int; dup int;
begin
  select count(*) into null_org
    from public.gmail_connections where status='active' and organization_id is null;
  select count(*) into dup from (
    select organization_id from public.gmail_connections
    where status='active' and organization_id is not null
    group by organization_id having count(*) > 1
  ) d;
  if null_org > 0 then raise exception 'Abort: % active gmail_connections with null organization_id', null_org; end if;
  if dup > 0 then raise exception 'Abort: % orgs with >1 active gmail_connections', dup; end if;
end $$;
```
**VERIFY (live)** before running: the client confirmed prod is clean (0 null-org active rows; no org
with >1 active). The check exists to fail loudly if that changed. The Dashboard SQL editor
auto-commits each statement — run this `do $$` block, then the drop, then the create, as separate
verified steps (per `supabase/CLAUDE.md`). SM's `info@searsmelvin.co.uk` active row is SM's org
connection; Churchill's single active row is Churchill's.

## D4. Send-path org-scoping (`gmail-send-reply`, `gmail-send-first-message`)

**Current state** (`gmail-send-reply`): conversation fetched with `.eq('id', …).eq('user_id', userId)`
(line 77) → 404 for non-owner members (the SM failure). Messages fetched with `.eq('user_id', userId)`
(line 96). Connection resolved with `.eq('user_id', userId).eq('status','active')` (preferred by prior
message's `gmail_connection_id`, then fallback — both user-scoped, lines 137/155). It already resolves
`orgId = conversation.organization_id ?? resolveOrganizationIdForUser(...)`, runs the
`isUserInOrganization` guard (173) and an org-mismatch guard (179).

**Decision**:
1. Fetch conversation by `.eq('id', conversationId)` only (drop `.eq('user_id', …)`), select
   `organization_id`. Derive `orgId = conversation.organization_id`.
2. Enforce caller membership: **keep** `isUserInOrganization(supabase, userId, orgId)` → 404/403 if
   not a member. (Org-scoping the connection does not replace verifying the caller.)
3. Resolve the connection by `.eq('organization_id', orgId).eq('status','active')` — explicit org
   filter, service-role bypasses RLS. Drop the `.eq('user_id', …)` on both the preferred and
   fallback lookups. The `preferredConnectionId` from a prior message may still be used as a hint but
   MUST be constrained to the same org (or dropped in favour of the single active org row, which is
   simpler now that there is exactly one).
4. Message-history fetch (for threadId): drop `.eq('user_id', userId)`; scope by `conversation_id`
   (+`channel='email'`). Thread/refMessageId derivation unchanged.
5. Sender identity: `From:` uses `connection.email_address` (the org mailbox) — already the case.
6. Outbound insert: continue stamping `organization_id = orgId`; `user_id` becomes the **acting**
   caller (audit of who sent), which is acceptable — identity on the wire is the org mailbox.

`gmail-send-first-message` gets the identical treatment (its conversation/connection lookups mirror
`gmail-send-reply`; **VERIFY** its exact lines during implementation).

**Alternatives rejected**: Trusting `resolveOrganizationIdForUser` as the primary org source —
rejected; the conversation's `organization_id` is authoritative and every inbox row now carries it.

## D5. Sync org-scoping (`gmail-sync-now` + scheduled sync)

**Current state**: polls the connection by user_id + active; stamps org/user on inserts (per findings
doc). Imports are broken (D1).

**Decision**: Resolve the connection to poll by `.eq('organization_id', orgId).eq('status','active')`.
Stamp `organization_id` on **every** inserted `inbox_conversations` and `inbox_messages` row. If the
org has no active connection, no-op with a clear result (no fallback to another org). **VERIFY**
whether a scheduled/cron sync exists separately (search config + any `cron`/`pg_cron`); if it iterates
users, it must iterate **org connections** instead. On a permanent token failure, apply D7.

**VERIFY (live)**: how `gmail-sync-now` currently obtains its `orgId` (JWT caller's org vs. the
connection's org). Under the org model, sync should iterate the connection's own `organization_id`,
not the caller's, so a scheduled run with no user context still works.

## D6. Admin-gated org connect (OAuth start + callback)

**Current state**:
- `gmail-oauth-start` (JWT via its own `auth.ts`): builds `state = base64({ userId, nonce })`. **No
  admin check. No org in state.**
- `gmail-oauth-callback` (GET, **no JWT**, public redirect): decodes `state.userId`, looks up the
  user's **earliest** org membership (`order created_at asc limit 1`), revokes existing active by
  **user_id**, inserts a new active row stamped user_id + that earliest org.

Three gaps for the org model: (a) earliest-membership is the wrong org for a multi-org admin;
(b) revoke-by-user_id won't retire another admin's active row for the same org → the per-org unique
index (D2) would then reject the insert; (c) **state integrity** — below.

**State is forgeable and the nonce is decorative (VERIFIED 2026-07-03)**: `gmail-oauth-start` creates
**no Supabase client** and does **not persist** the `nonce`; `gmail-oauth-callback` **never validates
it** and reads `userId` straight from base64 `state`. A callback-side admin re-check against
*state-supplied* identifiers does **NOT** close the gap (this corrects an earlier draft of this
decision): an attacker can complete Google consent with **their own** mailbox and craft
`state = { userId: <a genuine admin of the victim org>, organizationId: <victim org> }`; the "is that
user an admin?" check passes, and the callback inserts the **attacker's** mailbox as the victim org's
active connection — a connection hijack (org outbound identity + inbound sync compromised). Trust must
come from a **server-side channel**, not raw state.

**Decision**:
1. **`gmail-oauth-start`**: after JWT auth, run the whatsapp-connect admin check
   (`organization_members` where `user_id=user.id` and `role='admin'`, returning `organization_id`);
   403 if none.
2. **Bind identity server-side via a persisted single-use nonce (DECIDED)**: `-start` creates a
   service-role client and writes `{ nonce, user_id, organization_id, expires_at }` into a new
   `oauth_state` table (data-model.md); the redirect `state` carries **only** the opaque `nonce`.
   `-callback` atomically consumes the nonce (`update … set consumed_at=now() where nonce=? and
   consumed_at is null and expires_at>now() returning …`), takes `user_id`/`organization_id` from the
   **record** (never from state), and re-runs the admin check on the record's ids. `oauth_state` ships
   in the **same migration session** as the index swap (one maintainer Dashboard pass; the table
   create is additive, the index swap is the precondition-guarded destructive step).
3. **Revoke org-scoped**: change the retire step to
   `.eq('organization_id', organizationId).eq('status','active')` so the org's existing active row
   (whoever connected it) is revoked before insert — upholds one-active-per-org. Insert stamps
   `organization_id`, `user_id` from the **trusted** record ids.

**Alternatives rejected**:
- **HMAC-signed state (no table)** — signs `{ userId, organizationId, nonce, exp }` with a server
  secret (HMAC precedent in `_shared/twilioSignature.ts`). Rejected in favour of the persisted nonce:
  the flow already generates a nonce (evident original intent), and persistence gives true single-use
  + expiry with zero trust in the payload, vs. HMAC's replay-window reliance on Google's single-use
  `code`. The `oauth_state` table folds into the migration already required for the index swap.
- **Admin re-check against raw `state.userId`/`state.organizationId`** — bypassable (the hijack above).
- **Admin in RLS** — the pattern keeps "who can connect" in the function, not RLS (matches
  whatsapp-connect and the constitution note that admin gating lives in edge functions).

**VERIFY (live)**: whether the third function `gmail-oauth` (single combined function) is wired
anywhere. Frontend `getGmailOAuthUrl` calls `gmail-oauth-start`, so `gmail-oauth` is likely legacy —
confirm no caller before ignoring/deleting (deletion is out of scope here).

## D7. Revoked-on-invalid_grant (spec FR-016/FR-017)

**Current state**: On token-refresh failure both send functions return 502 "Failed to authenticate
with Gmail" and leave `status='active'`, so every subsequent send retries a dead token.

**Decision**: When Google's token endpoint returns a **permanent** failure — HTTP 400 with
`error==='invalid_grant'` in the body — set the org connection's `status='revoked'`
(existing enum value; **no schema change**, confirmed 14 revoked rows already in prod) before
returning the error. Do this in send and sync. Distinguish permanent (`invalid_grant`) from transient
(5xx/network) — only `invalid_grant` flips status. No retries, no error taxonomy, no notifications
(out of scope). The frontend org-settings surface renders a "reconnect required" indicator when the
org's connection status is `revoked` (D8).

## D8. Frontend connection API + settings surface

**Current state**:
- `gmailConnections.api.ts::fetchActiveGmailConnection` filters `.eq('user_id', session.user.id)
  .eq('status','active')` — fetches the **user's** connection, not the org's.
- `disconnectGmail` updates the active row (RLS-scoped) to `status='revoked'` via a **direct client
  update** — any member could call it; not admin-gated server-side.
- `getGmailOAuthUrl` calls `gmail-oauth-start` (unchanged surface; admin gate added server-side).

**Decision**:
1. `fetchActiveGmailConnection` → fetch the **org's** active connection: drop the `user_id` filter and
   scope by the current org (`.eq('organization_id', orgId).eq('status','active')`), relying on
   org-scoped RLS for read authorization. Return `email_address` + `status` so the UI can show the
   connected mailbox and the "reconnect required" (revoked) state.
2. **Disconnect admin gating**: a direct client update cannot enforce `role='admin'` server-side
   (RLS scopes by membership, not role). **Recommended**: route disconnect through a small
   `gmail-disconnect` edge function that runs the same admin check and sets the org's active row to
   `revoked`. (Decision flag for the user — see Open Questions.)
3. Move the connect/disconnect status component to the org-settings surface, visible to admins
   (`isOrgAdmin` from `OrganizationContext`); UI gating is cosmetic — the server-side admin checks in
   `gmail-oauth-start` (and disconnect fn) are authoritative.

## D9. RLS verification (spec FR-015) — VERIFIED (live 2026-07-03): email RLS gap found

Live `pg_policies` result:
- **`gmail_connections`** — clean: all 4 verbs org-scoped `user_is_member_of_org(organization_id)`,
  role `authenticated`. No change needed.
- **`inbox_conversations` / `inbox_messages`** — **GAP**: INSERT/DELETE are org-scoped
  (`authenticated`), but **SELECT and UPDATE** (role `{public}`) use:
  ```sql
  CASE WHEN channel = 'email' THEN (user_id = auth.uid())
       ELSE user_is_member_of_org(organization_id) END
  ```
  For `channel='email'`, RLS is still **per-user**. So org members who are not the connection owner are
  blocked from reading/updating the org's email threads **at the database layer** — this is the RLS
  half of FR-018 (the frontend being org-scoped is not enough; RLS overrides it).

**Decision (T007, required migration)**: replace the SELECT+UPDATE policies on both tables with the
uniform `user_is_member_of_org(organization_id)` form (role `authenticated`, `(select auth.uid())` if
any uid ref remains), matching INSERT/DELETE. **Data guard**: switching email from `user_id`-OR-`org`
to `org`-only would hide any `channel='email'` row with a **null `organization_id`** (T004b checks the
count on LIVE); backfill/guard before the flip. This is a policy change on LIVE Churchill email data —
show the diff, maintainer runs it.

## D10. Frontend inbox conversation/message queries (spec FR-018) — audit result

**Finding**: The audit is essentially already satisfied. In `src/modules/inbox`:
- `inboxConversations.api.ts` lists conversations with `.eq('organization_id', organizationId)`
  (line 18) and fetches one by `.eq('id', id)` only — **no** `user_id` filter.
- `inboxMessages.api.ts` fetches by `.eq('conversation_id', …)` / `.in('conversation_id', …)` —
  **no** `user_id` filter.
- The only `.eq('user_id', …)` hits in the module are in the **connection** APIs
  (`gmailConnections.api.ts:27`, `whatsappConnections.api.ts:50/124`), which are a different concern
  (D8), not conversation/message visibility.

**Decision**: FR-018 becomes a **verification + guard** task on the frontend (confirm no `user_id`
filter re-enters conversation/message queries), plus the D8 change to `fetchActiveGmailConnection`. No
conversation/message query rewrite is required at the frontend.

**IMPORTANT correction (D9 finding)**: the frontend being org-scoped is **not sufficient** on its own —
email SELECT/UPDATE RLS is still per-user (`CASE … channel='email' THEN user_id=auth.uid()`), so
members can't see the org's email threads until **T007** flips those policies to org-scoped. FR-018's
"member sees the thread in the list" is delivered by T007 (RLS) + T013 (frontend guard) together, not
the frontend alone.

## Open Questions (design flags for the user, non-blocking)

1. **Disconnect gating** (D8.2): **RESOLVED 2026-07-03 — dedicated `gmail-disconnect` edge function**
   (POST, JWT, admin check, org-scoped `status='revoked'`). Chosen for parity with the connect gate
   and the constitution ("UI checks are not security"). Frontend `disconnectGmail` invokes it. (T022)
2. **`preferredConnectionId` hint** (D4.3): now that there is exactly one active connection per org,
   drop the prior-message connection hint entirely, or keep it constrained to the org? Recommended:
   drop it — the single org connection is unambiguous and the hint adds a stale-FK failure mode.
