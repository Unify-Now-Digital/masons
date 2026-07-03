# WhatsApp org-connection pattern

Reference template for migrating email (Gmail) connections to the org-scoped model. From a read-only investigation, 2026-07-03.

## At a glance

- Connection table: public.whatsapp_connections (manual/BYO Twilio) + whatsapp_managed_connections (platform-managed)
- Tenant column: organization_id (added 20260411140300, backfilled to Churchill …140500, set NOT NULL …140600)
- Owner column: user_id (FK auth.users, on delete cascade)
- Uniqueness: partial unique index on user_id where status='connected' — one connected row per user, NOT per-org, NOT per phone number
- Secret storage: twilio_api_key_secret_encrypted — encrypted at rest, decrypted only in edge functions
- RLS scope (final): per-organization membership via user_is_member_of_org(organization_id), all 4 verbs
- Admin gate: NOT in RLS — enforced in the whatsapp-connect edge function (organization_members.role='admin') + UI hide
- Conversations/messages: shared inbox_conversations / inbox_messages, channel='whatsapp', org-scoped RLS

## 1. Connection table & constraints

whatsapp_connections (supabase/migrations/20260306120000_create_whatsapp_connections.sql) carries user_id, provider, twilio_account_sid, twilio_api_key_sid, twilio_api_key_secret_encrypted, whatsapp_from, status check in ('connected','disconnected','error'). organization_id uuid references public.organizations(id) was added later.

Uniqueness (the key design choice):

```sql
-- at most ONE connected row per USER (not per org, not per number)
create unique index idx_whatsapp_connections_one_connected_per_user
  on public.whatsapp_connections (user_id) where status = 'connected';
```

The managed table adds global provider-identity uniqueness as a separate partial index ((platform_twilio_account_sid, twilio_sender) where twilio_sender is not null).

## 2. RLS — org-member scoped, applied uniformly

Tables passed through two regimes. Create-migrations wrote per-user policies (user_id = auth.uid()); the tenant-isolation migration 20260411140600_org_rls_policies_tenant_isolation.sql runs a DO block that drops every policy on any public table having an organization_id column and recreates the standard 4-verb set:

```sql
create policy <t>_org_select on public.<t> for select to authenticated
  using (public.user_is_member_of_org(organization_id));
create policy <t>_org_insert ... with check (public.user_is_member_of_org(organization_id));
create policy <t>_org_update ... using (…) with check (…);
create policy <t>_org_delete ... using (public.user_is_member_of_org(organization_id));
```

Helper (security definer, avoids RLS recursion on organization_members):

```sql
create or replace function public.user_is_member_of_org(p_org_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
    where m.organization_id = p_org_id and m.user_id = (select auth.uid()));
$$;
```

Important: no connection/inbox policy references admin role. An admin-only variant exists (user_is_admin_of_org, …140700) but is used only to gate organization_members management — not connections.

## 3. Admin gate lives in the edge function, not RLS

"Who can connect" is enforced in supabase/functions/whatsapp-connect/index.ts: after JWT validation, a service-role membership+role check returns 403 otherwise:

```ts
.from('organization_members').select('organization_id, role')
.eq('user_id', user.id).eq('role', 'admin').limit(1).single();
if (membershipError || !membership) return 403 'Admin access required to connect WhatsApp';
```

On insert it stamps organization_id: membership.organization_id + user_id, encrypts the secret, and first disconnects the user's existing connected row. The frontend (WhatsAppConnectionStatus.tsx, gated on isOrgAdmin from OrganizationContext) only hides the Connect UI — the real gate is server-side.

## 4. Conversations & messages

WhatsApp threads live in inbox_conversations / inbox_messages with channel='whatsapp' plus FK columns (whatsapp_connection_id, whatsapp_connection_mode, whatsapp_managed_connection_id, whatsapp_sender_sid). Both tables received organization_id and are governed by the same user_is_member_of_org(organization_id) org policies (they started per-user, were relaxed to using(true), then finalized org-scoped). Messages are per-organization, not per-user, at the DB layer.

## 5. Send-path caveat — the pattern was only half-applied (FIXED 2026-07-03)

The DB model is org-scoped, but the send path did not resolve the org's connection per-org. inbox-twilio-send → _shared/whatsappRoutingResolver.ts (manual branch) selected:

```ts
.from('whatsapp_connections')
.select('… twilio_api_key_secret_encrypted, whatsapp_from')
.eq('status', 'connected')            // ← no organization_id, no user_id
.order('created_at', { ascending: false }).limit(1).maybeSingle();
```

Run with the service-role client (RLS bypassed), this picked the newest connected row platform-wide — a cross-tenant send bug. FIXED: resolver now requires organizationId and filters both manual and managed lookups by it (commits 3e4ab5f, 6c59aa1). Lesson for the email migration: send/sync functions must filter connection lookups by organization_id explicitly — RLS does not protect service-role code.

## Template to replicate for Gmail

gmail_connections already has organization_id (…140300) and is already caught by the …140600 org-policy loop — at the DB layer it is already org-member-scoped. To fully mirror (and tighten) the pattern:

1. Table: user_id (connector/owner) + organization_id (tenant) + *_encrypted secret (decrypted only in edge functions).
2. Uniqueness FOR EMAIL (tighter than WhatsApp): partial unique index on organization_id where status='active' — ONE active connection per ORG. Schema must keep multiple-per-org as a future-additive change (drop index + add default flag), per client decision.
3. RLS: 4-verb policies keyed on user_is_member_of_org(organization_id).
4. Admin gate: enforce in the connect edge function via organization_members role='admin' check (as whatsapp-connect does), stamping organization_id from that membership.
5. Send/sync functions: resolve the connection with an explicit .eq('organization_id', orgId) filter — never rely on RLS (service-role bypasses it). Keep the existing caller org-membership guard (isUserInOrganization).
