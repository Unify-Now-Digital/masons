# Feature Specification: Org-level Email (Gmail) Connections

**Feature Branch**: `016-org-gmail-connections`
**Created**: 2026-07-03
**Status**: Draft
**Input**: User description: "Org-level email (Gmail) connections — replace the per-user connection model with one connection per organization, mirroring but tightening the existing WhatsApp pattern."

## Overview

Email (Gmail) is currently connected **per user**: send and sync functions resolve the mailbox by
`user_id + status='active'`, and both send functions fetch the conversation with an `.eq('user_id', …)`
ownership filter. The practical effect is that only the individual who personally connected a mailbox
can view or reply to that org's email conversations — every other member of the organization gets an
HTTP 404 "Conversation not found" (root cause documented in `specs/gmail-send-path-findings.md` §5).

This feature replaces that model with **one active Gmail connection per organization**, mirroring the
org-scoped WhatsApp pattern (`specs/whatsapp-org-connection-pattern.md`) but **tightening it**: WhatsApp
allows one connection per *user*; email allows one active connection per *org*. Any member of the
organization can then read and reply to the org's email conversations, and all outbound email is sent
from the org's connected mailbox (the shared org identity, e.g. `info@searsmelvin.co.uk`), not the
individual user.

A prerequisite blocker must be cleared first: `gmail-send-reply`, `gmail-send-first-message`, and
`gmail-sync-now` import non-existent local `./auth.ts`-style files (the real files live in `_shared/`).
As committed they are **unbundleable and undeployable** — the same defect fixed for `inbox-twilio-send`
in commit `6c59aa1`. Nothing in this feature can be redeployed until that is corrected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Any org member can read and reply to the org's email (Priority: P1)

A team member who did **not** personally connect the mailbox opens an email conversation in the unified
inbox, types a reply, and sends it. The reply is delivered from the organization's connected mailbox and
appears in the thread. This is the core value: email becomes a shared org channel, not a personal one.

**Why this priority**: This is the reason for the feature. Without it, email in a multi-member org is
broken for everyone except the one connector (the live SM send failure). It is also the minimal viable
slice — it delivers value even before the connect/disconnect UI is relocated, given a connection already
exists in the DB.

**Independent Test**: With SM's `info@searsmelvin.co.uk` connection present, sign in as an SM member who
is *not* the connection's `user_id` owner. First confirm the member can **see** the SM email conversation
in the inbox list (previously hidden by a `user_id` filter). Then open it, send a reply, and confirm HTTP
200 and delivery from the org mailbox. Previously the list omitted the thread and the send returned 404.

**Acceptance Scenarios**:

1. **Given** an org has an existing email conversation, **When** a member who is not the connection owner
   opens the inbox, **Then** the conversation appears in their inbox list (no `user_id` filter hides it).
2. **Given** an org has one active Gmail connection and an existing email conversation, **When** a member
   who is not the connection owner sends a reply, **Then** the message is sent from the org mailbox and
   persisted on the thread (no 404).
3. **Given** the same org and member, **When** the member starts a first email in a conversation that has
   no prior email message, **Then** `gmail-send-first-message` sends from the org mailbox and succeeds.
4. **Given** a user who is **not** a member of the conversation's organization, **When** they attempt to
   send, **Then** the request is rejected (the existing `isUserInOrganization` caller guard still holds).
5. **Given** two organizations each with their own active connection, **When** a member of Org A sends,
   **Then** the message is sent using **Org A's** connection only (never Org B's), even though the send
   function runs with a service-role client that bypasses RLS.

---

### User Story 2 - Incoming email syncs into the shared org inbox (Priority: P1)

New inbound and sent Gmail messages for the org's connected mailbox are polled and appear in the unified
inbox for **all** members of that organization, each conversation and message stamped with the correct
`organization_id`.

**Why this priority**: A shared send path is only half a shared inbox; members must also *see* the
threads. Sync stamping the org id correctly is what makes conversations visible under the org-scoped RLS
policies. P1 alongside Story 1 — together they are the working shared channel.

**Independent Test**: Trigger `gmail-sync-now` for the org's connection; confirm newly inserted
`inbox_conversations` / `inbox_messages` rows carry the org's `organization_id`, and that a second member
of the org can see them in the inbox.

**Acceptance Scenarios**:

1. **Given** the org's active connection, **When** sync runs, **Then** it polls **that org's** connection
   (resolved by `organization_id`, not by the caller's `user_id`) and stamps `organization_id` on every
   inserted conversation and message.
2. **Given** synced conversations, **When** any member of the org opens the inbox, **Then** they see the
   email threads (org-scoped RLS grants read to all members).
3. **Given** an org with **no** active connection, **When** sync runs, **Then** it performs no work and
   returns a clear "no connection" result rather than erroring or picking another org's connection.

---

### User Story 3 - An admin connects/disconnects the org mailbox from org settings (Priority: P2)

An organization admin goes to org settings, connects the organization's Google mailbox via OAuth, and can
later disconnect it. Non-admins do not see the connect control, and even a crafted non-admin request is
refused server-side.

**Why this priority**: Necessary for onboarding new orgs and re-authing, and it is the correct home for
the control, but the P1 stories can be validated against the already-connected SM mailbox without it.
Depends on the same admin-gate pattern as `whatsapp-connect`.

**Independent Test**: As an org admin, complete the OAuth connect flow from org settings and confirm one
active connection row for the org; as a non-admin, confirm the control is hidden and a direct call to the
connect function returns 403.

**Acceptance Scenarios**:

1. **Given** an admin of an org with no active connection, **When** they complete OAuth connect, **Then**
   exactly one active `gmail_connections` row exists for that org, stamped with `organization_id` (and the
   connecting `user_id`).
2. **Given** a non-admin member, **When** they call the connect/callback function directly, **Then** it
   returns 403 (server-side `organization_members.role='admin'` check), independent of any UI gating.
3. **Given** an org with an existing active connection, **When** an admin connects a new mailbox, **Then**
   the prior active row is retired (set non-active) so the one-active-per-org invariant holds and the
   partial unique index does not conflict.
4. **Given** an admin, **When** they disconnect, **Then** the connection is set non-active and the org has
   no active mailbox until reconnected.

---

### User Story 4 - Migrate existing connections to the org model without breaking the unique index (Priority: P1)

Before the one-active-per-org unique index is created, existing `gmail_connections` data is reconciled so
that each organization has **at most one** active row. SM's `info@searsmelvin.co.uk` active connection
becomes SM's org connection; Churchill's existing active connection(s) and any duplicate active rows per
org are resolved to a single active row per org.

**Why this priority**: The partial unique index will **reject** duplicate active rows on creation. If data
is not reconciled first, the migration fails against live data (Churchill is LIVE production). This must
land with, and before, the index — hence P1.

**Independent Test**: On a copy of live data, run the reconciliation then create the index; confirm the
index builds without violation and each org has exactly one active row. Confirm SM resolves to
`info@searsmelvin.co.uk`.

**Acceptance Scenarios**:

1. **Given** the current `gmail_connections` rows, **When** reconciliation runs, **Then** each
   `organization_id` has at most one row with `status='active'`.
2. **Given** SM has an active `info@searsmelvin.co.uk` row, **When** reconciliation runs, **Then** that row
   remains the single active row for SM.
3. **Given** reconciliation has completed, **When** the partial unique index on `(organization_id) WHERE
   status='active'` is created, **Then** it builds successfully with no uniqueness violation.
4. **Given** production is already verified clean (zero active rows with a null `organization_id`, and no
   org with more than one active row), **When** the migration runs, **Then** a defensive precondition check
   runs first and **aborts** the migration if either situation is present at migration time — no
   null-`organization_id` handling or dedup logic is required in the happy path.

---

### Edge Cases

- **No active connection for the org**: Send and sync return a clear, non-cross-tenant error/no-op — never
  fall back to another org's connection or the newest connection platform-wide.
- **Multiple active rows slip through** before the index exists: reconciliation must deterministically pick
  the survivor (e.g. most recently created/authorized) and retire the rest; document the tie-break rule.
- **Revoked/expired refresh token** on the org connection: on a **permanent** Google token failure
  (`invalid_grant`) during send or sync, the connection status is set to `revoked` (an existing enum value —
  no new status values in v1) and a "reconnect required" indicator is surfaced in org settings. Retries,
  error taxonomies, and notifications are out of scope.
- **Caller is a member but of a different org than the conversation**: rejected by `isUserInOrganization`
  (org-scoping the *connection* does not replace verifying the *caller*).
- **Conversation's `organization_id` disagrees with the resolved connection's org**: reject rather than
  send from a mismatched mailbox (mirrors the existing org-mismatch guard).
- **Concurrent connect attempts** by two admins: the partial unique index enforces one active row; the
  second insert must retire the first (or fail gracefully), not create a duplicate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST enforce **at most one active Gmail connection per organization** via a
  partial unique index on `gmail_connections(organization_id) WHERE status='active'`.
- **FR-002**: The schema MUST keep multiple-connections-per-org as a purely **future-additive** change —
  i.e. supporting multiple later requires only dropping the partial unique index and adding a
  default/primary flag, with no rework of the org-scoping done here.
- **FR-003**: `gmail-send-reply` and `gmail-send-first-message` MUST fetch the conversation by `id` +
  `organization_id` + caller org-membership, and MUST **drop** the `.eq('user_id', …)` ownership filter.
- **FR-004**: `gmail-send-reply` and `gmail-send-first-message` MUST resolve the Gmail connection by the
  **conversation's `organization_id`** using an explicit `.eq('organization_id', …)` filter, and MUST NOT
  rely on RLS for connection scoping (these functions use the service-role client, which bypasses RLS).
- **FR-005**: The send functions MUST **retain** the existing `isUserInOrganization` caller guard —
  org-scoping the connection does not replace verifying that the caller belongs to the conversation's org.
- **FR-006**: Outbound email MUST be sent from the **organization's** connected mailbox identity (e.g.
  `info@searsmelvin.co.uk`), not from any per-user identity.
- **FR-007**: `gmail-sync-now` and any scheduled sync MUST poll the **org's** connection (resolved by
  `organization_id`) and MUST stamp `organization_id` on every inserted conversation and message.
- **FR-008**: The OAuth connect/callback edge function MUST enforce an **admin-only** gate via a
  server-side `organization_members.role='admin'` check (copying `whatsapp-connect`), and MUST stamp
  `organization_id` (from that membership) and the connecting `user_id` on the connection row.
- **FR-009**: When an admin connects a new mailbox for an org that already has an active connection, the
  system MUST retire the prior active row so the one-active-per-org invariant holds (no index conflict).
- **FR-010**: Admins MUST be able to **disconnect** the org's mailbox (set it non-active) from org
  settings.
- **FR-011**: Connect/disconnect controls MUST live in **org settings** and be visible to admins; UI
  gating is cosmetic — the authoritative gate is server-side (FR-008).
- **FR-012**: The existing-data migration MUST begin with a **defensive precondition check** that
  **aborts** the migration if, at migration time, any active `gmail_connections` row has a null
  `organization_id` **or** any org has more than one active row. Production is verified clean today (zero
  null-org active rows; no org with >1 active row), so the happy path requires no null-handling or dedup
  logic — the check exists to fail loudly if that assumption no longer holds. SM's `info@searsmelvin.co.uk`
  active row is SM's org connection; Churchill's single active row is Churchill's org connection.
- **FR-013**: Send and sync MUST NOT fall back to any other org's connection or to a platform-wide "newest
  active" connection when the target org has no active connection; they MUST return a clear scoped
  result/error.
- **FR-014 (prerequisite)**: The `_shared` import paths in `gmail-send-reply`, `gmail-send-first-message`,
  and `gmail-sync-now` MUST be corrected so the functions bundle and deploy (same class of fix as
  `inbox-twilio-send`, commit `6c59aa1`). No redeploy of these functions is possible until this is done.
- **FR-015**: The RLS policies on `inbox_conversations` and `inbox_messages` MUST be **verified against the
  live policies** to confirm they are org-scoped via `user_is_member_of_org(organization_id)` for all
  members — not assumed. Any gap found MUST be closed.
- **FR-016**: On a **permanent** Google token failure (`invalid_grant`) during send or sync, the system
  MUST set the org connection's `status` to `revoked` (an **existing** enum value — v1 adds **no** new
  status values) so subsequent send/sync stop treating it as active.
- **FR-017**: Org settings MUST surface a **"reconnect required"** indicator when the org's connection is
  in the `revoked` state, prompting an admin to reconnect (FR-008). Retries, error taxonomies, and
  notifications are explicitly out of scope for v1.
- **FR-018**: Frontend inbox queries (conversation list, conversation fetch, message fetch in
  `src/modules/inbox`) MUST NOT filter by `user_id` for email conversations — visibility is org-scoped and
  enforced by RLS. This feature MUST audit the `src/modules/inbox` `api/` and `hooks/` for
  `.eq('user_id', …)` filters on `inbox_conversations` / `inbox_messages` and remove them, so every org
  member sees the org's email threads in the inbox list (not only the connector).

### Architectural Constraints *(mandatory when relevant)*

- **AC-003 (RLS as boundary)**: Authorization MUST be enforced in the database via RLS; UI checks are not
  security. **Corollary for this feature**: edge functions that use the service-role client (send/sync)
  bypass RLS entirely, so they MUST additionally filter connection and conversation lookups by
  `organization_id` explicitly. RLS protects UI/anon-key reads, not service-role code.
- **AC-002 (Module boundaries)**: Frontend connect/disconnect UI MUST live under the appropriate settings
  module and MUST NOT deep-import other features' internals; shared helpers go through `src/shared/`.
- **Multi-tenancy guardrails**: Churchill is LIVE production. No direct data writes, no `supabase db push`;
  migrations are pasted into the Supabase Dashboard SQL editor by the maintainer; edge functions deploy via
  `supabase functions deploy <name>`. Show diffs before applying anything.

### Key Entities *(include if feature involves data)*

- **gmail_connections**: The org's email connection. Key attributes: `organization_id` (tenant scope,
  already present since migration …140300), `user_id` (connector/owner), `email_address` (the org mailbox
  identity), encrypted `refresh_token` (decrypted only in edge functions), `status`
  (`active` / non-active). New invariant: at most one `active` row per `organization_id`.
- **organization_members**: Source of truth for the admin gate (`role='admin'`) and for caller
  org-membership verification.
- **inbox_conversations / inbox_messages**: Shared inbox tables, `channel` includes email; each row scoped
  by `organization_id` and governed by org-member RLS. Sync stamps `organization_id`; send persists the
  outbound message on the conversation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of members of an org with an active connection can send an email reply that previously
  returned 404 — the pre-feature failure rate for non-connector members drops from "always fails" to "never
  fails for connection reasons".
- **SC-002**: Every organization has **at most one** active `gmail_connections` row after migration, and
  the partial unique index builds against live data with zero uniqueness violations.
- **SC-003**: In a two-org test, 0 cross-tenant sends occur — an Org A send never uses Org B's connection,
  verified with the service-role send path.
- **SC-004**: 100% of conversations/messages inserted by sync carry a non-null, correct `organization_id`
  and are visible to a second member of the org.
- **SC-005**: A non-admin's direct call to the connect/callback function is rejected (403) in 100% of
  attempts, regardless of UI state.
- **SC-006**: `gmail-send-reply`, `gmail-send-first-message`, and `gmail-sync-now` bundle and deploy
  cleanly (0 unresolved `_shared` import errors).

## Assumptions

- `gmail_connections` already carries `organization_id` (added migration …140300) and is already caught by
  the …140600 org-policy loop, so at the DB layer it is already org-member-scoped; this feature tightens
  uniqueness and fixes the send/sync/connect code paths rather than introducing org-scoping from scratch.
- The reply composer and inbox UI are already wired and live (`ConversationThread` → `useSendReply` →
  `gmail-send-reply` / `gmail-send-first-message`); no new send UI is required — the fix is server-side plus
  relocating the connect/disconnect control.
- `whatsapp-connect` is the reference implementation for the admin gate and org stamping and can be copied.
- Only the **live** Gmail functions are in scope: `gmail-send-reply`, `gmail-send-first-message`,
  `gmail-sync-now`, and the OAuth connect/callback function. The legacy `inbox-gmail-*` and `gmail-sync`
  functions are **out of scope** here and tracked separately for deletion.
- The org mailbox identity for SM is `info@searsmelvin.co.uk`; Churchill's mailbox identity is whatever its
  reconciled surviving active row carries.
- `gmail_connections.status='revoked'` **already exists and is in use** in production (14 revoked rows in
  live data), so FR-016 requires **no schema change** — it reuses the existing status value.

### Out of Scope

- Multiple mailboxes per organization (kept only as a future-additive schema path, FR-002).
- Per-user send identity (all send is from the org mailbox).
- The GHL inbox merge.
- SMS / phone reply.
- The legacy `inbox-gmail-*` functions and `gmail-sync` (tracked separately for deletion).

## Dependencies

- **Prerequisite (blocking)**: FR-014 `_shared` import-path fix must land before any of these functions can
  be redeployed.
- Reference docs: `specs/whatsapp-org-connection-pattern.md` (pattern to replicate + "Template to replicate
  for Gmail"), `specs/gmail-send-path-findings.md` (current state and root cause).
- Live-data reconciliation (FR-012) depends on maintainer-run migration in the Supabase Dashboard against
  Churchill (LIVE) and SM data.
