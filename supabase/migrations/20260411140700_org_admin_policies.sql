-- Admins may manage membership rows for their organization only (US2)

drop policy if exists "organization_members_select_own" on public.organization_members;

create policy "organization_members_select_org"
  on public.organization_members
  for select
  to authenticated
  using (public.user_is_member_of_org(organization_id));

create or replace function public.user_is_admin_of_org(p_org_id uuid)
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
      and m.role = 'admin'
  );
$$;

create policy "organization_members_insert_admin"
  on public.organization_members
  for insert
  to authenticated
  with check (public.user_is_admin_of_org(organization_id));

create policy "organization_members_update_admin"
  on public.organization_members
  for update
  to authenticated
  using (public.user_is_admin_of_org(organization_id))
  with check (public.user_is_admin_of_org(organization_id));

create policy "organization_members_delete_admin"
  on public.organization_members
  for delete
  to authenticated
  using (public.user_is_admin_of_org(organization_id));
