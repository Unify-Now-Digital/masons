-- RLS hardening 4/6: explicit policies for the 18 tables that had RLS on and no policies.
-- Behaviour for server code is unchanged (service_role bypasses RLS). Two groups:
--
-- A. Server-only (tokens, sessions, rate limits, outboxes, global contact data, and
--    `memorials`, whose 221 prod rows have no order_id/organization_id so cannot be scoped):
--    explicit deny policy for browser roles + table grants revoked from anon/authenticated.
-- B. Org-scoped audit/history rows staff legitimately view: SELECT for org members only.
--    No browser writes (written by edge functions / SECURITY DEFINER RPCs).

do $$
declare t text;
begin
  foreach t in array array[
    'contact_handles','customer_portal_tokens','ghl_send_idempotency','inbox_channel_accounts',
    'memorials','oauth_state','order_tracking_tokens','partner_magic_link_tokens','permit_contacts',
    'portal_rate_limits','portal_security_events','quote_access_tokens','quote_followups'] loop
    execute format('drop policy if exists %I on public.%I', t||'_deny_browser_roles', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
                   t||'_deny_browser_roles', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;

  foreach t in array array['burial_ground_contact_candidates','cemetery_match_reviews',
                           'permit_cemetery_email_deliveries','permit_documents'] loop
    execute format('drop policy if exists %I on public.%I', t||'_org_select', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.user_is_member_of_org(organization_id)))',
                   t||'_org_select', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- order_events has no organization_id; scope through the parent order.
drop policy if exists order_events_org_select on public.order_events;
create policy order_events_org_select on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_events.order_id
                   and (select public.user_is_member_of_org(o.organization_id))));
revoke all on public.order_events from anon;
revoke insert, update, delete, truncate on public.order_events from authenticated;
