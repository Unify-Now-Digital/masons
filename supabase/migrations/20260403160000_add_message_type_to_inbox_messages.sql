-- Add message_type column to inbox_messages for internal notes support
alter table public.inbox_messages
  add column if not exists message_type text not null default 'message';

-- Add check constraint
alter table public.inbox_messages
  add constraint inbox_messages_message_type_check
  check (message_type in ('message', 'internal_note'));

-- Index for filtering notes
create index if not exists idx_inbox_messages_message_type
  on public.inbox_messages (message_type);
