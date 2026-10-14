-- =============================================================================
-- Revolut connections table + feature flag — built but DISABLED (Arin, decision 3).
-- Prod has no public.revolut_connections today (repo migrations 20260403* created it,
-- but they were never applied to bfwohzcugtwbhhxdqgme). This creates it idempotently in
-- the shape the edge functions use, and a feature flag that is OFF. Nothing is scheduled:
-- there is no cron job for revolut-sync-transactions / revolut-token-refresh. With the
-- flag off every Revolut edge function returns "disabled" and touches nothing.
-- Turn on only after a direct Revolut Business connection exists:
--   update public.app_feature_flags set enabled = true where key = 'revolut_ledger';
-- =============================================================================

create table if not exists public.app_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.app_feature_flags enable row level security;
revoke all on public.app_feature_flags from anon, authenticated;
grant all on public.app_feature_flags to service_role;
drop policy if exists app_feature_flags_deny_browser_roles on public.app_feature_flags;
create policy app_feature_flags_deny_browser_roles on public.app_feature_flags
  for all to anon, authenticated using (false) with check (false);
insert into public.app_feature_flags (key, enabled, note)
values ('revolut_ledger', false, 'Revolut webhook / sync / OAuth. Off until a direct Revolut Business connection exists.')
on conflict (key) do nothing;

create or replace function public.feature_enabled(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select enabled from public.app_feature_flags where key = p_key), false);
$$;
revoke all on function public.feature_enabled(text) from public, anon, authenticated;
grant execute on function public.feature_enabled(text) to service_role;

create table if not exists public.revolut_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  client_id text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  webhook_id text,
  webhook_signing_secret text,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- If an older copy exists (repo shape, user-scoped), bring it up to this shape.
alter table public.revolut_connections add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
create unique index if not exists revolut_connections_one_active_per_org
  on public.revolut_connections (organization_id) where status = 'active';

alter table public.revolut_connections enable row level security;
do $$ declare r record; begin
  for r in select polname from pg_policy where polrelid = 'public.revolut_connections'::regclass loop
    execute format('drop policy %I on public.revolut_connections', r.polname);
  end loop;
end $$;
-- Tokens and signing secret: service role only. Finance users may see status columns.
revoke all on public.revolut_connections from anon, authenticated;
grant select (id, organization_id, client_id, status, token_expires_at, refresh_token_expires_at, webhook_id, created_at, updated_at)
  on public.revolut_connections to authenticated;
grant all on public.revolut_connections to service_role;
create policy revolut_connections_finance_select on public.revolut_connections for select to authenticated
  using ((select public.user_can_view_org_finance(organization_id)));
drop view if exists public.revolut_connections_safe;
