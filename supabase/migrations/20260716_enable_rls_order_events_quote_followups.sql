-- Enable RLS on unused scaffolding tables exposed to anon key (deny-by-default).
-- Both tables: 0 rows, 0 code references as of 2026-07-16.
-- Proper org-scoped policies to be added when order_events is wired as the
-- progress-event log (inbox rework Phase 1). Applied via Dashboard 2026-07-16.
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_followups ENABLE ROW LEVEL SECURITY;
