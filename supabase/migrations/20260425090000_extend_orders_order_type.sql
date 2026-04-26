-- ============================================================
-- Migration: extend_orders_order_type
-- Purpose: allow 'Kerb Set' and 'Additional Inscription' on
--          orders.order_type so the new mapping/scheduling page
--          can distinguish kerb work from other jobs for daily
--          capacity rules (max 2 kerb sets per day, total 3 jobs).
-- ============================================================

-- 1. Drop any pre-existing CHECK on order_type so we can re-create
--    it with the expanded allow-list. The original migration did
--    not add one, but defensive in case earlier patches did.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%order_type%'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;

-- 2. Re-add the constraint with the expanded set of allowed values.
alter table public.orders
  add constraint orders_order_type_check
  check (order_type in (
    'New Memorial',
    'Renovation',
    'Kerb Set',
    'Additional Inscription'
  ));
