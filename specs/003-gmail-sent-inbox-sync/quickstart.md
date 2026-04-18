# Quickstart: Verify Gmail Sent sync

## Gmail message identity (dedupe)

For synced email rows, **`external_message_id`** is the **single source of truth** for deduplication. It must match the Gmail API message id and **`meta.gmail.messageId`** — **set both together** on every insert (inbound and outbound); never populate one without the other.

The **T004** unique partial index on **`(meta->'gmail'->>'messageId')`** (with `gmail_connection_id`) is a **database bridge** to catch duplicates when JSON is present; application logic should prefer **`external_message_id`** for pre-checks and `ON CONFLICT`. See task **T011** in `tasks.md`. Addresses **R22**.

## T005 — Post-migration verification (SQL)

Run in the Supabase SQL editor **after** migrations **T002–T004** are applied:

**1. Conversations have thread ids (sample):**

```sql
SELECT id, external_thread_id
FROM public.inbox_conversations
WHERE channel = 'email'
LIMIT 50;
```

**2. No duplicate Gmail message ids per connection (must return 0 rows):**

```sql
SELECT gmail_connection_id, meta->'gmail'->>'messageId' AS mid, count(*) AS c
FROM public.inbox_messages
WHERE channel = 'email'
  AND (meta->'gmail'->>'messageId') IS NOT NULL
GROUP BY 1, 2
HAVING count(*) > 1;
```

**3. Index exists:**

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'inbox_messages'
  AND indexname = 'idx_inbox_messages_email_gmail_connection_meta_message_id';
```

## Prerequisites

- Staging Supabase project with migrations **T002–T004** (backfills + unique index) applied.
- Gmail test account connected to the app (OAuth).
- At least one **existing email conversation** in the app imported from INBOX (so `external_thread_id` is populated after backfill).

## Steps

1. **Backfill check**: In SQL editor, `SELECT id, external_thread_id FROM inbox_conversations WHERE channel = 'email' LIMIT 20` — non-null `external_thread_id` expected after migration.
2. **Send outside app**: Open Gmail in browser; reply in a thread that already appears in the Mason inbox.
3. **Sync**: In the app, trigger **Sync Gmail** (same action as today).
4. **Assert**: Open the conversation — the Gmail web reply appears as **outbound**, chronological order preserved, **no duplicate** lines.
5. **Re-sync**: Run sync again — message count must not increase for that Gmail message.

## Failure hints

- **No outbound row**: Migration not applied (conversation `external_thread_id` still null) or SENT list not implemented.
- **Duplicate rows**: `external_message_id` not set or unique index missing.
- **Insert error**: Check Edge Function logs for unique violation — dedupe pre-check vs constraint mismatch.
