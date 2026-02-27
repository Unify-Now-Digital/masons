# Edge Function: gmail-send-reply

## Purpose

Send an email reply via the user's connected Gmail and record the sent message in inbox_messages (outbound) with user_id and gmail_connection_id.

## Auth

- **JWT required.** Verify Supabase Auth. Resolve user_id from JWT.

## Request

- **Method:** POST.
- **Headers:** `Authorization: Bearer <supabase_jwt>`.
- **Body:** `{ "conversation_id": "uuid", "message_body": "string", "subject": "string" (optional) }`.

## Response

- **200:** `{ "ok": true, "message_id": "uuid" }` (inbox_messages id of the sent row).
- **401:** `{ "error": "Unauthorized" }`.
- **404:** `{ "error": "No Gmail connection" }` or conversation not found for this user.
- **400:** Validation error (missing body, etc.).
- **500:** `{ "error": "..." }`.

## Behavior

- Load active gmail_connection for user_id (service role). If none, 404.
- Load conversation (must belong to user_id via RLS or explicit check). Get thread id / message id for Gmail send.
- Use Gmail API to send message (refresh token → access token). Insert row into inbox_messages (direction = outbound, user_id, gmail_connection_id, conversation_id). Never return tokens.
