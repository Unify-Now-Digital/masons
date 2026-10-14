-- Finance permission helper (admin + member; staff excluded) for the RLS hardening.
-- Identical to the definition in 20261014120000_payments_ledger.sql (PR #35), so the two
-- can be applied in either order (create or replace, same signature and body).
create or replace function public.user_can_view_org_finance(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'member')
  );
$$;
revoke all on function public.user_can_view_org_finance(uuid) from public, anon;
grant execute on function public.user_can_view_org_finance(uuid) to authenticated, service_role;
