alter table public.invoices
  add column if not exists deleted_at timestamptz null;

create index if not exists invoices_deleted_at_idx
  on public.invoices (deleted_at);

