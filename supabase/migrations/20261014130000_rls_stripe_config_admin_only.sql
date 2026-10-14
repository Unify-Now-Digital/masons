-- RLS hardening 1/6 (URGENT): Stripe config is admin-only, secrets never reach the browser.
-- Audit finding #2. Before: any org member (incl. staff) and the anon role had table SELECT,
-- and the policy allowed every member to read the encrypted secret/webhook columns.
-- After: only org admins can read the row from the browser, and only the non-secret columns.
-- Encrypted keys are readable only by service_role (edge functions) and the existing
-- SECURITY DEFINER get_stripe_* functions (already not executable by anon/authenticated).
-- The web app does not read this table directly (only edge functions, via service role).

drop policy if exists organization_stripe_config_select_member on public.organization_stripe_config;
drop policy if exists organization_stripe_config_select_admin on public.organization_stripe_config;
create policy organization_stripe_config_select_admin
  on public.organization_stripe_config for select to authenticated
  using ((select public.user_is_admin_of_org(organization_id)));

revoke all on table public.organization_stripe_config from anon, authenticated, public;
grant select (organization_id, live_payments_enabled, test_round_trip_passed_at,
              test_publishable_key, live_publishable_key, created_at, updated_at)
  on public.organization_stripe_config to authenticated;
grant all on table public.organization_stripe_config to service_role;

revoke execute on function public.get_stripe_secret_key(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.get_stripe_webhook_secret(uuid, text, text) from public, anon, authenticated;
