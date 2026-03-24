create table if not exists public.whatsapp_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_whatsapp_mode text not null default 'manual' check (preferred_whatsapp_mode in ('manual', 'managed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_user_preferences enable row level security;

create policy "Users can select own whatsapp_user_preferences"
  on public.whatsapp_user_preferences for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own whatsapp_user_preferences"
  on public.whatsapp_user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update own whatsapp_user_preferences"
  on public.whatsapp_user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
