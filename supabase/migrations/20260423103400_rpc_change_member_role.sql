-- RPC: org admin sets a member role to admin or member.
-- Last sole admin demotion is blocked by organization_members_last_admin_guard_update_role trigger.

create or replace function public.change_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_updated integer;
begin
  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to change member roles'
      using errcode = '42501';
  end if;

  v_role := lower(trim(both from p_role));
  if v_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member'
      using errcode = 'P0001';
  end if;

  update public.organization_members m
  set role = v_role
  where m.organization_id = p_organization_id
    and m.user_id = p_user_id;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'Membership not found for this organisation'
      using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.change_member_role(uuid, uuid, text) is
  'Admin-only role update by org + user; trigger enforces at least one admin.';

revoke all on function public.change_member_role(uuid, uuid, text) from public;

grant execute on function public.change_member_role(uuid, uuid, text) to authenticated;
