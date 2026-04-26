-- Ensure orders.cemetery_id and permit_forms.cemetery_id exist on every
-- environment. Staging surfaced "column orders.cemetery_id does not exist
-- (code 42703)" because the original add-column migration
-- 20260402120000_add_permit_tracker_columns_and_tables.sql either never
-- ran there or the column was dropped subsequently.
--
-- Both columns are nullable foreign keys to public.cemeteries(id) — they
-- mark the cemetery a given order / permit form is associated with.

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'orders'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'cemetery_id'
    ) then
      alter table public.orders add column cemetery_id uuid;

      -- Add the FK only if the cemeteries table actually exists
      if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'cemeteries'
      ) then
        alter table public.orders
          add constraint orders_cemetery_id_fkey
          foreign key (cemetery_id) references public.cemeteries(id);
      end if;

      create index if not exists idx_orders_cemetery_id on public.orders (cemetery_id);
    end if;
  end if;

  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'permit_forms'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'permit_forms' and column_name = 'cemetery_id'
    ) then
      alter table public.permit_forms add column cemetery_id uuid;

      if exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = 'cemeteries'
      ) then
        alter table public.permit_forms
          add constraint permit_forms_cemetery_id_fkey
          foreign key (cemetery_id) references public.cemeteries(id);
      end if;

      create index if not exists idx_permit_forms_cemetery_id on public.permit_forms (cemetery_id);
    end if;
  end if;
end $$;
