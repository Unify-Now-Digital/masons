# Contract: `gmail-oauth-start` + `gmail-oauth-callback` (admin-gated org connect)

Connect the **organization's** mailbox via Google OAuth. Admin-only. Upholds one-active-per-org by
retiring the org's prior active row.

## `gmail-oauth-start`

`GET`/`POST`, **JWT required** (uses its own local `auth.ts` — leave that import).
Frontend entry: `getGmailOAuthUrl()` → `supabase.functions.invoke('gmail-oauth-start')`.

**Changes**
1. After `getUserFromRequest` → admin check (copy whatsapp-connect): service-role select on
   `organization_members` where `user_id=user.id` and `role='admin'`, returning `organization_id`.
   **403 `Admin access required to connect Gmail`** if none. (**FR-008**)
2. **Create a service-role client** (the function has none today) and **persist a single-use nonce**
   into `oauth_state`: `{ nonce: randomNonce(), user_id: user.id, organization_id:
   membership.organization_id, expires_at: now()+10min }`. The redirect `state` carries **only** the
   opaque nonce: `state = base64url(JSON({ nonce }))` — **no** identity in the payload.
3. Redirect params unchanged (scopes, `access_type=offline`, `prompt=consent`).

**Response**: `200 { url }` | `401` | `403` (not admin) | `500` (OAuth not configured / persist failed).

## State integrity — the callback MUST NOT trust unsigned state (REQUIRED)

**Verified current state (2026-07-03)**: `gmail-oauth-start` generates a `nonce` but **does not
persist it** (the function creates no Supabase client); `gmail-oauth-callback` **never validates the
nonce** — it reads `userId` straight from the base64 `state`. The state is therefore fully
**forgeable**, and a callback-side admin re-check against *state-supplied* identifiers is **NOT
sufficient**:

> **Attack**: an attacker initiates Google consent with **their own** mailbox, then crafts
> `state = { userId: <a real admin of victim org>, organizationId: <victim org> }`. A naive
> "is `state.userId` an admin of `state.organizationId`?" check **passes** (that named user really is
> an admin), and the callback inserts the **attacker's** mailbox as the victim org's active
> connection — hijacking the org's outbound identity and pulling attacker mail into the org inbox.

The callback must take `userId` and `organizationId` from a **trusted server-side channel**, not from
raw state. **Decision: server-persisted single-use nonce** (the `oauth_state` table, created in the
same migration session as the index swap — see `migration-one-active-per-org.md`). This repurposes
the nonce the flow already generates and adds single-use + expiry; identity is never read from state.

**Server-persisted nonce flow**
1. `gmail-oauth-start`, after the admin check, **persists** a short-lived record keyed by a
   single-use high-entropy `nonce`: `{ nonce, user_id, organization_id, expires_at }` into
   `oauth_state` (see `data-model.md`). `-start` must create a **service-role** client to write it
   (it has none today — this is a code change). The redirect `state` carries **only** the opaque
   `nonce`.
2. `gmail-oauth-callback` looks up the record **by nonce**; if missing / expired (`expires_at <=
   now()`) / already consumed (`consumed_at is not null`) → `redirectWith({ error: 'invalid_state' })`.
3. Take `userId` and `organizationId` **from the server record** (never from state). Mark the nonce
   **consumed** (`consumed_at = now()`) atomically before insert so it cannot be replayed (e.g.
   `update … set consumed_at=now() where nonce=? and consumed_at is null returning …` and treat a
   zero-row result as already-consumed → `invalid_state`).
4. Re-run the admin check against the **record's** `user_id`/`organization_id` (defence in depth) →
   `forbidden` if it no longer holds (e.g. role revoked between start and callback).

## `gmail-oauth-callback`

`GET`, **no JWT** (Google redirect). Redirects to `${APP_URL}/dashboard/inbox?...`.

**Changes**
1. Resolve `{ userId, organizationId }` by looking up + consuming the `oauth_state` nonce (above) —
   **not** from raw state. Missing/expired/consumed → `redirectWith({ error: 'invalid_state' })`.
   **Replaces** the current earliest-membership lookup.
2. Admin check against the trusted `userId`/`organizationId`; not admin → `forbidden`. (**FR-008**)
3. Exchange code → tokens (unchanged); fetch userinfo email (unchanged).
4. **Org-scoped revoke** (was `user_id`-scoped): set the org's existing active row to `revoked`:
   `.eq('organization_id', organizationId).eq('status','active')` — so the per-org unique index never
   sees two active rows, regardless of which admin connected the previous one. (**FR-009**)
5. Insert new row: `status='active'`, `organization_id=organizationId`, `user_id=userId`,
   `email_address`, tokens, `provider='google'`, `last_synced_at=null` (unchanged rationale).
6. `redirectWith({ gmail: 'connected' })` on success; existing error redirects otherwise.

## Notes

- The unsigned-state → forgery risk above is a **hard requirement**, not a hardening nicety: without
  the server-persisted nonce the admin gate is bypassable (connection hijack). See research D6.
- Cleanup: expired `oauth_state` rows are harmless (callback rejects them) but should be pruned —
  opportunistically delete `where expires_at < now()` in `-start`, or via a periodic job.
- The standalone `gmail-oauth` function is **not** the wired path (frontend uses `-start`/`-callback`).
  VERIFY no caller; do not modify/delete here (deletion tracked separately).

## Acceptance

- Admin completes connect → exactly one active row for the org, stamped org + user (**FR-008**, US3.1,
  **SC-005**).
- Non-admin direct call to `-start` → 403 (**FR-008**, US3.2, **SC-005**).
- **Forged/replayed state to `-callback`** → `invalid_state` (unknown/expired/already-consumed nonce);
  a `state` naming a real admin of a victim org does **not** result in a connection insert (identity
  comes from the `oauth_state` record, never raw state). Reusing a consumed nonce fails. (**FR-008**,
  **SC-005**)
- Connecting when an active row exists retires the prior one (any connector) → invariant holds
  (**FR-009**, US3.3).
