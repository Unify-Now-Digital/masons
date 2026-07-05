-- Capture manually-applied pen-test fix (see specs/rls-isolation-findings.md):
-- three views were set to security_invoker via Dashboard but never migrated.
-- v_orders_with_stage already covered by 20260419130000. Idempotent.

alter view public.invoices_with_breakdown   set (security_invoker = true);
alter view public.orders_with_balance       set (security_invoker = true);
alter view public.orders_with_options_total set (security_invoker = true);
