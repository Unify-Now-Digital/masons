-- RPC: delete organization (hard delete) for organization admins only.

create or replace function public.delete_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Must be authenticated to delete an organisation'
      using errcode = '28000';
  end if;

  if not (select public.user_is_admin_of_org(p_organization_id)) then
    raise exception 'Must be an organisation admin to delete this organisation'
      using errcode = '42501';
  end if;

  delete from public.organizations o
  where o.id = p_organization_id;

  if not found then
    raise exception 'Organisation not found'
      using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.delete_organization(uuid) is
  'Admin-only hard delete of an organisation; dependent row cleanup is handled by FK cascades.';

revoke all on function public.delete_organization(uuid) from public;
grant execute on function public.delete_organization(uuid) to authenticated;
