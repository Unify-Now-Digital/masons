alter table public.inbox_messages
  add column if not exists whatsapp_connection_mode text check (whatsapp_connection_mode in ('manual', 'managed')),
  add column if not exists whatsapp_managed_connection_id uuid references public.whatsapp_managed_connections(id) on delete set null,
  add column if not exists whatsapp_sender_sid text;

create index if not exists idx_inbox_messages_whatsapp_managed_connection_id
  on public.inbox_messages (whatsapp_managed_connection_id);

alter table public.inbox_conversations
  add column if not exists whatsapp_connection_mode text check (whatsapp_connection_mode in ('manual', 'managed')),
  add column if not exists whatsapp_managed_connection_id uuid references public.whatsapp_managed_connections(id) on delete set null;

create index if not exists idx_inbox_conversations_whatsapp_managed_connection_id
  on public.inbox_conversations (whatsapp_managed_connection_id);
