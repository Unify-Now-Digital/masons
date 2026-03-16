# Data model (reference)

No schema changes required. Backfill only **updates** existing rows.

**inbox_messages (relevant):**  
`id`, `user_id`, `gmail_connection_id`, `conversation_id`, `channel`, `body_text`, `sent_at`, `meta` (JSONB: `gmail.messageId`, `gmail.threadId`).

**inbox_conversations (relevant):**  
`id`, `last_message_at`, `last_message_preview`.

Eligibility: `channel = 'email'` and `(meta->'gmail'->>'messageId') IS NOT NULL`.
