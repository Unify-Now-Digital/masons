-- ============================================================================
-- Migration: directional timestamps on inbox_conversations
-- Purpose: enable accurate ball-in-court derivation in the inbox.
--   - `last_inbound_at`: latest sent_at for inbound messages on the thread
--   - `last_outbound_at`: latest sent_at for outbound messages on the thread
--   Existing `last_message_at` continues to mean "any direction" and is
--   maintained by edge functions (gmail-sync, twilio-webhook, send paths).
-- ============================================================================

alter table public.inbox_conversations
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz;

create index if not exists idx_inbox_conversations_last_inbound_at
  on public.inbox_conversations (last_inbound_at desc nulls last);

create index if not exists idx_inbox_conversations_last_outbound_at
  on public.inbox_conversations (last_outbound_at desc nulls last);

-- Backfill from existing inbox_messages.
update public.inbox_conversations c
set
  last_inbound_at = sub.last_in,
  last_outbound_at = sub.last_out
from (
  select
    conversation_id,
    max(case when direction = 'inbound' then sent_at end) as last_in,
    max(case when direction = 'outbound' then sent_at end) as last_out
  from public.inbox_messages
  group by conversation_id
) sub
where c.id = sub.conversation_id
  and (
    c.last_inbound_at is distinct from sub.last_in
    or c.last_outbound_at is distinct from sub.last_out
  );

-- Trigger: maintain directional timestamps after any inbox_messages insert.
-- Uses GREATEST so out-of-order arrivals never roll the watermark backwards.
create or replace function public.update_conversation_directional_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.direction = 'inbound' then
    update public.inbox_conversations
    set last_inbound_at = greatest(coalesce(last_inbound_at, new.sent_at), new.sent_at)
    where id = new.conversation_id;
  elsif new.direction = 'outbound' then
    update public.inbox_conversations
    set last_outbound_at = greatest(coalesce(last_outbound_at, new.sent_at), new.sent_at)
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inbox_messages_directional_timestamps on public.inbox_messages;
create trigger trg_inbox_messages_directional_timestamps
  after insert on public.inbox_messages
  for each row execute function public.update_conversation_directional_timestamps();
