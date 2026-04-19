-- ============================================================
-- Migration: enforce_rls_on_orders_stage_view
-- Purpose: the view `v_orders_with_stage` created by migration
--          20260419120000 was created with the Postgres default
--          of `security_invoker = false`, which means SELECTs
--          against the view run with the view owner's permissions
--          and BYPASS row-level security on the underlying
--          `orders` table. That would leak every organisation's
--          orders to any authenticated user.
--
--          Fix: flip `security_invoker` to true so the view
--          executes with the calling user's permissions, forcing
--          RLS on `orders` to apply.
--
--          No data change. Safe to re-run.
-- ============================================================

alter view public.v_orders_with_stage set (security_invoker = true);

comment on view public.v_orders_with_stage is
  'Orders + derived stage (design/proof/lettering/permit/install_ready). Read-only. Uses security_invoker=true so the calling user''s RLS on `orders` applies.';
