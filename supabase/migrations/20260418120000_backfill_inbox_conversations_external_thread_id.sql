-- Backfill inbox_conversations.external_thread_id from Gmail thread ids on existing email messages.
-- Uses DISTINCT ON (conversation_id) with ORDER BY created_at ASC so we take the threadId from the
-- oldest message in each conversation (original thread), not an arbitrary row (addresses R20 vs LIMIT 1).

update public.inbox_conversations c
set external_thread_id = subq.thread_id
from (
  select distinct on (conversation_id)
    conversation_id,
    meta->'gmail'->>'threadId' as thread_id
  from public.inbox_messages
  where channel = 'email'
    and meta->'gmail'->>'threadId' is not null
  order by conversation_id, created_at asc
) subq
where c.id = subq.conversation_id
  and c.channel = 'email'
  and c.external_thread_id is null;
