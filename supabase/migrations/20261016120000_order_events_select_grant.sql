-- NOT APPLIED. Do not run this against production from the app deploy.
-- Apply by hand in the Dashboard SQL editor after review.
--
-- Today logs 403 on GET /rest/v1/order_events?order_id=eq.… for the owner.
-- The table has RLS and policy order_events_org_select (org members may select).
-- authenticated has no GRANT SELECT, so PostgREST rejects the request before RLS.
-- No money column is involved. Columns are id, order_id, event_type, summary, detail, created_at.

grant select on table public.order_events to authenticated;
