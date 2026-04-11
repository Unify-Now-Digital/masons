-- Default organization "Churchill", backfill organization_id, bootstrap memberships (safe version)

do $$
declare
  v_org uuid;
begin
  select id into v_org
  from public.organizations
  where name = 'Churchill'
  limit 1;

  if v_org is null then
    insert into public.organizations (name)
    values ('Churchill')
    returning id into v_org;
  end if;

  -- Core spine
  update public.orders set organization_id = v_org where organization_id is null;
  update public.customers set organization_id = v_org where organization_id is null;
  update public.workers set organization_id = v_org where organization_id is null;
  update public.inbox_conversations set organization_id = v_org where organization_id is null;
  update public.gmail_connections set organization_id = v_org where organization_id is null;

  -- Optional tables
  if exists (select from pg_tables where schemaname='public' and tablename='whatsapp_connections') then
    update public.whatsapp_connections set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='whatsapp_managed_connections') then
    update public.whatsapp_managed_connections set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='whatsapp_connection_events') then
    update public.whatsapp_connection_events set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='whatsapp_user_preferences') then
    update public.whatsapp_user_preferences set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='revolut_connections') then
    update public.revolut_connections set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='permit_forms') then
    update public.permit_forms set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='cemeteries') then
    update public.cemeteries set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='table_view_presets') then
    update public.table_view_presets set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='activity_logs') then
    update public.activity_logs set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='payments') then
    update public.payments set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='processed_webhook_events') then
    update public.processed_webhook_events set organization_id = v_org where organization_id is null;
  end if;

  -- From orders
  update public.invoices i set organization_id = o.organization_id
  from public.orders o where i.order_id = o.id and i.organization_id is null and o.organization_id is not null;

  update public.jobs j set organization_id = o.organization_id
  from public.orders o where j.order_id = o.id and j.organization_id is null and o.organization_id is not null;

  if exists (select from pg_tables where schemaname='public' and tablename='inscriptions') then
    update public.inscriptions ins set organization_id = o.organization_id
    from public.orders o where ins.order_id = o.id and ins.organization_id is null and o.organization_id is not null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='order_people') then
    update public.order_people op set organization_id = o.organization_id
    from public.orders o where op.order_id = o.id and op.organization_id is null and o.organization_id is not null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='order_additional_options') then
    update public.order_additional_options oao set organization_id = o.organization_id
    from public.orders o where oao.order_id = o.id and oao.organization_id is null and o.organization_id is not null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='order_permits') then
    update public.order_permits opm set organization_id = o.organization_id
    from public.orders o where opm.order_id = o.id and opm.organization_id is null and o.organization_id is not null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='order_comments') then
    update public.order_comments oc set organization_id = o.organization_id
    from public.orders o where oc.order_id = o.id and oc.organization_id is null and o.organization_id is not null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='order_proofs') then
    update public.order_proofs opr set organization_id = o.organization_id
    from public.orders o where opr.order_id = o.id and opr.organization_id is null and o.organization_id is not null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='order_payments') then
    update public.order_payments opy set organization_id = o.organization_id
    from public.orders o where opy.order_id = o.id and opy.organization_id is null and o.organization_id is not null;
    update public.order_payments set organization_id = v_org where organization_id is null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='order_extras') then
    update public.order_extras oe set organization_id = o.organization_id
    from public.orders o where oe.order_id = o.id and oe.organization_id is null and o.organization_id is not null;
    update public.order_extras set organization_id = v_org where organization_id is null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='messages') then
    update public.messages msg set organization_id = o.organization_id
    from public.orders o where msg.order_id = o.id and msg.organization_id is null and o.organization_id is not null;
  end if;

  -- Workers
  if exists (select from pg_tables where schemaname='public' and tablename='worker_availability') then
    update public.worker_availability wa set organization_id = w.organization_id
    from public.workers w where wa.worker_id = w.id and wa.organization_id is null and w.organization_id is not null;
    update public.worker_availability set organization_id = v_org where organization_id is null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='job_workers') then
    update public.job_workers jw set organization_id = j.organization_id
    from public.jobs j where jw.job_id = j.id and jw.organization_id is null and j.organization_id is not null;
    update public.job_workers set organization_id = v_org where organization_id is null;
  end if;

  -- Inbox
  update public.inbox_messages m set organization_id = c.organization_id
  from public.inbox_conversations c where m.conversation_id = c.id and m.organization_id is null and c.organization_id is not null;
  update public.inbox_messages set organization_id = v_org where organization_id is null;

  if exists (select from pg_tables where schemaname='public' and tablename='inbox_ai_thread_summaries') then
    update public.inbox_ai_thread_summaries s set organization_id = c.organization_id
    from public.inbox_conversations c where s.conversation_id = c.id and s.organization_id is null and c.organization_id is not null;
    update public.inbox_ai_thread_summaries set organization_id = v_org where organization_id is null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='inbox_ai_suggestions') then
    update public.inbox_ai_suggestions s set organization_id = m.organization_id
    from public.inbox_messages m where s.message_id = m.id and s.organization_id is null and m.organization_id is not null;
    update public.inbox_ai_suggestions set organization_id = v_org where organization_id is null;
  end if;

  -- Invoicing
  if exists (select from pg_tables where schemaname='public' and tablename='invoice_payments') then
    update public.invoice_payments ip set organization_id = i.organization_id
    from public.invoices i where ip.invoice_id = i.id and ip.organization_id is null and i.organization_id is not null;
    update public.invoice_payments set organization_id = v_org where organization_id is null;
  end if;

  if exists (select from pg_tables where schemaname='public' and tablename='permit_activity_log') then
    if exists (select from pg_tables where schemaname='public' and tablename='order_permits') then
      update public.permit_activity_log pal set organization_id = op.organization_id
      from public.order_permits op where pal.order_permit_id = op.id and pal.organization_id is null and op.organization_id is not null;
    end if;
    update public.permit_activity_log set organization_id = v_org where organization_id is null;
  end if;

  -- Catalogue
  if exists (select from pg_tables where schemaname='public' and tablename='companies') then
    update public.companies set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='products') then
    update public.products set organization_id = v_org where organization_id is null;
  end if;
  if exists (select from pg_tables where schemaname='public' and tablename='quotes') then
    update public.quotes set organization_id = v_org where organization_id is null;
  end if;

  -- Memberships for all existing auth users
  insert into public.organization_members (organization_id, user_id, role)
  select v_org, u.id, 'admin'
  from auth.users u
  on conflict (organization_id, user_id) do nothing;

end $$;