# Contract: `ghl-fetch` Edge Function

## Purpose

Authenticated read-through proxy to GHL API v2. Private Integration Token never leaves the server.

## Transport

- **Method**: `POST`
- **URL**: `{SUPABASE_URL}/functions/v1/ghl-fetch`
- **Auth**: `Authorization: Bearer <supabase_jwt>` (user session)
- **Body**: JSON

## Shared request fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `organizationId` | `string` (uuid) | Yes | Active org; server verifies membership |

## Actions

### `listConversations`

**Body**

```json
{
  "action": "listConversations",
  "organizationId": "uuid",
  "limit": 50,
  "status": "all"
}
```

Optional query passthrough: `limit`, `status`, `sort`, `sortBy` — map to GHL `GET /conversations/search` query params per live API docs.

**Response 200**

```json
{
  "ok": true,
  "conversations": [
    {
      "id": "string",
      "contactId": "string",
      "locationId": "string",
      "unreadCount": 0,
      "lastMessageDate": "ISO-8601",
      "lastMessageBody": "string | null"
    }
  ]
}
```

Shape mirrors GHL response subset; extra GHL fields may pass through in `raw` only if needed for debugging (prefer explicit mapping).

---

### `getMessages`

**Body**

```json
{
  "action": "getMessages",
  "organizationId": "uuid",
  "conversationId": "string",
  "limit": 50,
  "lastMessageId": "string | null"
}
```

| Field | Required | Default | Maps to GHL query |
|-------|----------|---------|-------------------|
| `limit` | No | `50` | `limit` (GHL default **20** if omitted) |
| `lastMessageId` | No | `null` | `lastMessageId` cursor for next page |

**Upstream**: `GET /conversations/:conversationId/messages`  
**Doc**: [Get messages by conversation id](https://marketplace.gohighlevel.com/docs/ghl/conversations/get-messages/)  
**Scope**: `conversations/message.readonly`

**Pagination** (server may aggregate pages before responding):

1. Call GHL with `limit` from request.
2. While GHL returns `messages.nextPage === true`, call again with `lastMessageId = messages.lastMessageId`.
3. Concatenate `messages.messages[]` in chronological order (API order as returned).
4. Optional safety cap: stop after 10 pages and return partial list + `truncated: true` in response.

**Response 200**

```json
{
  "ok": true,
  "messages": [
    {
      "id": "string",
      "body": "string | null",
      "plainText": "string | null",
      "direction": "inbound | outbound",
      "dateAdded": "ISO-8601",
      "messageType": "string",
      "status": "string"
    }
  ],
  "lastMessageId": "string",
  "nextPage": false,
  "truncated": false
}
```

When the client passes `lastMessageId`, the function MAY return a **single** GHL page only (for “load older” UI in a later iteration). Phase 1 default: server aggregates all pages up to the safety cap.

---

### `getContact`

**Body**

```json
{
  "action": "getContact",
  "organizationId": "uuid",
  "contactId": "string"
}
```

**Upstream**: `GET /contacts/:contactId`

**Response 200**

```json
{
  "ok": true,
  "contact": {
    "id": "string",
    "name": "string | null",
    "firstName": "string | null",
    "lastName": "string | null",
    "email": "string | null",
    "phone": "string | null"
  }
}
```

---

### `getConversation` (optional)

**Body**

```json
{
  "action": "getConversation",
  "organizationId": "uuid",
  "conversationId": "string"
}
```

**Upstream**: `GET /conversations/:conversationId` — includes `unreadCount`.

## Server-side GHL HTTP

```http
GET https://services.leadconnectorhq.com/...
Authorization: Bearer {GHL_API_KEY}
Version: 2021-07-28
Accept: application/json
```

`locationId` query param must equal `ghl_connections.ghl_location_id` for the verified org.

## Error responses

| Status | `error` | When |
|--------|---------|------|
| 401 | `Unauthorized` | Missing/invalid JWT |
| 403 | `Forbidden` | Not org member |
| 404 | `No GHL connection` | No active `ghl_connections` row |
| 502 | `GHL API error` | Upstream failure (include safe message) |
| 400 | `Invalid request` | Unknown action or missing ids |

## Security

- Reject if `organizationId` fails `organization_members` check.
- Do not log `GHL_API_KEY` or full message bodies in production logs.
- CORS: same pattern as other JWT edge functions (`authorization, apikey, content-type`).

## Client usage

```typescript
const { data, error } = await supabase.functions.invoke('ghl-fetch', {
  body: { action: 'listConversations', organizationId },
});
```
