# Data model: Inbox live updates

## Tables involved

| Table                   | Purpose for live updates |
|-------------------------|---------------------------|
| `public.inbox_messages` | Realtime subscription (INSERT, optionally UPDATE). New rows trigger UI invalidation. |
| `public.inbox_conversations` | Refetched when conversations list is invalidated; updated by webhooks/Edge Function when messages are inserted. No separate subscription required if we invalidate list on `inbox_messages` INSERT. |

## Realtime publication (SQL)

- **Table:** `inbox_messages` must be in the Supabase Realtime publication so that `postgres_changes` events are emitted.
- **How:** In Supabase Dashboard → Database → Replication, add `inbox_messages` to the publication used by Realtime (e.g. `supabase_realtime`). If managing via SQL:

```sql
-- Add inbox_messages to realtime publication (name may vary; check existing publication)
alter publication supabase_realtime add table public.inbox_messages;
```

If the table is already in the publication, no migration is needed; otherwise add a migration that runs the above (or document the manual step).

## Deduplication (unique constraint)

- **Constraint:** `inbox_messages.external_message_id` must be unique (for Twilio/webhook idempotency).
- **Current state:** Migration `20260124120000_add_external_message_id_and_external_thread_id.sql` already adds:
  - `create unique index if not exists idx_inbox_messages_external_message_id on public.inbox_messages (external_message_id) where external_message_id is not null;`
- **Action:** Verify this index exists in the target DB; if missing, add a migration that creates it. No schema change to application columns required.

## Filter column for Realtime (tenant scoping)

- **Option 1:** If `inbox_messages` has `company_id`: use it in the Realtime subscription filter so the client only receives events for the current company. Confirm column name in DB (e.g. `company_id` vs `org_id`).
- **Option 2:** If there is no tenant column on `inbox_messages`, rely on RLS; Realtime respects RLS, so the client only gets events for rows it is allowed to read. Ensure RLS policies on `inbox_messages` are correct for multi-tenant use.

## Columns used in handler

From the Realtime payload (INSERT on `inbox_messages`), the handler needs at least:

- `conversation_id` — to call `invalidateQueries({ queryKey: inboxKeys.messages.byConversation(conversation_id) })`.
- Optionally `company_id` or `org_id` — only if filtering by tenant on the client (e.g. to ignore events from other tenants if not already filtered server-side).
