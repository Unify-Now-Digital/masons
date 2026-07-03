-- Pen-test: token columns (refresh_token, access_token) were readable by any org member
-- via PostgREST once RLS went org-scoped (feature 016). All writes now go through
-- service-role edge functions; the client needs only a narrow SELECT.
-- Applied manually via Dashboard SQL editor on 2026-07-04.
revoke all on gmail_connections from anon;
revoke all on gmail_connections from authenticated;
grant select (id, user_id, organization_id, provider, email_address, status, last_synced_at, created_at, updated_at)
on gmail_connections to authenticated;