-- RLS hardening 5/6: cemeteries are private per organisation. Audit finding #6.
-- Before: any signed-in user of any org could read every cemetery (cemeteries_public_read
-- using (true)) plus all cemetery_contacts and cemetery_pricing. Prod has 2 orgs' cemeteries.
-- After: members see their own org's cemeteries, contacts and pricing only.

drop policy if exists cemeteries_public_read on public.cemeteries;  -- authenticated, using (true)

drop policy if exists "Authenticated users can read cemetery_contacts" on public.cemetery_contacts;
drop policy if exists cemetery_contacts_org_select on public.cemetery_contacts;
create policy cemetery_contacts_org_select on public.cemetery_contacts for select to authenticated
  using (exists (select 1 from public.cemeteries c where c.id = cemetery_contacts.cemetery_id
                 and (select public.user_is_member_of_org(c.organization_id))));

drop policy if exists "Authenticated users can read cemetery_pricing" on public.cemetery_pricing;
drop policy if exists cemetery_pricing_org_select on public.cemetery_pricing;
create policy cemetery_pricing_org_select on public.cemetery_pricing for select to authenticated
  using (exists (select 1 from public.cemeteries c where c.id = cemetery_pricing.cemetery_id
                 and (select public.user_is_member_of_org(c.organization_id))));

revoke all on public.cemetery_contacts, public.cemetery_pricing from anon;
revoke insert, update, delete, truncate on public.cemetery_contacts, public.cemetery_pricing from authenticated;
