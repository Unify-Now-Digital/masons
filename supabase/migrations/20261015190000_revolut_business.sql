-- NOT APPLIED. Apply by hand in the Dashboard SQL editor, statement by statement. Do not db push.
-- Prod has no revolut_connections table. This is the one migration that creates it.
-- order_payments already exists; only the Revolut columns below are added.
-- Requires public.user_can_view_org_finance(uuid), already used by order_payments policies.
-- Tokens are not selectable by authenticated. Edge functions use the service role.
-- No customer names. No backfill.

do $$
begin
  if to_regprocedure('public.user_can_view_org_finance(uuid)') is null then
    raise exception 'public.user_can_view_org_finance(uuid) must exist before revolut_connections policies';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- revolut_connections: one Revolut Business account per organisation
-- ---------------------------------------------------------------------------
create table if not exists public.revolut_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  client_id text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  webhook_id text,
  webhook_signing_secret text,
  status text not null default 'active',
  environment text not null default 'production',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.revolut_connections is
  'Revolut Business OAuth tokens and webhook signing secret. One row per organisation. Service role only for secrets.';

alter table public.revolut_connections add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.revolut_connections add column if not exists environment text not null default 'production';
alter table public.revolut_connections add column if not exists last_synced_at timestamptz;
alter table public.revolut_connections add column if not exists last_sync_error text;
alter table public.revolut_connections alter column access_token drop not null;
alter table public.revolut_connections alter column refresh_token drop not null;

do $$
begin
  if not exists (select 1 from public.revolut_connections where organization_id is null) then
    alter table public.revolut_connections alter column organization_id set not null;
  end if;
end $$;

-- The April 2026 draft keyed a connection on user_id. Finance is per organisation.
drop index if exists public.idx_revolut_connections_user_id;
create unique index if not exists idx_revolut_connections_organization_id
  on public.revolut_connections (organization_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'revolut_connections_status_check'
  ) then
    alter table public.revolut_connections
      add constraint revolut_connections_status_check
      check (status in ('active', 'expired', 'revoked'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'revolut_connections_environment_check'
  ) then
    alter table public.revolut_connections
      add constraint revolut_connections_environment_check
      check (environment in ('sandbox', 'production'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'revolut_connections_tokens_when_active'
  ) then
    alter table public.revolut_connections
      add constraint revolut_connections_tokens_when_active
      check (
        status <> 'active'
        or (access_token is not null and refresh_token is not null and token_expires_at is not null)
      );
  end if;
end $$;

alter table public.revolut_connections enable row level security;

drop policy if exists "revolut_connections_select_own" on public.revolut_connections;
drop policy if exists "revolut_connections_select_own_safe" on public.revolut_connections;
drop policy if exists "revolut_connections_insert_own" on public.revolut_connections;
drop policy if exists "revolut_connections_update_own" on public.revolut_connections;
drop policy if exists "revolut_connections_delete_own" on public.revolut_connections;
drop policy if exists revolut_connections_select_finance on public.revolut_connections;

-- Reads only. Tokens are written by the service role. Disconnect goes through the edge function.
create policy revolut_connections_select_finance
  on public.revolut_connections
  for select
  to authenticated
  using ((select public.user_can_view_org_finance(organization_id)));

revoke all on table public.revolut_connections from anon, authenticated;
grant select (
  id,
  organization_id,
  user_id,
  client_id,
  status,
  environment,
  token_expires_at,
  refresh_token_expires_at,
  webhook_id,
  last_synced_at,
  last_sync_error,
  created_at,
  updated_at
) on public.revolut_connections to authenticated;
grant all on table public.revolut_connections to service_role;

create or replace view public.revolut_connections_safe
with (security_invoker = on) as
select
  id,
  organization_id,
  user_id,
  client_id,
  status,
  environment,
  token_expires_at,
  refresh_token_expires_at,
  webhook_id,
  last_synced_at,
  last_sync_error,
  created_at,
  updated_at
from public.revolut_connections;

alter view public.revolut_connections_safe set (security_invoker = on);

comment on view public.revolut_connections_safe is
  'Revolut connection status for Settings. Omits access_token, refresh_token and webhook_signing_secret.';

grant select on public.revolut_connections_safe to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- OAuth state. Single use, ten minutes. No policies: service role only.
-- ---------------------------------------------------------------------------
create table if not exists public.revolut_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  user_id uuid not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.revolut_oauth_states is
  'Single-use Revolut OAuth state bound to a user and organisation.';

create index if not exists idx_revolut_oauth_states_expires
  on public.revolut_oauth_states (expires_at);

alter table public.revolut_oauth_states enable row level security;
revoke all on table public.revolut_oauth_states from anon, authenticated;
grant all on table public.revolut_oauth_states to service_role;

-- ---------------------------------------------------------------------------
-- order_payments: fields the Revolut feed needs. Existing rows stay null.
-- ---------------------------------------------------------------------------
alter table public.order_payments add column if not exists counterparty_name text;
alter table public.order_payments add column if not exists provider_state text;
alter table public.order_payments add column if not exists account_id text;
alter table public.order_payments add column if not exists leg_id text;
alter table public.order_payments add column if not exists revolut_type text;

comment on column public.order_payments.counterparty_name is
  'Payer name from Revolut counterparty.name, or the leg description.';
comment on column public.order_payments.provider_state is
  'Revolut state: pending, completed, declined, failed, reverted. Cash-in counts completed only.';
comment on column public.order_payments.external_id is
  'Revolut transaction id, Stripe payment intent id, or manual:<uuid>. Unique.';

create index if not exists idx_order_payments_revolut_unmatched
  on public.order_payments (organization_id, received_at desc)
  where source = 'revolut' and status = 'unmatched';

-- Finance members can read every payment in their org, including rows the sync wrote
-- with another user's id. Accept and Ignore update an unmatched Revolut row only.
drop policy if exists order_payments_finance_select on public.order_payments;
create policy order_payments_finance_select
  on public.order_payments
  for select
  to authenticated
  using (
    organization_id is not null
    and (select public.user_can_view_org_finance(organization_id))
  );

drop policy if exists order_payments_finance_accept_revolut on public.order_payments;
create policy order_payments_finance_accept_revolut
  on public.order_payments
  for update
  to authenticated
  using (
    organization_id is not null
    and source = 'revolut'
    and status = 'unmatched'
    and external_id is not null
    and (select public.user_can_view_org_finance(organization_id))
  )
  with check (
    organization_id is not null
    and source = 'revolut'
    and status = 'matched'
    and order_id is not null
    and matched_by is not null
    and (select public.user_can_view_org_finance(organization_id))
  );

drop policy if exists order_payments_finance_ignore_revolut on public.order_payments;
create policy order_payments_finance_ignore_revolut
  on public.order_payments
  for update
  to authenticated
  using (
    organization_id is not null
    and source = 'revolut'
    and status = 'unmatched'
    and external_id is not null
    and (select public.user_can_view_org_finance(organization_id))
  )
  with check (
    organization_id is not null
    and source = 'revolut'
    and status = 'dismissed'
    and order_id is null
    and matched_by is not null
    and (select public.user_can_view_org_finance(organization_id))
  );
