# Phase 1 Data Model: Org-level Gmail Connections

No new tables. Changes are one index swap plus verified RLS. Existing `organization_id` columns
(migration `…140300`) and the existing `status` enum (`active|revoked|error`) are reused.

## Entity: `gmail_connections`

The org's email connection. One **active** row per organization after this feature.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL → `auth.users` | The connector / acting owner. **No longer** the scope key for send/sync lookups. Retained for audit. |
| `organization_id` | uuid NULL → `organizations` | Tenant scope (added `…140300`). Every **active** row carries a non-null org (enforced by precondition + always stamped on connect). Stays nullable at column level to tolerate legacy `revoked` rows. |
| `provider` | text | `'google'` |
| `email_address` | text NULL | The org mailbox identity (e.g. `info@searsmelvin.co.uk`). Shown in settings; used as `From:`. |
| `access_token` | text NULL | Short-lived; server-side only. |
| `refresh_token` | text NOT NULL | Server-side only; never sent to client. |
| `token_expires_at` | timestamptz NULL | |
| `scope` | text NULL | |
| `status` | text NOT NULL | `check in ('active','revoked','error')` — **unchanged**. `revoked` already in use (14 prod rows). |
| `last_synced_at` | timestamptz NULL | |
| `created_at` / `updated_at` | timestamptz | |

### Invariant change (the one destructive step)

**Before**
```sql
create unique index idx_gmail_connections_one_active_per_user
  on public.gmail_connections (user_id) where status = 'active';
```
**After**
```sql
-- precondition guard runs first (see contracts/migration-one-active-per-org.md)
drop index if exists idx_gmail_connections_one_active_per_user;
create unique index idx_gmail_connections_one_active_per_org
  on public.gmail_connections (organization_id) where status = 'active';
```
- **State transitions**: `active → revoked` on disconnect and on `invalid_grant`; new row inserted
  `active` on connect after the org's prior active row is revoked (so the partial index never sees
  two active rows for one org).
- **Future-additive path** (out of scope, must remain a no-rework change): drop
  `idx_gmail_connections_one_active_per_org`, add `is_default boolean` + a partial unique index on
  `(organization_id) where is_default and status='active'`.

### RLS (VERIFY live, FR-015)

Expected 4-verb policies keyed on `public.user_is_member_of_org(organization_id)` (from the `…140600`
tenant loop), using `(select auth.uid())`. Original create-migration policies were per-user
(`user_id = auth.uid()`) and must be confirmed replaced. Service-role edge functions bypass RLS —
they enforce `organization_id` in code regardless.

## Entity: `inbox_conversations` / `inbox_messages`

Unchanged shape. Both carry `organization_id` (`…140300`). **RLS is NOT uniformly org-scoped today**
(verified live): INSERT/DELETE are org-scoped, but **SELECT + UPDATE** use
`CASE WHEN channel='email' THEN user_id=auth.uid() ELSE user_is_member_of_org(organization_id) END`
(role `{public}`) — email reads/updates are per-user. **T007** replaces the SELECT+UPDATE policies
with the uniform `user_is_member_of_org(organization_id)` form (role `authenticated`), after a null-org
email-row guard (T004b). This is what lets every org member see the org's email threads. Relevant
columns for this feature:

- `inbox_conversations`: `id`, `organization_id`, `channel` (`'email'`), `primary_handle`, `subject`,
  `external_thread_id`, `last_message_at`, `last_message_preview`. **No `user_id` filter** applied by
  send/sync after this feature.
- `inbox_messages`: `id`, `conversation_id`, `organization_id`, `user_id` (acting sender, audit),
  `gmail_connection_id`, `channel`, `direction`, `from_handle`, `to_handle`, `body_text`, `sent_at`,
  `status`, `external_message_id`, `meta.gmail.{threadId,messageId}`.

**Send insert** continues to stamp `organization_id` (from the conversation) and `gmail_connection_id`
(the org's active connection); `user_id` = acting caller.
**Sync insert** stamps `organization_id` (from the connection) on every conversation and message.

## Entity: `oauth_state` (NEW) — server-side OAuth identity binding

The current `state` is **base64, unsigned, and forgeable**, and the `nonce` in it is **decorative**
(VERIFIED: `gmail-oauth-start` persists nothing; the callback never validates it and reads `userId`
from state). A callback-side admin re-check against *state-supplied* ids is **insufficient** — it
permits a connection-hijack (research D6). **Decision: server-persisted single-use nonce.** Identity
comes from this table, never from the redirect payload.

Short-lived, single-use record binding the opaque nonce to the authorised identity. Written by
`gmail-oauth-start` (service role), read + consumed by `gmail-oauth-callback`. Created in the **same
migration session** as the index swap (`contracts/migration-one-active-per-org.md`, steps 5–6).

| Column | Type | Notes |
|---|---|---|
| `nonce` | text PK | Opaque, high-entropy; the only thing that round-trips through `state`. |
| `user_id` | uuid NOT NULL → `auth.users` (cascade) | The admin who initiated connect (from the JWT in `-start`). |
| `organization_id` | uuid NOT NULL → `organizations` (cascade) | Target org (from the admin membership in `-start`). |
| `expires_at` | timestamptz NOT NULL | Short TTL (~10 min); callback rejects if `<= now()`. |
| `consumed_at` | timestamptz NULL | Set on first callback use → single-use (reject if already set). |
| `created_at` | timestamptz NOT NULL default now() | |

- **RLS**: enabled with **no** policies → deny-all to authenticated/anon. Only service-role edge
  functions touch it (`-start` writes, `-callback` reads/consumes). Prune expired rows opportunistically
  in `-start` or via a periodic job.
- **State on the wire**: `base64({ nonce })` only — no identity in the payload.
- **Callback consume (atomic single-use)**:
  `update public.oauth_state set consumed_at = now() where nonce = ? and consumed_at is null and
  expires_at > now() returning user_id, organization_id;` — zero rows returned ⇒ missing/expired/
  already-consumed ⇒ `invalid_state`. Take `user_id`/`organization_id` from the returned row; re-run
  the admin check on them.

**`state` payload — before/after**
**Before (current)**: `{ userId, nonce }` — unsigned, unvalidated, forgeable.
**After**: opaque `{ nonce }` — identity resolved server-side from `oauth_state`.

## Derived / read models (frontend)

- **Org connection view** (settings): `{ email_address, status }` for the current org's active-or-
  revoked connection. `status='revoked'` (or no active row) → render "reconnect required".
- No conversation/message read-model change: existing org-scoped queries already surface the org's
  threads to every member (FR-018 audit — see research D10).
