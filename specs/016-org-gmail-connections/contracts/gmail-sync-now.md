# Contract: `gmail-sync-now` (edge function) + scheduled sync

Poll the **org's** Gmail connection and ingest INBOX + SENT messages into the shared org inbox,
stamping `organization_id` on everything inserted. Service-role client (RLS bypassed → enforce org in
code). Bounded at `MAX_MESSAGES_LISTED_PER_SYNC = 500`.

## Request

`POST` (JWT required for the interactive `gmail-sync-now`). Body: `{ organizationId: string, since?:
string }`. `organizationId` is **required** — it names the org whose mailbox to sync and is **not**
inferred from the caller (see Behaviour §2). Any scheduled/cron variant runs without a user JWT and
MUST iterate **org connections** directly.

## Behaviour (changes from current)

1. **Imports** → `../_shared/gmailBody.ts` (`extractBodyHtml`, `extractBodyText`),
   `../_shared/auth.ts` (`getUserFromRequest`), `../_shared/autoLinkConversation.ts`
   (`attemptAutoLink`), `../_shared/organizationMembership.ts` (`resolveOrganizationIdForUser`).
   (**FR-014** — this is what blocks redeploy today.)
2. **Connection resolution**: the target org comes from the **request body** (`organizationId`),
   never inferred from the caller. The maintainer's account is a member of **both** Churchill and
   Sears Melvin, so first-membership inference would sync the wrong org's mailbox from the wrong
   org's UI. Required steps: missing/blank `organizationId` → **400**; `isUserInOrganization(caller,
   organizationId)` must hold → **403** otherwise; **no** first-membership fallback. Poll by
   `.eq('organization_id', organizationId).eq('status','active')`, not by `user_id`. The connection's
   own `organization_id` is authoritative for stamping (equal to the request org, which we filtered
   on). The frontend (`syncGmail` in `inboxGmail.api.ts`) passes the active org id from
   `OrganizationContext`.
3. **No connection** for the org → no-op with a clear result (`{ ok: true, synced: 0, reason:
   'no_active_connection' }` or equivalent); never fall back to another org's connection or a
   platform-wide "newest active" row (**FR-013**).
4. **Stamping**: every inserted `inbox_conversations` and `inbox_messages` row carries
   `organization_id` = the connection's org (**FR-007**). Auto-link runs within the org.
5. **Org-scoped dedup / thread-match (idempotency across members)**: the current sync scopes its
   existing-message dedup and thread-match lookups by `.eq('user_id', userId)` (index.ts lines ~239,
   302, 341, 354). Under the org model a second member polling the **same** org mailbox has a
   different `user_id` and would **re-insert duplicate** messages/conversations. **Drop `user_id`**
   from these lookups and key on `organization_id` + `gmail_connection_id` + `external_message_id`
   (messages) and `organization_id` + `external_thread_id` (thread-match — line ~343 already uses
   `organization_id`; remove the redundant `user_id` AND). This makes sync idempotent regardless of
   which member triggers it.
6. **Token failure**: `invalid_grant` on refresh → set connection `status='revoked'` and stop the run
   for that connection (**FR-016**); transient → surface error without status change.
7. `last_synced_at` updated only after a successful run (existing behaviour — preserve).

## Scheduled sync — VERIFIED: none exists

Confirmed 2026-07-03: no cron/pg_cron/scheduled invocation, no `.github/` workflows, nothing in
`config.toml`. `gmail-sync-now` is triggered **only** from the frontend (`inboxGmail.api.ts:47`, user
JWT). There is no scheduled sync to convert (T017 is a no-op record; adding one is out of scope).

## Acceptance

- Synced conversations/messages carry the correct `organization_id` and are visible to a second org
  member (**FR-007**, **SC-004**, spec US2).
- Org with no active connection → clean no-op, no cross-tenant read (**FR-013**).
- Bundles/deploys cleanly (**FR-014**, **SC-006**).
