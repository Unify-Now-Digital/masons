-- Last-admin guard: at least one admin per organisation after DELETE or role UPDATE.
-- Counts effective admin rows after the operation would apply (see spec 004-org-member-roles).

create or replace function public.organization_members_last_admin_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_admin_count_after integer;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.organization_id;

    select count(*)::integer
      into v_admin_count_after
      from public.organization_members m
      where m.organization_id = v_org_id
        and m.role = 'admin'
        and m.id is distinct from old.id;

    if old.role = 'admin' and v_admin_count_after = 0 then
      raise exception 'Cannot remove the last organisation admin'
        using errcode = 'P0001';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    v_org_id := old.organization_id;

    if old.organization_id is distinct from new.organization_id then
      raise exception 'Cannot change organization_id on organisation membership'
        using errcode = 'P0001';
    end if;

    select
      (
        select count(*)::integer
        from public.organization_members m
        where m.organization_id = v_org_id
          and m.role = 'admin'
          and m.id is distinct from old.id
      )
      + case when new.role = 'admin' then 1 else 0 end
      into v_admin_count_after;

    if v_admin_count_after = 0 then
      raise exception 'Cannot demote the last organisation admin'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.organization_members_last_admin_guard() is
  'Blocks DELETE of sole admin and UPDATE of role that would leave zero admins for the organisation.';

drop trigger if exists organization_members_last_admin_guard_delete on public.organization_members;

create trigger organization_members_last_admin_guard_delete
  before delete on public.organization_members
  for each row
  execute function public.organization_members_last_admin_guard();

drop trigger if exists organization_members_last_admin_guard_update_role on public.organization_members;

create trigger organization_members_last_admin_guard_update_role
  before update of role on public.organization_members
  for each row
  execute function public.organization_members_last_admin_guard();
