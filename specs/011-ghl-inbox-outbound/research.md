# Research: GHL Inbox — Phase 2 (Outbound Send)

**Branch**: `011-ghl-inbox-outbound` | **Date**: 2026-06-01

## 1. GHL send-message endpoint

**Decision**: Use `POST https://services.leadconnectorhq.com/conversations/messages` with Private Integration Token auth via existing `ghlFetch()` helper.

**Rationale**: Official [Send a new message](https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message) endpoint; same base host as Phase 1 read/mark-read paths.

| Item | Value |
|------|--------|
| **Scope** | `conversations/message.write` (verify on each org PIT — Gate G1) |
| **Auth** | Bearer PIT from `getActiveGhlConnectionWithKey` |
| **Method** | `POST` |
| **Path** | `/conversations/messages` |

**Alternatives considered**: Separate channel-specific endpoints — rejected; single endpoint accepts `type` discriminator.

---

## 2. Version header and request body (Gate G2)

**Decision (provisional — confirm in G2 smoke test)**: Call via `ghlFetch()` using project-standard `Version: 2021-07-28`. If GHL returns 400/406 indicating version mismatch, retry once with `2021-04-15` (documented as the Conversations send endpoint version in community API docs and `gohighlevel-go` SDK).

**Rationale**: Phase 1 locked `2021-07-28` for all GHL calls and it works for read + mark-read. Marketplace page for send shows `2023-02-21` as page version but request header enum lists `2021-04-15`. Consistency vs compatibility must be verified live before coding the final payload.

### Request body (locked after G2)

Minimum outbound reply payload (org-default voice — **no `userId`**):

```json
{
  "type": "SMS",
  "contactId": "<GHL contact id>",
  "conversationId": "<GHL conversation id>",
  "message": "<plain text>",
  "status": "pending"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | Yes | One of `SMS`, `Email`, `WhatsApp`, `IG`, `FB`, `Live_Chat` — derived client-side from conversation channel |
| `contactId` | Yes | From selected conversation |
| `conversationId` | Yes | Targets existing thread; include even though not always listed in doc examples |
| `message` | Yes | Plain text; trim server-side |
| `status` | Yes | GHL schema marks required; use `"pending"` for outbound sends (SDK uses `"delivered"` for a different pattern — prefer `"pending"` for live provider dispatch) |
| `userId` | **Omit** | Org-default sender voice per spec |

**Email-only fields** (`subject`, `html`, `emailFrom`, etc.): omit in v1; GHL uses contact/conversation context.

**Alternatives considered**: Sending only `contactId` without `conversationId` — rejected; explicit thread targeting reduces wrong-thread delivery risk.

---

## 3. GHL idempotency support

**Decision**: GHL `POST /conversations/messages` does **not** document an idempotency key header or body field. Mason MUST implement server-side dedupe.

**Rationale**: Inbound message API (`POST /conversations/inbound-messages`) documents `idempotencyKey`, but outbound send does not. Double-submit protection cannot rely on GHL.

**Alternatives considered**:
- In-memory Edge lock — rejected (stateless invocations).
- Client-only lock — rejected (insufficient for retry-after-timeout).

---

## 4. Mason idempotency store

**Decision**: New table `public.ghl_send_idempotency` keyed by client-generated `request_id` (UUID v4).

**Rationale**: Durable across Edge invocations; stores only metadata (no message body); service-role writes from Edge Function.

**Flow**:

1. Client generates fresh `requestId` per Send click (new UUID each intentional send).
2. Edge attempts `INSERT` with status `pending`.
3. If `request_id` exists with `completed` → return cached `{ messageId, … }` without calling GHL.
4. If `request_id` exists with `pending` and age &lt; 60s → return `409` `{ error: 'Send already in progress' }`.
5. If `pending` stale (&gt;60s) → treat as abandoned; allow retry path (operator decision: fail safe — return error asking user to retry with **new** requestId from client).
6. On GHL success → `UPDATE` row to `completed` + store `ghl_message_id`.
7. On definitive GHL failure → `UPDATE` to `failed`; client generates **new** `requestId` for user retry.

**Alternatives considered**: Redis — rejected (not in stack). Hash in `ghl_connections` — rejected (wrong granularity).

---

## 5. Feature flag storage

**Decision**: `ghl_connections.outbound_enabled boolean NOT NULL DEFAULT false`.

**Rationale**: Follows existing per-org connection model; Edge Function already loads connection row; frontend already reads `ghl_connections` via `useGhlConnection`.

**Enablement**: v1 via Dashboard SQL after clean test (`UPDATE ghl_connections SET outbound_enabled = true WHERE organization_id = '…'`). No in-app admin toggle required for v1.

**Alternatives considered**: Edge secret list of org UUIDs — rejected (operational friction, not self-service).

---

## 6. Channel type derivation (client-side)

**Decision**: Derive GHL send `type` from the open conversation's message history — use the **most recent message's `messageType`**, normalized to the send API enum.

**Mapping** (extend as UAT discovers variants):

| Thread `messageType` (examples) | Send `type` |
|----------------------------------|-------------|
| `SMS`, `TYPE_SMS`, `sms` | `SMS` |
| `Email`, `TYPE_EMAIL`, `email` | `Email` |
| `WhatsApp`, `TYPE_WHATSAPP`, `whatsapp` | `WhatsApp` |
| `IG`, `TYPE_IG`, `instagram` | `IG` |
| `FB`, `TYPE_FB`, `facebook` | `FB` |
| `Live_Chat`, `live_chat` | `Live_Chat` |

**Fallback**: If thread empty or type unmapped, disable Send and show inline hint ("Cannot determine channel for this conversation").

**Rationale**: Spec forbids channel picker; conversation object from `listConversations` does not currently expose channel in Mason's mapper — messages already carry `messageType`.

**Alternatives considered**: New `ghl-fetch` action to return conversation `type` field — defer unless messageType mapping fails in UAT.

---

## 7. Frontend send UX

**Decision**: Replace `GhlReadOnlyComposer` with `GhlComposer` in the same DOM position.

**States**:

| State | UI |
|-------|-----|
| Outbound disabled | Disabled textarea + explanation copy (replaces Phase 1 read-only label) |
| Composing | Enabled textarea; Send enabled when trimmed text non-empty |
| Sending | Send disabled; loading indicator; textarea read-only |
| Success | Clear textarea; optimistic outbound bubble; invalidate messages query |
| Error | Preserve textarea content; show error banner/toast with GHL message |

**Optimistic append**: Temporary message `{ id: 'optimistic-{requestId}', direction: 'outbound', body: text, dateAdded: now }` until re-fetch replaces with GHL message.

**Alternatives considered**: Wait for webhook before showing sent message — rejected (slower UX); invalidate + optimistic is Phase 1 pattern (`useGhlMarkRead`).

---

## 8. Error surfacing

**Decision**: Edge returns structured error:

```json
{
  "ok": false,
  "error": "Human-readable summary",
  "ghlStatus": 400,
  "ghlMessage": "Raw GHL message field when present"
}
```

**WhatsApp 24-hour window**: Pass through GHL 400 body; UI shows `ghlMessage` or mapped friendly copy if recognizable.

**Alternatives considered**: Generic "Send failed" only — rejected; operators need GHL rejection text for support.

---

## 9. Security and multi-org isolation

**Decision**: Reuse established chain: JWT → `requireOrgMember` → `getActiveGhlConnectionWithKey(organizationId)` → GHL call. Reject if client `organizationId` does not match session org membership.

**Rationale**: Identical to `ghl-fetch` / `ghl-mark-read`; satisfies AC-006 and FR-006.

---

## 10. Deployment and environment

**Decision**:

- Deploy: `npx supabase functions deploy ghl-send-message --project-ref bfwohzcugtwbhhxdqgme`
- **Do not** use `--no-verify-jwt` (only `ghl-webhook` uses that)
- Secrets in Bitwarden; never commit PITs
- Copy GHL location IDs via UI copy button (capital-I vs lowercase-l issue documented in handoff)

**Rollout**: Test sub-account + developer phone first; enable `outbound_enabled` per org; Churchill last.
