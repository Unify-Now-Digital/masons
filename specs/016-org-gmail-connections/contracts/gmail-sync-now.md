# Contract: `gmail-sync-now` (edge function) + scheduled sync

Poll the **org's** Gmail connection and ingest INBOX + SENT messages into the shared org inbox,
stamping `organization_id` on everything inserted. Service-role client (RLS bypassed → enforce org in
code). Bounded at `MAX_MESSAGES_LISTED_PER_SYNC = 500`.

## Request

`POST` (JWT required for the interactive `gmail-sync-now`). Any scheduled/cron variant runs without a
user JWT and MUST iterate **org connections** directly.

## Behaviour (changes from current)

1. **Imports** → `../_shared/gmailBody.ts` (`extractBodyHtml`, `extractBodyText`),
   `../_shared/auth.ts` (`getUserFromRequest`), `../_shared/autoLinkConversation.ts`
   (`attemptAutoLink`), `../_shared/organizationMembership.ts` (`resolveOrganizationIdForUser`).
   (**FR-014** — this is what blocks redeploy today.)
2. **Connection resolution**: poll by `.eq('organization_id', orgId).eq('status','active')`, not by
   `user_id`. For the interactive call, `orgId` derives from the caller's org (VERIFY current source);
   the connection's own `organization_id` is authoritative for stamping.
3. **No connection** for the org → no-op with a clear result (`{ ok: true, synced: 0, reason:
   'no_active_connection' }` or equivalent); never fall back to another org's connection or a
   platform-wide "newest active" row (**FR-013**).
4. **Stamping**: every inserted `inbox_conversations` and `inbox_messages` row carries
   `organization_id` = the connection's org (**FR-007**). Auto-link runs within the org.
5. **Token failure**: `invalid_grant` on refresh → set connection `status='revoked'` and stop the run
   for that connection (**FR-016**); transient → surface error without status change.
6. `last_synced_at` updated only after a successful run (existing behaviour — preserve).

## Scheduled sync (VERIFY existence)

Search for a cron/pg_cron/scheduled invocation. If one exists and iterates users, change it to iterate
**active org connections** (one per org) and apply the same stamping. If none exists, note that
scheduled sync is not yet wired (out of scope to add here unless required).

## Acceptance

- Synced conversations/messages carry the correct `organization_id` and are visible to a second org
  member (**FR-007**, **SC-004**, spec US2).
- Org with no active connection → clean no-op, no cross-tenant read (**FR-013**).
- Bundles/deploys cleanly (**FR-014**, **SC-006**).
