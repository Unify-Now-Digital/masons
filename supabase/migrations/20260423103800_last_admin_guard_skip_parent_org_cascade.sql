-- Fix: allow organization deletion cascade to remove organization_members rows.
-- The last-admin guard should not block DELETE when parent organization is already being deleted.

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

    -- Skip if parent org is being deleted (cascade)
    if not exists (
      select 1
      from public.organizations
      where id = old.organization_id
    ) then
      return old;
    end if;

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
