-- RPC: create a new organisation and add the caller as its first admin (single transaction).

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_name text;
  v_org_id uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Must be authenticated to create an organisation'
      using errcode = '28000';
  end if;

  v_name := trim(both from p_name);
  if v_name = '' then
    raise exception 'Organisation name is required'
      using errcode = 'P0001';
  end if;
  if length(v_name) > 200 then
    raise exception 'Organisation name is too long'
      using errcode = 'P0001';
  end if;

  insert into public.organizations (name)
  values (v_name)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_uid, 'admin');

  return v_org_id;
end;
$$;

comment on function public.create_organization(text) is
  'Creates organisations row and caller admin membership; no user_is_admin_of_org gate.';

revoke all on function public.create_organization(text) from public;

grant execute on function public.create_organization(text) to authenticated;
