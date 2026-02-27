-- Add user_id (nullable) and gmail_connection_id to inbox tables. Enable RLS so users see only own rows.
-- Safe approach: no truncate. Legacy rows have user_id NULL and are hidden by RLS (SELECT where user_id = auth.uid()).
-- Edge Functions (service role) set user_id on all new inserts.

-- inbox_conversations: add user_id nullable
alter table public.inbox_conversations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_inbox_conversations_user_id on public.inbox_conversations (user_id);

comment on column public.inbox_conversations.user_id is 'Owner; NULL = legacy row (hidden by RLS).';

-- inbox_messages: add user_id nullable, gmail_connection_id nullable
alter table public.inbox_messages
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.inbox_messages
  add column if not exists gmail_connection_id uuid references public.gmail_connections(id) on delete set null;

create index if not exists idx_inbox_messages_user_id on public.inbox_messages (user_id);
create index if not exists idx_inbox_messages_gmail_connection_id on public.inbox_messages (gmail_connection_id);

comment on column public.inbox_messages.user_id is 'Owner; NULL = legacy row (hidden by RLS).';
comment on column public.inbox_messages.gmail_connection_id is 'Gmail connection used for this message when channel = email.';

-- RLS: enable so SELECT is restricted to own rows; legacy rows (user_id IS NULL) are not visible
alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;

-- inbox_conversations: authenticated can select and update only own rows
create policy "Users can select own inbox_conversations"
  on public.inbox_conversations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can update own inbox_conversations"
  on public.inbox_conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Insert/delete from client not used; sync and link updates go through service role or this update policy.

-- inbox_messages: authenticated can only select rows where user_id = auth.uid()
create policy "Users can select own inbox_messages"
  on public.inbox_messages for select to authenticated
  using (user_id = (select auth.uid()));
