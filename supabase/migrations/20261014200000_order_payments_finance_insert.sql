-- SUPERSEDED, intentionally empty. Never applied.
-- This file used to add an INSERT policy so the browser could write order_payments directly for
-- Finance · Record payment. That is replaced by public.record_manual_payment
-- (20261015170100_record_manual_payment.sql), which checks the finance role server-side and also
-- updates the order date in the same step. Kept as a no-op so the version number stays reserved.
select 1;
