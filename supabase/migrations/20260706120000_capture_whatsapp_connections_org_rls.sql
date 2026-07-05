-- Capture manually-applied RLS fix: whatsapp_connections re-scoped from
-- using(true) to org membership (pen-test remediation, applied via Dashboard).
-- Idempotent: brings any environment built from migrations up to prod state.

drop policy if exists "Users can select all whatsapp_connections" on public.whatsapp_connections;
drop policy if exists "Users can select own whatsapp_connections" on public.whatsapp_connections;
drop policy if exists "Users can insert own whatsapp_connections" on public.whatsapp_connections;
drop policy if exists "Users can update own whatsapp_connections" on public.whatsapp_connections;
drop policy if exists "Users can delete own whatsapp_connections" on public.whatsapp_connections;

drop policy if exists whatsapp_connections_org_select on public.whatsapp_connections;
drop policy if exists whatsapp_connections_org_insert on public.whatsapp_connections;
drop policy if exists whatsapp_connections_org_update on public.whatsapp_connections;
drop policy if exists whatsapp_connections_org_delete on public.whatsapp_connections;

create policy whatsapp_connections_org_select on public.whatsapp_connections
  for select using (user_is_member_of_org(organization_id));

create policy whatsapp_connections_org_insert on public.whatsapp_connections
  for insert with check (user_is_admin_of_org(organization_id));

create policy whatsapp_connections_org_update on public.whatsapp_connections
  for update using (user_is_admin_of_org(organization_id))
  with check (user_is_admin_of_org(organization_id));

create policy whatsapp_connections_org_delete on public.whatsapp_connections
  for delete using (user_is_admin_of_org(organization_id));