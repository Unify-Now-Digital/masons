-- Per-organization Stripe credentials (012-per-org-stripe)
-- Operator applies via Dashboard SQL editor; NOTIFY pgrst after apply.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.organization_stripe_config (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  live_payments_enabled boolean not null default false,
  test_round_trip_passed_at timestamptz,
  test_secret_key_encrypted bytea,
  test_publishable_key text,
  test_webhook_secret_encrypted bytea,
  live_secret_key_encrypted bytea,
  live_publishable_key text,
  live_webhook_secret_encrypted bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_stripe_config is
  'Per-org Stripe test/live credential triplets. Secrets encrypted with pgp_sym_encrypt; Edge decrypt via service-role RPCs only.';

comment on column public.organization_stripe_config.test_round_trip_passed_at is
  'Set by stripe-webhook after successful test-mode authoritative paid reconciliation. Cleared on credential upsert.';

-- Authenticated clients must not read ciphertext columns
revoke select (
  test_secret_key_encrypted,
  test_webhook_secret_encrypted,
  live_secret_key_encrypted,
  live_webhook_secret_encrypted
) on public.organization_stripe_config from authenticated;

revoke select (
  test_secret_key_encrypted,
  test_webhook_secret_encrypted,
  live_secret_key_encrypted,
  live_webhook_secret_encrypted
) on public.organization_stripe_config from anon;

alter table public.organization_stripe_config enable row level security;

create policy organization_stripe_config_select_member
  on public.organization_stripe_config
  for select
  to authenticated
  using (public.user_is_member_of_org(organization_id));

-- No insert/update/delete for authenticated; writes via service-role Edge only

alter table public.invoices
  add column if not exists stripe_credential_mode text
  constraint invoices_stripe_credential_mode_check
  check (stripe_credential_mode is null or stripe_credential_mode in ('test', 'live'));

comment on column public.invoices.stripe_credential_mode is
  'Stripe credential context at checkout session creation (test|live). Used by webhooks for in-flight reconciliation (FR-001a rule c).';

-- Decrypt secret key for Edge (service_role only)
create or replace function public.get_stripe_secret_key(
  p_organization_id uuid,
  p_mode text,
  p_encryption_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  encrypted bytea;
begin
  if p_encryption_key is null or length(trim(p_encryption_key)) = 0 then
    raise exception 'encryption_key is required';
  end if;

  if p_mode not in ('test', 'live') then
    raise exception 'invalid mode';
  end if;

  if p_mode = 'test' then
    select c.test_secret_key_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  else
    select c.live_secret_key_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  end if;

  if encrypted is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(encrypted, p_encryption_key);
end;
$$;

create or replace function public.get_stripe_webhook_secret(
  p_organization_id uuid,
  p_mode text,
  p_encryption_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  encrypted bytea;
begin
  if p_encryption_key is null or length(trim(p_encryption_key)) = 0 then
    raise exception 'encryption_key is required';
  end if;

  if p_mode not in ('test', 'live') then
    raise exception 'invalid mode';
  end if;

  if p_mode = 'test' then
    select c.test_webhook_secret_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  else
    select c.live_webhook_secret_encrypted into encrypted
    from public.organization_stripe_config as c
    where c.organization_id = p_organization_id;
  end if;

  if encrypted is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(encrypted, p_encryption_key);
end;
$$;

comment on function public.get_stripe_secret_key(uuid, text, text) is
  'Decrypt organization_stripe_config secret key. p_encryption_key from STRIPE_CREDENTIALS_ENCRYPTION_KEY env.';

comment on function public.get_stripe_webhook_secret(uuid, text, text) is
  'Decrypt organization_stripe_config webhook signing secret. service_role only.';

revoke all on function public.get_stripe_secret_key(uuid, text, text) from public;
revoke all on function public.get_stripe_secret_key(uuid, text, text) from authenticated;
revoke all on function public.get_stripe_secret_key(uuid, text, text) from anon;

revoke all on function public.get_stripe_webhook_secret(uuid, text, text) from public;
revoke all on function public.get_stripe_webhook_secret(uuid, text, text) from authenticated;
revoke all on function public.get_stripe_webhook_secret(uuid, text, text) from anon;

grant execute on function public.get_stripe_secret_key(uuid, text, text) to service_role;
grant execute on function public.get_stripe_webhook_secret(uuid, text, text) to service_role;

-- Upsert credentials (service_role / Edge); clears test_round_trip_passed_at on every call
create or replace function public.upsert_organization_stripe_credentials(
  p_organization_id uuid,
  p_encryption_key text,
  p_test_secret_key text,
  p_test_publishable_key text,
  p_test_webhook_secret text,
  p_live_secret_key text default null,
  p_live_publishable_key text default null,
  p_live_webhook_secret text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_encryption_key is null or length(trim(p_encryption_key)) = 0 then
    raise exception 'encryption_key is required';
  end if;

  if p_test_secret_key is null or p_test_publishable_key is null or p_test_webhook_secret is null then
    raise exception 'test credential triplet is required';
  end if;

  insert into public.organization_stripe_config (
    organization_id,
    test_secret_key_encrypted,
    test_publishable_key,
    test_webhook_secret_encrypted,
    live_secret_key_encrypted,
    live_publishable_key,
    live_webhook_secret_encrypted,
    test_round_trip_passed_at,
    updated_at
  )
  values (
    p_organization_id,
    extensions.pgp_sym_encrypt(p_test_secret_key, p_encryption_key),
    p_test_publishable_key,
    extensions.pgp_sym_encrypt(p_test_webhook_secret, p_encryption_key),
    case
      when p_live_secret_key is not null and length(trim(p_live_secret_key)) > 0
        then extensions.pgp_sym_encrypt(p_live_secret_key, p_encryption_key)
      else null
    end,
    nullif(trim(p_live_publishable_key), ''),
    case
      when p_live_webhook_secret is not null and length(trim(p_live_webhook_secret)) > 0
        then extensions.pgp_sym_encrypt(p_live_webhook_secret, p_encryption_key)
      else null
    end,
    null,
    now()
  )
  on conflict (organization_id) do update set
    test_secret_key_encrypted = extensions.pgp_sym_encrypt(p_test_secret_key, p_encryption_key),
    test_publishable_key = p_test_publishable_key,
    test_webhook_secret_encrypted = extensions.pgp_sym_encrypt(p_test_webhook_secret, p_encryption_key),
    live_secret_key_encrypted = case
      when p_live_secret_key is not null and length(trim(p_live_secret_key)) > 0
        then extensions.pgp_sym_encrypt(p_live_secret_key, p_encryption_key)
      else public.organization_stripe_config.live_secret_key_encrypted
    end,
    live_publishable_key = coalesce(nullif(trim(p_live_publishable_key), ''), public.organization_stripe_config.live_publishable_key),
    live_webhook_secret_encrypted = case
      when p_live_webhook_secret is not null and length(trim(p_live_webhook_secret)) > 0
        then extensions.pgp_sym_encrypt(p_live_webhook_secret, p_encryption_key)
      else public.organization_stripe_config.live_webhook_secret_encrypted
    end,
    test_round_trip_passed_at = null,
    updated_at = now();
end;
$$;

comment on function public.upsert_organization_stripe_credentials is
  'Platform-operator credential upsert via Edge. Always clears test_round_trip_passed_at. Live fields optional (unchanged when omitted).';

revoke all on function public.upsert_organization_stripe_credentials from public;
revoke all on function public.upsert_organization_stripe_credentials from authenticated;
revoke all on function public.upsert_organization_stripe_credentials from anon;

grant execute on function public.upsert_organization_stripe_credentials(
  uuid, text, text, text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';
