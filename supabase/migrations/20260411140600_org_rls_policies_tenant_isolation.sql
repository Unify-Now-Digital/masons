-- Tenant isolation RLS using organization_members + organization_id on rows

create or replace function public.user_is_member_of_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = (select auth.uid())
  );
$$;

comment on function public.user_is_member_of_org(uuid) is
  'True when the current user has a membership row for the given organization. SECURITY DEFINER avoids RLS recursion on organization_members.';

-- Require organization_id on tenant rows (skip tables that still have nulls)
do $$
declare
  r record;
  v_null_count bigint;
begin
  for r in
    select c.table_name::text as t
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and c.table_name not in ('organization_members')
  loop
    execute format(
      'select count(*) from public.%I where organization_id is null',
      r.t
    ) into v_null_count;

    if v_null_count = 0 then
      execute format(
        'alter table public.%I alter column organization_id set not null',
        r.t
      );
    else
      raise notice 'Skipping not-null on % — % null rows remain', r.t, v_null_count;
    end if;
  end loop;
end $$;

-- Drop existing row policies on tenant tables
do $$
declare
  pol record;
begin
  for pol in
    select p.polname::text as polname, c.relname::text as relname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in ('organizations', 'organization_members')
      and exists (
        select 1
        from information_schema.columns col
        where col.table_schema = 'public'
          and col.table_name = c.relname
          and col.column_name = 'organization_id'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.polname, pol.relname);
  end loop;
end $$;

-- Standard org-scoped CRUD for authenticated users
do $$
declare
  r record;
begin
  for r in
    select table_name::text as t
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'organization_id'
      and table_name not in ('organization_members')
    group by table_name
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.user_is_member_of_org(organization_id))',
      r.t || '_org_select', r.t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.user_is_member_of_org(organization_id))',
      r.t || '_org_insert', r.t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.user_is_member_of_org(organization_id)) with check (public.user_is_member_of_org(organization_id))',
      r.t || '_org_update', r.t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.user_is_member_of_org(organization_id))',
      r.t || '_org_delete', r.t
    );
  end loop;
end $$;