-- New orders default to permit_status = 'not_started'.
-- 'pending' now means only: the permit application is with the cemetery.
--
-- Live read-back before this migration (2026-10-12, information_schema):
--   orders.permit_status column_default = 'pending'::text
--   orders_permit_status_check already allows 'not_started'
--   (applied 2026-09-21 by 20260921120000_orders_permit_status_allow_not_started.sql)
-- The DO block below is a guard only: it aborts if the constraint does not
-- allow 'not_started', rather than silently setting an invalid default.
--
-- Default change only. Existing rows are NOT touched; any backfill of
-- mislabelled 'pending' orders is a separate, reviewed data change.
--
-- NOT APPLIED. Apply via Dashboard after review, then read back:
--   select column_default from information_schema.columns
--   where table_schema='public' and table_name='orders' and column_name='permit_status';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_permit_status_check'
      and pg_get_constraintdef(oid) like '%not_started%'
  ) then
    raise exception 'orders_permit_status_check does not allow not_started; apply 20260921120000 first';
  end if;
end $$;

alter table public.orders
  alter column permit_status set default 'not_started';
