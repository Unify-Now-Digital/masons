-- RPC: org admin adds an existing auth user by email as a member (role member).
-- Duplicate (organisation_id, user_id): ON CONFLICT DO NOTHING — idempotent (see research.md §4).

create or replace function public.add_organization_member_by_email(
  p_organization_id uuid,
  p_email text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_target_id uuid;
  v_lookup text;
begin
  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to add members'
      using errcode = '42501';
  end if;

  v_lookup := trim(both from p_email);
  if v_lookup = '' then
    raise exception 'Email is required'
      using errcode = 'P0001';
  end if;

  select u.id
    into v_target_id
    from auth.users u
    where u.email = v_lookup
    order by u.created_at asc
    limit 1;

  if v_target_id is null then
    raise exception 'No user found for that email address'
      using errcode = 'P0001';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (p_organization_id, v_target_id, 'member')
  on conflict (organization_id, user_id) do nothing;
end;
$$;

comment on function public.add_organization_member_by_email(uuid, text) is
  'Admin-only; resolves auth user by trimmed email (= auth.users.email); inserts member or no-op on duplicate.';

revoke all on function public.add_organization_member_by_email(uuid, text) from public;

grant execute on function public.add_organization_member_by_email(uuid, text) to authenticated;
