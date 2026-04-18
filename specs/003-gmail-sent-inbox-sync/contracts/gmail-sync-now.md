# Contract: `gmail-sync-now` Edge Function

**Path**: `POST {SUPABASE_FUNCTIONS_URL}/gmail-sync-now`  
**Auth**: `Authorization: Bearer <Supabase JWT>` (same as today)

## Request

**Headers**: `Content-Type: application/json`, `Authorization` required.

**Body** (JSON, optional):

| Field | Type | Description |
|-------|------|-------------|
| `since` | string (ISO date) | Optional lower bound; same semantics as current implementation |

## Response

**200 OK**

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | `true` on success |
| `synced` | number | Count of **newly inserted** messages in this run (current behaviour) |

**Optional extension** (non-breaking if added): `synced_inbox`, `synced_sent` integers — only if product wants visibility; clients must treat unknown fields as optional.

## Errors

| Status | Meaning |
|--------|---------|
| 401 | Missing/invalid JWT |
| 403 | No organization membership |
| 404 | No active Gmail connection |
| 405 | Method not allowed |
| 500 | Server configuration |
| 502 | Gmail API or token failure |

## Behavioural contract (this feature)

- After deployment: sync considers both **INBOX** and **SENT** labelled mail (within the same time window rules as today).
- Duplicate Gmail messages must not create a second `inbox_messages` row.
- SENT messages without a matching conversation (by thread id) are **not** inserted (orphan skip); may log server-side warning.
