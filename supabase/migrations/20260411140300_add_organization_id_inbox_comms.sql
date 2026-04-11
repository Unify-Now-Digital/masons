-- Inbox, Gmail, WhatsApp, AI — organization_id

alter table public.inbox_conversations
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.inbox_messages
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.gmail_connections
  add column if not exists organization_id uuid references public.organizations (id);

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'whatsapp_connections') then
    alter table public.whatsapp_connections add column if not exists organization_id uuid references public.organizations (id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'whatsapp_managed_connections') then
    alter table public.whatsapp_managed_connections add column if not exists organization_id uuid references public.organizations (id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'whatsapp_connection_events') then
    alter table public.whatsapp_connection_events add column if not exists organization_id uuid references public.organizations (id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'whatsapp_user_preferences') then
    alter table public.whatsapp_user_preferences add column if not exists organization_id uuid references public.organizations (id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'inbox_ai_thread_summaries') then
    alter table public.inbox_ai_thread_summaries add column if not exists organization_id uuid references public.organizations (id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'inbox_ai_suggestions') then
    alter table public.inbox_ai_suggestions add column if not exists organization_id uuid references public.organizations (id);
  end if;
end $$;

create index if not exists idx_inbox_conversations_organization_id on public.inbox_conversations (organization_id);
create index if not exists idx_inbox_messages_organization_id on public.inbox_messages (organization_id);
create index if not exists idx_gmail_connections_organization_id on public.gmail_connections (organization_id);