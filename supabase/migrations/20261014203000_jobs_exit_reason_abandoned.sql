-- NOT APPLIED. Needs Arin's approval.
-- Arin's rule: dead jobs close as 'abandoned', never 'lost'. jobs.exit_reason has no 'abandoned'
-- value today (lost, closed, dormant, on_hold, cancelled), so Today's "Abandoned? · Yes, abandoned"
-- button stays disabled until this is applied and the button is wired to exitJob(reason 'abandoned').
alter table public.jobs drop constraint jobs_exit_reason_check;
alter table public.jobs add constraint jobs_exit_reason_check
  check (exit_reason = any (array['lost','closed','dormant','on_hold','cancelled','abandoned']::text[]));
-- Rollback (only if no row uses 'abandoned'):
-- alter table public.jobs drop constraint jobs_exit_reason_check;
-- alter table public.jobs add constraint jobs_exit_reason_check check (exit_reason = any (array['lost','closed','dormant','on_hold','cancelled']::text[]));
