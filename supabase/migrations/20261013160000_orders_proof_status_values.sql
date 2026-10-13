-- migration: orders.proof_status — Arin's proof status list
-- plan: ~/.claude/plans/pasted-content-id-4873-start-of-modular-widget.md (M1); frontend C1
-- purpose:
--   - allowed values become NA, Not_Received, Received, Sent, Revision, Approved,
--     Lettered (Arin's order). Sent / Revision / Approved are new.
--   - In_Progress stays ALLOWED as a legacy value (ruling R1 = d, 2026-10-13):
--     4 live SM rows carry it; the UI shows it read-only and never offers it.
--     Remap + narrowing wait for Arin (not this migration).
--   - order_stage(): Sent / Revision -> proof, Approved -> lettering (ruling R2);
--     every existing value keeps its stage. Mirrors src/shared/lib/orderStage.ts.
-- additive guarantees:
--   - new CHECK is a strict superset of the old one and is added BEFORE the old
--     one is dropped, so the column is never unconstrained and no existing row
--     can fail validation
--   - default unchanged ('Not_Received'::text, read back 2026-10-13)
--   - order_stage is a function, not a view: v_orders_with_stage is NOT recreated,
--     its security_invoker reloption is untouched (read back below anyway)
-- portal reader note:
--   ../SearsMelvin inserts 'Not_Received' only (functions/api/partner-orders.js:496)
--   and reads proof_status only as a fallback behind inscription_status; SM rows
--   with inscription_status null = 0 (2026-10-13). Checked, not assumed.
-- pre-apply (read-only, record actuals here):
--   1. proof_status CHECKs on orders            -> EXPECT 1 row, orders_proof_status_check, 5 values
--                                                  | actual: 1 row, 5 values (Q1, 2026-10-13)
--      select conname, pg_get_constraintdef(oid) from pg_constraint
--        where conrelid = 'public.orders'::regclass and contype = 'c'
--          and pg_get_constraintdef(oid) ilike '%proof_status%';
--   2. live order_stage body matches 20260419120000 lines 22-36 -> EXPECT match | actual:
--      select pg_get_functiondef('public.order_stage(text,text,text)'::regprocedure);
--   3. objects depending on order_stage        -> EXPECT 1 (v_orders_with_stage rule) | actual:
--      select count(*) from pg_depend
--        where refobjid = 'public.order_stage(text,text,text)'::regprocedure;
-- apply: Dashboard SQL editor, one statement at a time, in order.

-- 1. superset CHECK first
alter table public.orders
  add constraint orders_proof_status_allowed
  check (proof_status in ('NA', 'Not_Received', 'Received', 'Sent', 'Revision', 'Approved', 'Lettered', 'In_Progress'));

-- 2. drop the original inline CHECK (20250608000001)
alter table public.orders drop constraint orders_proof_status_check;

-- 3. stage derivation
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
    -- Proof work in progress (In_Progress is legacy, kept until Arin's remap)
    when p_proof_status in ('Received', 'Sent', 'Revision', 'In_Progress') then 'proof'  -- R2
    -- Proof approved, lettering still to do
    when p_proof_status = 'Approved' then 'lettering'  -- R2
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

-- read-back (record actuals here; IDs/counts only):
--   a. proof_status CHECKs -> EXPECT 1 row: orders_proof_status_allowed, 8 values | actual:
--      (pre-apply 1 query)
--   b. CR in function body -> EXPECT 0 | actual:
--      select position(e'\r' in pg_get_functiondef('public.order_stage(text,text,text)'::regprocedure));
--   c. spot stages -> EXPECT proof | proof | lettering | proof | design | install_ready | actual:
--      select public.order_stage('NA', 'Sent', 'pending'),
--             public.order_stage('NA', 'Revision', 'pending'),
--             public.order_stage('NA', 'Approved', 'pending'),
--             public.order_stage('NA', 'In_Progress', 'pending'),
--             public.order_stage('NA', 'Not_Received', 'pending'),
--             public.order_stage('In Stock', 'Lettered', 'approved');
--   d. view reloptions unchanged -> EXPECT {security_invoker=true} | actual:
--      select relname, reloptions from pg_class where relname = 'v_orders_with_stage';
--   e. comment on order_stage survives (same OID) -> EXPECT 'Canonical 5-stage…' | actual:
--      select obj_description('public.order_stage(text,text,text)'::regprocedure);
