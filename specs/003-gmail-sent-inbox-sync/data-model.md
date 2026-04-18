# Data model: Gmail Sent sync

## Tables touched

### `inbox_conversations`

| Column | Use in this feature |
|--------|---------------------|
| `id` | PK |
| `channel` | Filter `email` |
| `external_thread_id` | **Backfill** from messages; **match key** for SENT sync (`= Gmail threadId`) |
| `user_id` / `organization_id` | Tenant scope (unchanged) |

**Note**: No `meta` column on this table in production introspection.

### `inbox_messages`

| Column | Use in this feature |
|--------|---------------------|
| `conversation_id` | FK to conversation |
| `channel` | `email` |
| `direction` | `inbound` / `outbound` — SENT imports use **outbound** |
| `gmail_connection_id` | Connection scope for dedupe |
| `meta` | JSON: `gmail.messageId`, `gmail.threadId` (confirmed paths) |
| `external_message_id` | **Backfill** from `meta`; **set on all new Gmail inserts**; unique with channel + connection |

### `gmail_connections`

| Column | Use |
|--------|-----|
| `id` | `gmail_connection_id` on messages |
| `last_synced_at` | Sync window (unchanged) |

## Backfill SQL (reference — final migration may batch)

**Conversations**: use `DISTINCT ON (conversation_id) … ORDER BY conversation_id, created_at ASC` so the thread id comes from the **oldest** message (avoids arbitrary `LIMIT 1` when multiple thread ids exist — **R20**). Implemented in `supabase/migrations/20260418120000_backfill_inbox_conversations_external_thread_id.sql`.

```sql
UPDATE public.inbox_conversations c
SET external_thread_id = subq.thread_id
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    meta->'gmail'->>'threadId' AS thread_id
  FROM public.inbox_messages
  WHERE channel = 'email'
    AND meta->'gmail'->>'threadId' IS NOT NULL
  ORDER BY conversation_id, created_at ASC
) subq
WHERE c.id = subq.conversation_id
  AND c.channel = 'email'
  AND c.external_thread_id IS NULL;
```

**Messages** (authoring note): set `external_message_id = meta->'gmail'->>'messageId'` where NULL and channel is email and meta path exists.

## Validation rules

- Before **UNIQUE** constraint: `SELECT channel, gmail_connection_id, external_message_id, COUNT(*) ... HAVING COUNT(*) > 1` on email rows with non-null external id — resolve duplicates.
- After backfill: sample `JOIN` conversations to messages on thread id consistency.

## State transitions

N/A (no state machine). Sync is idempotent if dedupe is correct.
