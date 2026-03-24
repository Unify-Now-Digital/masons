create table if not exists public.whatsapp_connection_events (
  id uuid primary key default gen_random_uuid(),
  managed_connection_id uuid not null references public.whatsapp_managed_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_type text not null check (actor_type in ('system', 'user', 'provider_webhook', 'support')),
  event_type text not null,
  previous_status text,
  new_status text,
  payload jsonb not null default '{}'::jsonb,
  request_id text,
  correlation_id text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_connection_events_managed_connection_id
  on public.whatsapp_connection_events (managed_connection_id, occurred_at desc);

create index if not exists idx_whatsapp_connection_events_user_id
  on public.whatsapp_connection_events (user_id, occurred_at desc);

alter table public.whatsapp_connection_events enable row level security;

create policy "Users can select own whatsapp_connection_events"
  on public.whatsapp_connection_events for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own whatsapp_connection_events"
  on public.whatsapp_connection_events for insert to authenticated
  with check (user_id = (select auth.uid()));
