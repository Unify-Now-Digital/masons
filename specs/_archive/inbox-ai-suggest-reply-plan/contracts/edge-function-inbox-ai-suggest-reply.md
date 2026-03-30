# Contract: Edge Function inbox-ai-suggest-reply

## Request

- **Method:** POST
- **Headers:** Authorization: Bearer \<user JWT\> (Supabase auth). Content-Type: application/json.
- **Body:** `{ "message_id": "<uuid>" }`

## Success response (200)

- **Body:** `{ "suggestion": "<string>" }`
- The string is the suggested reply text (one short reply).

## Error responses

- **400** — Invalid or missing `message_id`. Body: `{ "error": "message_id is required" }` or similar.
- **404** — Message not found or not inbound. Body: `{ "error": "Message not found or not inbound" }`.
- **500** — OpenAI or database error. Body: `{ "error": "<message>" }`.

## Behavior

1. Verify request is authenticated (Supabase JWT).
2. Parse body; validate message_id (uuid).
3. Fetch message from inbox_messages (service role). If not found or direction !== 'inbound', return 404.
4. Look up inbox_ai_suggestions by message_id. If found, return { suggestion: row.suggestion_text }.
5. Call OpenAI Responses API (model gpt-4o-mini) with message body only; structured output { suggestion: string }.
6. Insert row into inbox_ai_suggestions (message_id, suggestion_text). Return { suggestion: suggestion_text }.
