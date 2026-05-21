# Research: GHL Inbox — Phase 1 (Read-Only)

**Branch**: `009-ghl-inbox-readonly` | **Date**: 2026-05-21

## 1. GHL API base and authentication

**Decision**: Use GHL API v2 at `https://services.leadconnectorhq.com` with Private Integration Token (PIT) auth.

**Rationale**: Settled in feature brief; matches HighLevel Conversations API docs and existing pilot credentials model.

**Request headers** (all server-side `ghl-fetch` / `ghl-mark-read` calls):

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer pit-…` from `GHL_API_KEY` secret |
| `Version` | `2021-07-28` (project standard; docs often show `2021-04-15` or `2023-02-21` — use project value consistently) |
| `Accept` | `application/json` |

**Alternatives considered**: Sub-account OAuth user tokens — rejected for Phase 1 (no OAuth UI; PIT already available for Sears Melvin pilot).

---

## 2. Read API endpoints (ghl-fetch actions)

**Decision**: Proxy these GHL REST operations from `ghl-fetch` (JWT + org membership gate):

| Action | GHL endpoint | Notes |
|--------|--------------|--------|
| `listConversations` | `GET /conversations/search` | Pass `locationId` from org’s `ghl_connections.ghl_location_id`; map `unreadCount` for badges |
| `getConversation` | `GET /conversations/:conversationId` | Optional detail refresh; includes `unreadCount` |
| `getMessages` | `GET /conversations/:conversationId/messages` | Cursor pagination via `lastMessageId` + `limit` (see below) |
| `getContact` | `GET /contacts/:contactId` | Contact panel |
| `listContacts` | `GET /contacts/` or search endpoint | Only if needed for empty-state search; default panel uses contact from conversation |

**Rationale**: Documented in [HighLevel Conversations API](https://marketplace.gohighlevel.com/docs/ghl/conversations/conversations/) and Contacts API.

**Alternatives considered**: Storing messages in Mason — rejected (read-through only).

**Implementation note**: Email message bodies may require `GET /conversations/messages/:messageId` per message when list payload omits full HTML (documented GHL limitation). Phase 1 can show list `body` / `plainText` where present and defer full email HTML fetch unless UAT requires it.

### `getMessages` pagination (locked)

**Source**: [Get messages by conversation id](https://marketplace.gohighlevel.com/docs/ghl/conversations/get-messages/) — Query parameters and response schema.

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `limit` | number | `20` | Page size (max messages per request) |
| `lastMessageId` | string | — | Cursor: ID of the last message from the previous page |
| `type` | string | — | Optional comma-separated message type filter (Phase 1: omit = all types) |

**Response fields** (wrapper object `messages`):

| Field | Type | Meaning |
|-------|------|---------|
| `messages` | array | Message objects for this page |
| `lastMessageId` | string | Cursor for next request |
| `nextPage` | boolean | `true` when more pages exist |

**Pagination algorithm** (`ghl-fetch` / frontend):

1. First request: `GET …/messages?limit={n}` (no `lastMessageId`).
2. While `nextPage === true`, repeat with `lastMessageId` set to the previous response’s `lastMessageId`.
3. Phase 1 default `limit`: `50` for Mason (override via contract); stop after a sane cap (e.g. 10 pages) to avoid runaway threads — document in implementation if a thread exceeds cap.

**Scope**: `conversations/message.readonly` (documented on the same page).

---

## 3. Mark-as-read API (ghl-mark-read)

**Documentation gap**: The marketplace pages for [Update Conversation](https://marketplace.gohighlevel.com/docs/ghl/conversations/update-conversation/) and [Update message status](https://marketplace.gohighlevel.com/docs/ghl/conversations/update-message-status/) render **no OpenAPI request-body schema** in the public docs (verified 2026-05-21). Do not assume unpublished fields without a live API check.

**Decision — try cheap path first, fall back to expensive path**:

### Cheap path (single GHL call — try first)

| Item | Value |
|------|--------|
| **Endpoint** | `PUT https://services.leadconnectorhq.com/conversations/:conversationId` |
| **Scope** | `conversations.write` |
| **Request body (proposed — GAP)** | `{ "unreadCount": 0 }` — **not** listed on the Update Conversation doc page; supported by [@gohighlevel/api-client examples](https://context7.com/gohighlevel/highlevel-api-sdk) and [ConversationUnreadUpdate](https://marketplace.gohighlevel.com/docs/webhook/ConversationUnreadWebhook/) (`unreadCount: 0`). **Verify on first live test.** |

**When cheap path succeeds (2xx)**: Return `ok: true`. Optionally confirm with `GET /conversations/:conversationId` that `unreadCount === 0`.

### Expensive path (only if cheap path returns 4xx)

| Item | Value |
|------|--------|
| **Endpoint** | `PUT https://services.leadconnectorhq.com/conversations/messages/:messageId/status` |
| **Scope** | `conversations/message.write` |
| **Request body (proposed — GAP)** | `{ "status": "read" }` — inferred from `status` enum on [Get message](https://marketplace.gohighlevel.com/docs/ghl/conversations/get-message/). Validate body on first live call if cheap path fails. |

**Expensive-path algorithm**:

1. `GET /conversations/:conversationId/messages` (paginate per §2).
2. For each message where `direction === "inbound"` and `status` is not already `read` (and not `opened` if UAT treats that as read), call `PUT …/messages/:messageId/status` with `{ "status": "read" }`.
3. If `GET /conversations/:conversationId` still shows `unreadCount > 0`, return 502 with a safe error (do not claim success).

**Rationale**: One conversation-level PUT minimizes latency and API quota when GHL accepts it; the per-message loop is the documented alternative when the undocumented conversation body is rejected.

**Alternatives considered**: Always use expensive path first — rejected (unnecessary load if cheap path works). Mason-only unread — rejected.

---

## 4. Webhook events to subscribe (Arin instruction sheet)

**Decision**: Subscribe to these **documented** webhook `type` values (payload includes top-level `type` and `locationId`):

| Event `type` | Purpose in Mason |
|--------------|------------------|
| `InboundMessage` | New inbound SMS/WhatsApp/email/etc.; refresh thread + list |
| `OutboundMessage` | Messages sent from GHL app/workflows; keep list/thread fresh |
| `ContactCreate` | New contact may start new conversation threads |
| `ContactUpdate` | Contact panel fields change |

**Rationale**: Official webhook docs: [InboundMessage](https://marketplace.gohighlevel.com/docs/webhook/InboundMessage/), [OutboundMessage](https://marketplace.gohighlevel.com/docs/webhook/OutboundMessage/), Contact events in [Webhook Integration Guide](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/).

**Not subscribed in Phase 1**: Opportunity, appointment, invoice, task events — out of scope.

**Alternatives considered**: Conversation-specific webhook types — none found as separate public types; conversation freshness covered by message webhooks + search refetch.

**Unread-only events**: No dedicated “conversation read” webhook required; mark-as-read is user-initiated from Mason and updates cache on mutation success.

---

## 5. Webhook signature verification (Phase 1 posture A)

**Decision**: **Marketplace-style asymmetric signatures only.** No `GHL_WEBHOOK_SECRET` (or other shared HMAC secret) env var in Phase 1.

**Source**: [Webhook Integration Guide — Security: Verifying Webhook Authenticity](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/#security-verifying-webhook-authenticity)

| Header | Algorithm | Doc section | Public key source |
|--------|-----------|-------------|-------------------|
| `X-GHL-Signature` | **Ed25519** | “GHL Signature (Ed25519) public key — for X-GHL-Signature” | PEM constant **published inline** in the same guide (not fetched at runtime). Embed in `supabase/functions/_shared/ghlWebhookVerify.ts`. |
| `X-WH-Signature` | **RSA-SHA256** | “Legacy (RSA) public key — for X-WH-Signature” | PEM constant **published inline** in the same guide. Use only when `X-GHL-Signature` is absent (transition until **2026-07-01** per guide). |

**Verification flow** (quoted behaviour from guide — “Recommended verification flow”):

1. Read raw request body as bytes/string **before** JSON parse.
2. If `X-GHL-Signature` is present → verify with Ed25519 public key (`crypto.verify` in Deno).
3. Else if `X-WH-Signature` is present → verify with RSA-SHA256 public key (`createVerify('SHA256')` pattern from guide).
4. Else → reject (400).

**Gap / not in docs**: Timestamp/replay-window validation (`webhookId`, timestamp headers mentioned in changelog) — **not implemented in Phase 1**.

**Replay protection deferred to Phase 2**: Phase 1 webhooks only bump `ghl_connections.updated_at`, which causes already-authenticated browsers to refetch GHL data through JWT-protected Edge proxies. A replayed webhook cannot exfiltrate the PIT, write to GHL on Mason’s behalf, or corrupt Mason database state beyond an extra cache refresh. That risk profile is acceptable for read-only Phase 1; replay windows and nonce tracking will be revisited when Phase 2 adds outbound send and stronger write-side effects.

**Rationale**: Phase 1 simplicity; official guide supplies keys and algorithms; no Arin-generated shared secret required for standard GHL webhooks.

**Alternatives considered**: Dual HMAC + asymmetric (posture B) — rejected for Phase 1.

---

## 6. Live updates without persisting GHL messages

**Decision**: **Pulse `ghl_connections.updated_at`** from `ghl-webhook` (service role) after verified events matching `ghl_location_id` → `organization_id`. Frontend subscribes to Supabase Realtime `postgres_changes` **UPDATE** on `public.ghl_connections` filtered by `organization_id`, debounces 300–500 ms, then invalidates React Query keys (`ghlInboxKeys.*`).

**Rationale**:

- Spec allows **only** `ghl_connections` schema change — no signal/event table.
- Matches unified inbox pattern (Realtime → invalidate, not patch cache).
- Idempotent: repeated webhooks only bump timestamp.

**Alternatives considered**:

| Alternative | Why rejected |
|-------------|----------------|
| `postgres_changes` on message table | No GHL message table in Mason |
| Realtime Broadcast channel | Extra complexity; not used elsewhere |
| Poll every N seconds | Fallback only; webhook is primary |

**Migration requirement**: Add `ghl_connections` to Supabase Realtime publication (SQL in migration or documented Dashboard step in quickstart).

---

## 7. Org resolution and credentials (multi-tenant)

**Decision**:

- **ghl-fetch / ghl-mark-read**: `getUserFromRequest` → require body `organizationId` → `isUserInOrganization` → load `ghl_connections` where `organization_id` + `status = 'active'`.
- **PIT**: Phase 1 pilot uses global `GHL_API_KEY` secret; **location** comes from `ghl_connections.ghl_location_id` (must match `GHL_LOCATION_ID` secret for pilot or validation fails).
- **ghl-webhook**: No JWT; map `payload.locationId` → `ghl_connections.ghl_location_id` → org; ignore unknown locations (200 OK, no pulse).

**Rationale**: Aligns with `specs/002-multi-org-tenancy/contracts/edge-function-tenant.md` and user AC-006.

**Alternatives considered**: Trust client `organizationId` alone — rejected.

---

## 8. Admin connection management (pilot scope)

**Decision**: **Pilot**: Sears Melvin org row **seeded** via migration/SQL + Edge secrets (`GHL_API_KEY`, `GHL_LOCATION_ID`). **Minimal admin UI** in Phase 1 — not a full connect wizard.

| Audience | UI |
|----------|-----|
| All members | Read-only connection status on GHL Inbox when not `active` (banner/empty state) |
| Org admin (`isOrgAdmin`) | On GHL Inbox (or Settings subsection): show `status`, `ghl_location_id` (last 4 chars), `last_verified_at`; **Disconnect** sets `status = 'disconnected'` via Supabase update (RLS) |
| Out of Phase 1 pilot | In-app “Connect GHL” flow, OAuth, multi-step location picker, INSERT of new connection from UI |

**Data layer**: CRUD on `ghl_connections` via Supabase + RLS (`user_is_member_of_org` SELECT; `user_is_admin_of_org` INSERT/UPDATE/DELETE).

**Alternatives considered**: US6 fully out of scope — rejected (admins need disconnect); full connect UI — deferred post-pilot.

---

## 9. UI layout reference

**Decision**: Mirror unified inbox **two-pane** layout (list + thread) plus **contact side panel**; reuse gardens/shadcn patterns from `src/modules/inbox` visually but **no imports** from inbox module internals.

**Composer**: Disabled textarea + badge `"Read-only preview — outbound coming in Phase 2"` fixed at thread bottom.

**Route**: `/dashboard/ghl-inbox` in `src/app/router.tsx`.

---

## 10. Production target

**Decision**: Migrations and function deploy target Supabase project ref **`bfwohzcugtwbhhxdqgme`** only.

**Webhook URL pattern**:

```text
https://bfwohzcugtwbhhxdqgme.supabase.co/functions/v1/ghl-webhook
```

(Confirm exact project URL in Arin sheet from Dashboard → Edge Functions.)
