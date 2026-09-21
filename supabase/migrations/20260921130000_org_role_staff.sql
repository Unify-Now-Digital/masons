-- Third organization role: 'staff'.
-- 1. Widens the role CHECK on public.organization_members to admin | member | staff in ONE
--    statement, so the table is never without a CHECK. The constraint name
--    organization_members_role_check comes from the live catalog (pg_constraint); the creating
--    migration declared the check inline and unnamed.
-- 2. Re-issues public.change_member_role with 'staff' in its validation list and error text.
--    Same signature, same security mode, search_path = '' kept inside the definition
--    (create or replace resets a function's SET config). Body otherwise identical to
--    20260423103400_rpc_change_member_role.sql.
-- 3. Re-asserts the live ACL.
-- add_organization_member_by_email is unchanged: members are added as 'member', then switched.
-- Apply by hand in the Dashboard SQL editor, one statement at a time. No transaction wrapper.

alter table public.organization_members
  drop constraint organization_members_role_check,
  add constraint organization_members_role_check
    check (role in ('admin', 'member', 'staff'));

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
  if v_role not in ('admin', 'member', 'staff') then
    raise exception 'Role must be admin, member or staff'
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

revoke execute on function public.change_member_role(uuid, uuid, text) from public, anon;

grant execute on function public.change_member_role(uuid, uuid, text) to authenticated, service_role;

-- Read-back (applied by hand in the Dashboard 2026-09-21; ids and counts only):
--   pg_get_constraintdef(organization_members_role_check) =
--     CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'staff'::text])))
--   change_member_role proconfig / prosecdef / proacl =
--     {search_path=""} / true / {postgres=X, authenticated=X, service_role=X}
--   position(e'\r' in pg_get_functiondef(change_member_role)) =
--     193 after paste, 0 after the server-side strip; final body md5 57e04616e3add1f57a12b17c08480e22
