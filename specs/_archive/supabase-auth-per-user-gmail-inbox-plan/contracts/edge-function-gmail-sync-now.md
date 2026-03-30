# Edge Function: gmail-sync-now

## Purpose

Sync Gmail messages "from now onward" for the authenticated user using their active gmail_connections row. Writes to inbox_conversations and inbox_messages with user_id and gmail_connection_id.

## Auth

- **JWT required.** Verify Supabase Auth. Return 401 if missing/invalid. Resolve user_id from JWT.

## Request

- **Method:** POST.
- **Headers:** `Authorization: Bearer <supabase_jwt>`.
- **Body (optional):** `{ "since": "<ISO timestamp>" }` for incremental sync; otherwise use stored last_synced_at or "now" for first sync.

## Response

- **200:** `{ "ok": true, "synced": number }` or similar (no tokens).
- **401:** `{ "error": "Unauthorized" }`.
- **404:** `{ "error": "No Gmail connection" }` if user has no active gmail_connection.
- **500:** `{ "error": "..." }`.

## Behavior

- Load active gmail_connection for user_id (service role). If none, 404.
- Use refresh_token to get access_token; call Gmail API (messages list + get) with "from now onward" (after: or historyId / last_synced_at). Store last_synced_at on gmail_connections or in a small sync_state table.
- Write inbox_conversations and inbox_messages with user_id and gmail_connection_id; never expose refresh_token or access_token in response.
