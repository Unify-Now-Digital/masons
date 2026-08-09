-- Fix: log_activity_generic ran as SECURITY INVOKER, but its inner call
-- activity_log_write grants EXECUTE only to postgres/service_role.
-- Result: every authenticated (browser-session) INSERT/UPDATE/DELETE on the
-- six triggered tables (orders, invoices, invoice_payments,
-- inbox_conversations, inbox_messages, people) failed with 42501 and rolled
-- back. Service-role paths were unaffected. Trigger system appeared on prod
-- ~2026-08-08 outside migration discipline; jobs trigger planned in the
-- function body but never attached.
--
-- Applied via Dashboard 2026-08-10. Read-back:
--   proname=log_activity_generic, prosecdef=true, proconfig={search_path=public}
-- Body derives actor from auth.uid() (mason.user_id fallback); never trusts
-- caller input for identity — safe as DEFINER.

alter function public.log_activity_generic() security definer set search_path = public;