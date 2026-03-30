# Contract: `inbox-ai-thread-summary` — `unlinked_timeline` scope

## Request (POST JSON)

```json
{
  "scope": "unlinked_timeline",
  "channel": "email",
  "handle": "user@example.com"
}
```

- `channel`: required; one of `email`, `sms`, `whatsapp`.
- `handle`: required; non-empty; exact DB match for `inbox_conversations.primary_handle`.

## Auth

- Same as existing function: user JWT and/or internal key.

## Behavior

1. Resolve `user_id` from JWT.
2. Query `inbox_conversations`: `user_id`, `status = 'open'`, `person_id IS NULL`, `channel`, `primary_handle = handle`.
3. Load messages for those conversation ids; sort like unified timeline; fingerprint; OpenAI if needed.
4. Read/write `inbox_ai_thread_summaries` for `scope = 'unlinked_timeline'` + `user_id` + channel + handle.

## Response

- Same shape as today: `{ "summary": "..." }` or `{ "summary": null }` or `{ "error": "..." }`.

## Errors

- 400: missing/invalid channel or handle.
- 403/404: no access or no matching conversations (treat as empty transcript per product choice — align with `customer_timeline` empty handling).
