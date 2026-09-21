-- Re-issues statement 3 of 20260402120000_add_permit_tracker_columns_and_tables.sql.
-- That migration was only partially applied live: the live
-- orders_permit_status_check still allows four values and rejects
-- 'not_started', so the Orders table permit cell's 'not_started' write fails
-- with 23514. Do NOT re-run 20260402120000; this file is the correction.
-- Single statement, so there is no window with the constraint absent.
-- Widening only: every value the old constraint allowed stays allowed, so
-- validation of existing rows cannot fail.
--
-- Applied: <date> via Dashboard. Read-back (pg_get_constraintdef): <paste>

alter table public.orders
  drop constraint if exists orders_permit_status_check,
  add constraint orders_permit_status_check
    check (permit_status in ('not_started', 'form_sent', 'customer_completed', 'pending', 'approved'));
