-- Multi-org GHL credentials: per-org encrypted PIT on ghl_connections (010-ghl-multi-org)
-- Seed SQL is user-run in Dashboard — see specs/010-ghl-multi-org/quickstart.md

create extension if not exists pgcrypto with schema extensions;

alter table public.ghl_connections
  add column if not exists ghl_api_key bytea;

comment on column public.ghl_connections.ghl_api_key is
  'Encrypted GHL Private Integration Token (pgp_sym_encrypt). Never exposed to authenticated clients.';

-- column-level: members must not read ciphertext
revoke select (ghl_api_key) on public.ghl_connections from authenticated;
revoke select (ghl_api_key) on public.ghl_connections from anon;

create or replace function public.get_ghl_api_key(
  p_connection_id uuid,
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

  select c.ghl_api_key into encrypted
  from public.ghl_connections as c
  where c.id = p_connection_id;

  if encrypted is null then
    return null;
  end if;

  return extensions.pgp_sym_decrypt(encrypted, p_encryption_key);
end;
$$;

comment on function public.get_ghl_api_key(uuid, text) is
  'Decrypt ghl_connections.ghl_api_key for Edge Functions. encryption_key from GHL_API_KEY_ENCRYPTION_KEY env.';

revoke all on function public.get_ghl_api_key(uuid, text) from public;
revoke all on function public.get_ghl_api_key(uuid, text) from authenticated;
revoke all on function public.get_ghl_api_key(uuid, text) from anon;

grant execute on function public.get_ghl_api_key(uuid, text) to service_role;
