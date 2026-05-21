# Contract: `ghl-mark-read` Edge Function

## Purpose

Phase 1’s **only write** to GHL: clear unread state for a conversation so Mason and GHL native UI stay aligned.

**Locked behaviour** (see `research.md` §3): **try cheap path first** (`unreadCount: 0` on the conversation); on **4xx**, fall back to the **expensive path** (paginate messages + per-message status updates).

## Transport

- **Method**: `POST`
- **URL**: `{SUPABASE_URL}/functions/v1/ghl-mark-read`
- **Auth**: `Authorization: Bearer <supabase_jwt>`

## Request

```json
{
  "organizationId": "uuid",
  "conversationId": "string"
}
```

| Field | Required | Validation |
|-------|----------|------------|
| `organizationId` | Yes | UUID; user must be org member |
| `conversationId` | Yes | Non-empty string |

## GHL upstream calls (server)

Headers on every GHL request: `Authorization: Bearer {GHL_API_KEY}`, `Version: 2021-07-28`, `Accept: application/json`.

### Cheap path (try first)

```
PUT https://services.leadconnectorhq.com/conversations/:conversationId
Content-Type: application/json

{ "unreadCount": 0 }
```

| Item | Detail |
|------|--------|
| **Scope** | `conversations.write` |
| **Doc** | [Update Conversation](https://marketplace.gohighlevel.com/docs/ghl/conversations/update-conversation/) — request body **GAP** on marketplace page |
| **Success** | HTTP 2xx → return `ok: true` (optional: confirm `unreadCount === 0` via GET conversation) |
| **Failure** | HTTP 4xx → proceed to expensive path (do not return error yet) |

### Expensive path (only after cheap path 4xx)

```
PUT https://services.leadconnectorhq.com/conversations/messages/:messageId/status
Content-Type: application/json

{ "status": "read" }
```

| Item | Detail |
|------|--------|
| **Scope** | `conversations/message.write` |
| **Doc** | [Update message status](https://marketplace.gohighlevel.com/docs/ghl/conversations/update-message-status/) |
| **Selection** | Paginate `GET …/messages` (see `ghl-fetch.md`). For each inbound message not already `read` / `opened`, invoke PUT status. |

If expensive path completes but `GET /conversations/:id` still has `unreadCount > 0`, return **502**.

## Server behaviour (summary)

1. Authenticate JWT → verify org membership.
2. Load active `ghl_connections` for org.
3. **Cheap path**: `PUT` conversation with `{ "unreadCount": 0 }`.
4. On 4xx only: **expensive path** (message status loop).
5. Return success/failure JSON (do not leak PIT).

## Response 200

```json
{
  "ok": true,
  "conversationId": "string",
  "path": "cheap | expensive",
  "messagesUpdated": 0
}
```

`messagesUpdated` > 0 only when expensive path ran.

## Error responses

Same semantics as `ghl-fetch` (401/403/404/502).

## Client behaviour (React Query)

On success:

```typescript
queryClient.invalidateQueries({ queryKey: ghlInboxKeys.conversations(organizationId) });
queryClient.invalidateQueries({
  queryKey: ghlInboxKeys.messages(organizationId, conversationId),
});
```

## Idempotency

Repeat calls when already read should return `ok: true` without user-visible error.
