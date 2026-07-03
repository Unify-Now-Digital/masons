# Implementation Plan: Org-level Email (Gmail) Connections

**Branch**: `016-org-gmail-connections` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/016-org-gmail-connections/spec.md`

## Summary

Replace the per-user Gmail connection model with **one active connection per organization**. The
DB already carries `organization_id` on `gmail_connections`, `inbox_conversations`, and
`inbox_messages` (migration `…140300`); the `status` enum already includes `revoked`. The work is
therefore mostly **tightening and correcting existing code paths** rather than net-new schema:

1. **Prerequisite (blocking)**: fix the `_shared` import paths in `gmail-send-reply`,
   `gmail-send-first-message`, `gmail-sync-now` (they import local `./auth.ts`-style files that do
   not exist) so the functions bundle/deploy — same fix class as `inbox-twilio-send` (`6c59aa1`).
2. **Send/sync org-scoping**: drop the `.eq('user_id', …)` ownership filters on conversation,
   message, and connection lookups; resolve the connection by the conversation's `organization_id`
   with an explicit `.eq('organization_id', …)`; keep the `isUserInOrganization` caller guard.
3. **One active per org**: replace the per-user partial unique index with a per-**org** one, guarded
   by a defensive precondition check; keep multiple-per-org as a future-additive change.
4. **Admin-gated org connect**: enforce a server-side `organization_members.role='admin'` check; bind
   the target `organization_id`/`userId` through a **persisted single-use nonce** (`oauth_state`
   table) rather than raw forgeable `state`; retire the **org's** prior active row (not the user's) on
   connect.
5. **Revoked-on-invalid_grant**: on a permanent Google token failure during send/sync, set the org
   connection's `status='revoked'` (existing value) and surface a "reconnect required" indicator.
6. **UI**: move connect/disconnect to org settings (admin-visible); fetch the **org's** connection.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, React 18); Deno (Supabase Edge Functions, `Deno.serve`)
**Primary Dependencies**: React 18, Vite (SWC), TanStack React Query, React Hook Form + Zod,
shadcn/ui; `@supabase/supabase-js@2.49.4`; Google OAuth 2.0 + Gmail REST API
**Storage**: Supabase Postgres — `gmail_connections`, `inbox_conversations`, `inbox_messages`,
`organization_members`; RLS via `user_is_member_of_org(organization_id)`
**Testing**: `npx tsc --noEmit` (typecheck — build does NOT typecheck); manual two-org verification
against SM (pre-launch) + a test org; Churchill is LIVE — no test writes
**Target Platform**: Web (SPA) + Supabase Edge Functions (Deno)
**Project Type**: Web application (React SPA frontend + Supabase backend)
**Performance Goals**: N/A (interactive inbox; no throughput target). Sync bounded at 500 msgs/run.
**Constraints**: Multi-tenant — service-role edge functions bypass RLS, so connection/conversation
lookups MUST filter `organization_id` explicitly. Migrations run by maintainer in the Supabase
Dashboard SQL editor (no `supabase db push`); edge functions deploy via `supabase functions deploy`.
**Scale/Scope**: 2 live orgs (Churchill LIVE, SM pre-launch); 4 edge functions + 1 migration + 2
frontend connection APIs + 1 settings surface.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Dual router constraint**: PASS — no routing paradigm change. A new org-settings surface is added
  within the existing router; `src/app/` + `src/pages/` coexistence untouched.
- **Module boundaries**: PASS — frontend changes stay in `src/modules/inbox/api` (connection APIs)
  and the settings module that hosts org settings; no cross-feature deep imports. Any shared helper
  goes via `src/shared/`.
- **Supabase + RLS**: PASS with explicit corollary — RLS remains the boundary for authenticated
  frontend reads (`user_is_member_of_org`), but the send/sync/connect edge functions use the
  service-role key and therefore MUST enforce `organization_id` scoping in code (this is the exact
  lesson from the WhatsApp cross-tenant send bug, `3e4ab5f`/`6c59aa1`). Policies use
  `(select auth.uid())`. **Phase 0 must VERIFY live policies — do not assume.**
- **Secrets**: PASS — refresh tokens and OAuth client secret stay server-side in edge functions;
  the frontend never sees them. Token refresh + Gmail send happen only in functions.
- **Additive-first**: MOSTLY PASS — two **non-additive** steps, both guarded/reversible, no data
  deleted: (1) dropping the per-user partial unique index and replacing it with a per-org one
  (precondition-guarded); (2) **replacing the email SELECT+UPDATE RLS policies** on
  `inbox_conversations`/`inbox_messages` (currently per-user for email) with uniform org-scoped
  policies — a policy swap on LIVE Churchill email data, guarded by a null-org email-row check (T004b)
  and reversible by restoring the CASE policy. Documented in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/016-org-gmail-connections/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions, live-state verification checklist
├── data-model.md        # Phase 1 output — gmail_connections index/RLS, state schema
├── quickstart.md        # Phase 1 output — deploy order + two-org verification
├── contracts/           # Phase 1 output — edge-function + migration contracts
│   ├── gmail-send-reply.md
│   ├── gmail-send-first-message.md
│   ├── gmail-sync-now.md
│   ├── gmail-oauth-connect.md          # start + callback admin gate & org state
│   ├── migration-one-active-per-org.md
│   └── frontend-connection-api.md
└── tasks.md             # Created by /tasks (NOT this command)
```

### Source Code (repository root)

```text
supabase/
├── functions/
│   ├── _shared/
│   │   ├── auth.ts                     # getUserFromRequest (target of import fix)
│   │   ├── organizationMembership.ts   # isUserInOrganization, resolveOrganizationIdForUser
│   │   ├── gmailBody.ts                # extractBodyHtml/Text (sync)
│   │   └── autoLinkConversation.ts     # attemptAutoLink (sync)
│   ├── gmail-send-reply/index.ts       # FIX imports + org-scope conv/msg/connection lookups
│   ├── gmail-send-first-message/index.ts  # same
│   ├── gmail-sync-now/index.ts         # FIX imports + poll org connection, stamp org
│   ├── gmail-oauth-start/index.ts      # ADD admin gate; put organizationId in state
│   ├── gmail-oauth-callback/index.ts   # re-verify admin; org-scoped revoke; stamp org from state
│   └── whatsapp-connect/index.ts       # REFERENCE (admin-gate pattern to copy)
└── migrations/
    └── 202607xxxxxxxx_gmail_org_connection.sql       # NEW: precondition + swap unique index +
                                                      #      create oauth_state (one session)

src/modules/inbox/
├── api/
│   ├── gmailConnections.api.ts         # fetch ORG connection; admin-gated disconnect
│   ├── inboxConversations.api.ts       # ALREADY org-scoped (verify, no change expected)
│   └── inboxMessages.api.ts            # ALREADY conversation-scoped (verify, no change expected)
└── components/                          # connect/disconnect status → org settings surface

src/modules/<org-settings host>/         # relocate connect/disconnect UI (admin-visible)
```

**Structure Decision**: Web application. Backend edge functions + one migration carry the security
and correctness weight; frontend changes are small (connection API re-scoping + relocating an
existing status component). No new module is introduced; work lands in `inbox` (connection APIs and
edge functions) and the existing org-settings host.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Destructive index swap (drop `idx_gmail_connections_one_active_per_user`, add per-org) | The per-user index would block a user who is admin of two orgs from holding an active connection in each, contradicting the org model; the per-org index is the actual invariant the client signed off | Keeping both indexes rejected: their intersection (one active per user AND per org) forbids a legitimate multi-org admin from connecting a second org. Additive-only (add per-org, keep per-user) therefore breaks a supported case. Guarded + reversible, so the destructive drop is justified. |
| Service-role code enforcing `organization_id` (not RLS) | send/sync/connect run with the service-role key which bypasses RLS entirely | Relying on RLS rejected — it does not apply to service-role clients; this is the documented WhatsApp cross-tenant bug. |
| Replacing email SELECT+UPDATE RLS policies on `inbox_conversations`/`inbox_messages` (LIVE) | The existing CASE branch gates email per-user (`user_id=auth.uid()`), which blocks the shared-org-inbox this feature delivers — members can't see the org's email | Additive-only rejected: you cannot make email org-visible without removing the per-user email branch. Guarded by a null-org email-row check (T004b) and reversible (restore the CASE policy). |

## Progress Tracking

- [x] **Phase 0 — Research** (`research.md`): decisions D1–D10 + open questions recorded; live-state
  VERIFY items flagged (RLS, scheduled sync, `gmail-oauth` wiring). No blocking NEEDS CLARIFICATION.
- [x] **Phase 1 — Design**:
  - [x] `data-model.md` — index swap, RLS expectations, OAuth `state` schema
  - [x] `contracts/` — `migration-one-active-per-org`, `gmail-send-reply`, `gmail-send-first-message`,
    `gmail-sync-now`, `gmail-oauth-connect`, `frontend-connection-api`
  - [x] `quickstart.md` — deploy order + V1–V6 verification mapped to Success Criteria
- [x] **Constitution Check** — PASS (one justified destructive step: per-user→per-org index swap,
  guarded + reversible; recorded in Complexity Tracking). Re-checked after Phase 1: no new violations.
- [ ] **Phase 2 — Tasks** (`tasks.md`): **NOT** created by `/plan`. Run `/tasks` next.

### Live-state VERIFY checklist (carry into implementation)
- ✅ **RLS (D9/FR-015) — VERIFIED**: `gmail_connections` clean; `inbox_conversations`/`inbox_messages`
  SELECT+UPDATE gate **email per-user** via a CASE branch → **T007 required migration** (with a null-org
  email-row guard, T004b) to make members see org email. Not the no-op originally assumed.
- ✅ **Scheduled sync (D5) — VERIFIED none exists**: frontend-triggered only; T017 no-op.
- ✅ **`gmail-oauth` standalone (D6) — VERIFIED legacy**: unreferenced in `src/`; live redirect_uri is
  `…/functions/v1/gmail-oauth-callback` (maintainer-confirmed). Leave it.
- ✅ **`_shared` exports (D1) — VERIFIED match**; T006 import fix applied.
- ✅ **`gmail-sync-now` org/dedup (D5) — VERIFIED**: connection by `user_id` (96–100); dedup/thread-match
  `user_id`-scoped (239/302/341/354) → **T016 scope bump** to org-scoped dedup (approved).
- ⏳ `gmail-send-first-message` exact conversation/connection lookup lines (confirm during T012).
- **OAuth state integrity (D6, RESOLVED — VERIFIED the nonce is neither persisted by `-start` nor
  validated by `-callback`; state is forgeable → connection-hijack; logged HIGH in
  `specs/mason-pentest-summary.md`)**: DECIDED — bind identity server-side via a persisted single-use
  nonce (`oauth_state` table, folded into the same migration session). The callback must NOT read
  `userId`/`organizationId` from raw state; an admin re-check against state-supplied ids is NOT
  sufficient on its own.

### Open design flags for the user (non-blocking, in research.md)
1. Disconnect: dedicated `gmail-disconnect` edge function (recommended) vs. RLS-scoped client update.
2. Drop the `preferredConnectionId` message hint in `gmail-send-reply` (recommended).
