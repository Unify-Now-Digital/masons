-- Defensively backfill any expected columns on public.cemeteries that may
-- be missing on environments where the table was created before
-- 20260402120000_add_permit_tracker_columns_and_tables.sql ran (the
-- original create-table-if-not-exists no-op'd against an older schema).
--
-- The Cemeteries page reads: id, name, primary_email, phone, address,
-- avg_approval_days, notes, created_at, updated_at, organization_id,
-- is_test. Anything missing causes "column ... does not exist" errors
-- like the one observed on staging:
--   column cemeteries.primary_email does not exist (code 42703)

do $$
begin
  -- primary_email — fall back from a legacy 'email' column if present
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'primary_email'
  ) then
    alter table public.cemeteries add column primary_email text;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'email'
    ) then
      execute 'update public.cemeteries set primary_email = email where primary_email is null';
    end if;
  end if;

  -- phone
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'phone'
  ) then
    alter table public.cemeteries add column phone text;
  end if;

  -- address
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'address'
  ) then
    alter table public.cemeteries add column address text;
  end if;

  -- avg_approval_days
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'avg_approval_days'
  ) then
    alter table public.cemeteries add column avg_approval_days int;
  end if;

  -- notes
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'notes'
  ) then
    alter table public.cemeteries add column notes text;
  end if;

  -- created_at
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'created_at'
  ) then
    alter table public.cemeteries add column created_at timestamptz not null default now();
  end if;

  -- updated_at
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'updated_at'
  ) then
    alter table public.cemeteries add column updated_at timestamptz not null default now();
  end if;

  -- organization_id
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'organization_id'
  ) then
    alter table public.cemeteries add column organization_id uuid references public.organizations (id);
  end if;

  -- is_test
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cemeteries' and column_name = 'is_test'
  ) then
    alter table public.cemeteries add column is_test boolean not null default false;
  end if;
end $$;
