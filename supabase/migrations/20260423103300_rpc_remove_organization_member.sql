-- RPC: org admin removes a member row scoped by organisation_id + user_id.
-- Last sole admin removal is blocked by organization_members_last_admin_guard trigger.

create or replace function public.remove_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to remove members'
      using errcode = '42501';
  end if;

  delete from public.organization_members m
  where m.organization_id = p_organization_id
    and m.user_id = p_user_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Membership not found for this organisation'
      using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.remove_organization_member(uuid, uuid) is
  'Admin-only delete of organisation_members by org + user; trigger enforces last admin.';

revoke all on function public.remove_organization_member(uuid, uuid) from public;

grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;
