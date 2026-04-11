-- Remaining tenant-scoped business tables (safe version)

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'permit_forms') then
    alter table public.permit_forms add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_permit_forms_organization_id on public.permit_forms (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'order_permits') then
    alter table public.order_permits add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_order_permits_organization_id on public.order_permits (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'permit_activity_log') then
    alter table public.permit_activity_log add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_permit_activity_log_organization_id on public.permit_activity_log (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'cemeteries') then
    alter table public.cemeteries add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_cemeteries_organization_id on public.cemeteries (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'order_comments') then
    alter table public.order_comments add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_order_comments_organization_id on public.order_comments (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'order_proofs') then
    alter table public.order_proofs add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_order_proofs_organization_id on public.order_proofs (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'invoice_payments') then
    alter table public.invoice_payments add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_invoice_payments_organization_id on public.invoice_payments (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'payments') then
    alter table public.payments add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_payments_organization_id on public.payments (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'order_payments') then
    alter table public.order_payments add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_order_payments_organization_id on public.order_payments (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'order_extras') then
    alter table public.order_extras add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_order_extras_organization_id on public.order_extras (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'revolut_connections') then
    alter table public.revolut_connections add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_revolut_connections_organization_id on public.revolut_connections (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'processed_webhook_events') then
    alter table public.processed_webhook_events add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_processed_webhook_events_organization_id on public.processed_webhook_events (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'activity_logs') then
    alter table public.activity_logs add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_activity_logs_organization_id on public.activity_logs (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'table_view_presets') then
    alter table public.table_view_presets add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_table_view_presets_organization_id on public.table_view_presets (organization_id);
  end if;
end $$;

do $$ begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'messages') then
    alter table public.messages add column if not exists organization_id uuid references public.organizations (id);
    create index if not exists idx_messages_organization_id on public.messages (organization_id);
  end if;
end $$;