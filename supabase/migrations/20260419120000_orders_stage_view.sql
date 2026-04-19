-- ============================================================
-- Migration: orders_stage_view
-- Purpose: formalise a single "stage" derivation over stone_status,
--          proof_status and permit_status so every consumer uses the
--          same rule. Matches the design's 5-stage pipeline:
--            design | proof | lettering | permit | install_ready
-- Non-destructive: pure view + function.
-- ============================================================

-- Immutable-ish helper so callers can fetch the stage without joining
-- to the view. search_path pinned per project convention.
create or replace function public.order_stage(
  p_stone_status text,
  p_proof_status text,
  p_permit_status text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    -- No proof yet → sitting at design
    when p_proof_status in ('NA', 'Not_Received') then 'design'
    -- Proof work in progress
    when p_proof_status in ('Received', 'In_Progress') then 'proof'
    -- Proof lettered but permit not yet approved → lettering phase
    when p_proof_status = 'Lettered' and coalesce(p_permit_status, '') not in ('approved')
      then case
        when p_permit_status in ('form_sent', 'customer_completed', 'pending') then 'permit'
        else 'lettering'
      end
    -- Everything lined up but stone still to come → permit sweeping up loose ends
    when coalesce(p_stone_status, 'NA') <> 'In Stock' then 'lettering'
    else 'install_ready'
  end;
$$;

comment on function public.order_stage(text, text, text) is
  'Canonical 5-stage derivation: design | proof | lettering | permit | install_ready. Keep in sync with src/shared/lib/orderStage.ts.';

-- View: orders with the derived stage column
create or replace view public.v_orders_with_stage as
select
  o.*,
  public.order_stage(o.stone_status, o.proof_status, o.permit_status) as stage
from public.orders o;

comment on view public.v_orders_with_stage is
  'Orders + derived stage (design/proof/lettering/permit/install_ready). Read-only. Use this for pipeline and stage-bucketed reporting.';
