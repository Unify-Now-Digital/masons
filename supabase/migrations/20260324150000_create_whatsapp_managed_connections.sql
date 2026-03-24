create table if not exists public.whatsapp_managed_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'twilio',
  platform_twilio_account_sid text,
  twilio_sender text,
  display_number text,
  label text,
  state text not null check (
    state in (
      'draft',
      'collecting_business_info',
      'provisioning',
      'pending_meta_action',
      'pending_provider_review',
      'action_required',
      'connected',
      'degraded',
      'failed',
      'disconnected'
    )
  ),
  last_error text,
  meta jsonb not null default '{}'::jsonb,
  last_state_change_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.whatsapp_managed_connections is 'Managed WhatsApp onboarding and provider readiness lifecycle.';

create unique index if not exists idx_whatsapp_managed_one_active_per_user
  on public.whatsapp_managed_connections (user_id)
  where state not in ('failed', 'disconnected');

create index if not exists idx_whatsapp_managed_user_status
  on public.whatsapp_managed_connections (user_id, state, updated_at desc);

create index if not exists idx_whatsapp_managed_sender_lookup
  on public.whatsapp_managed_connections (platform_twilio_account_sid, twilio_sender)
  where state = 'connected';

create index if not exists idx_whatsapp_managed_from_lookup
  on public.whatsapp_managed_connections (platform_twilio_account_sid, display_number)
  where state = 'connected';

alter table public.whatsapp_managed_connections enable row level security;

drop policy if exists "Users can select own whatsapp_managed_connections" on public.whatsapp_managed_connections;
create policy "Users can select own whatsapp_managed_connections"
  on public.whatsapp_managed_connections for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own whatsapp_managed_connections" on public.whatsapp_managed_connections;
create policy "Users can insert own whatsapp_managed_connections"
  on public.whatsapp_managed_connections for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own whatsapp_managed_connections" on public.whatsapp_managed_connections;
create policy "Users can update own whatsapp_managed_connections"
  on public.whatsapp_managed_connections for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own whatsapp_managed_connections" on public.whatsapp_managed_connections;
create policy "Users can delete own whatsapp_managed_connections"
  on public.whatsapp_managed_connections for delete to authenticated
  using (user_id = (select auth.uid()));
