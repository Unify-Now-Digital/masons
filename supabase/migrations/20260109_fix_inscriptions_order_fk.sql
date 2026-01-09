-- 1) Make sure order_id can be NULL (safe even if already nullable)
alter table public.inscriptions
  alter column order_id drop not null;

-- 2) Drop the existing FK (CASCADE) if it exists
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'inscriptions_order_id_fkey'
  ) then
    alter table public.inscriptions
      drop constraint inscriptions_order_id_fkey;
  end if;
end $$;

-- 3) Recreate FK with ON DELETE SET NULL
alter table public.inscriptions
  add constraint inscriptions_order_id_fkey
  foreign key (order_id)
  references public.orders(id)
  on delete set null;

-- 4) Index for performance (optional but recommended)
create index if not exists idx_inscriptions_order_id
  on public.inscriptions(order_id);
