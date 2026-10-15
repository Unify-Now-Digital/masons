-- NOT APPLIED. Apply by hand in the Dashboard SQL editor, statement by statement.
-- Do not supabase db push. Additive only.
--
-- Phase 1 activity feed: one row per thing a person should see, plus who has
-- read it. Writers are log_activity_event (deduped) and the triggers below.
-- Set mason.skip_activity to 'on' for a bulk backfill so it does not flood the feed:
--   select set_config('mason.skip_activity', 'on', true);
-- No customer names. Titles are generic ("Invoice paid", "New enquiry").

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type text not null,
  category text not null,
  priority text not null default 'fyi',
  entity_type text,
  entity_id uuid,
  order_id uuid,
  actor_type text not null,
  actor_id uuid,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
  audience text not null default 'all',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.activity_events is
  'Staff activity feed. dedupe_key is unique per organisation. payload.children holds a supplier digest.';

create unique index if not exists activity_events_org_dedupe_uidx
  on public.activity_events (organization_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists activity_events_org_created_idx
  on public.activity_events (organization_id, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_events_priority_check') then
    alter table public.activity_events
      add constraint activity_events_priority_check
      check (priority in ('action', 'fyi'));
  end if;
end $$;

create table if not exists public.activity_event_reads (
  event_id uuid not null references public.activity_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

comment on table public.activity_event_reads is
  'Which user has opened an activity event. The AI button badge counts unread action rows.';

create index if not exists activity_event_reads_user_idx
  on public.activity_event_reads (user_id);

alter table public.activity_events enable row level security;
alter table public.activity_event_reads enable row level security;

-- security definer: the row is inserted by triggers and by edge functions.
-- Authenticated callers must belong to the organisation. service_role skips that
-- check (Stripe, Revolut, the Monday read). The owner bypasses RLS on the insert.
create or replace function public.log_activity_event(
  p_organization_id uuid,
  p_type text,
  p_category text,
  p_priority text,
  p_title text,
  p_actor_type text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_order_id uuid default null,
  p_actor_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_audience text default 'all'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key text;
begin
  if p_organization_id is null or coalesce(p_type, '') = '' or coalesce(p_title, '') = '' then
    return null;
  end if;
  if coalesce(current_setting('mason.skip_activity', true), '') = 'on' then
    return null;
  end if;
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.user_is_member_of_org(p_organization_id) then
      return null;
    end if;
  end if;
  v_key := nullif(p_dedupe_key, '');
  insert into public.activity_events (
    organization_id, type, category, priority, entity_type, entity_id, order_id,
    actor_type, actor_id, title, body, payload, dedupe_key, audience
  ) values (
    p_organization_id,
    p_type,
    p_category,
    case when p_priority = 'action' then 'action' else 'fyi' end,
    p_entity_type,
    p_entity_id,
    p_order_id,
    p_actor_type,
    p_actor_id,
    p_title,
    p_body,
    coalesce(p_payload, '{}'::jsonb),
    v_key,
    coalesce(nullif(p_audience, ''), 'all')
  )
  on conflict (organization_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.log_activity_event(
  uuid, text, text, text, text, text, text, text, uuid, uuid, uuid, jsonb, text, text
) is
  'Insert one activity feed row. Same organisation + dedupe_key is a no-op. Bulk jobs set mason.skip_activity.';

revoke all on function public.log_activity_event(
  uuid, text, text, text, text, text, text, text, uuid, uuid, uuid, jsonb, text, text
) from public, anon;
grant execute on function public.log_activity_event(
  uuid, text, text, text, text, text, text, text, uuid, uuid, uuid, jsonb, text, text
) to authenticated, service_role;

create or replace function public.trg_activity_order_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is null then
    return new;
  end if;
  perform public.log_activity_event(
    new.organization_id,
    'order.status',
    'orders',
    'fyi',
    'Order status changed',
    'user',
    null,
    'order',
    new.id,
    new.id,
    auth.uid(),
    jsonb_build_object('from', old.status, 'to', new.status),
    'order:status:' || new.id::text || ':' || coalesce(new.status, '') || ':' || to_char((now() at time zone 'utc'), 'YYYY-MM-DD'),
    'all'
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_activity_orders_status on public.orders;
create trigger trg_activity_orders_status
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.trg_activity_order_status();

create or replace function public.trg_activity_invoice_paid_sent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  if new.organization_id is null then
    return new;
  end if;
  v_order_id := new.order_id;
  if v_order_id is null then
    select o.id into v_order_id
    from public.orders o
    where o.invoice_id = new.id
      and o.organization_id = new.organization_id
    limit 1;
  end if;
  if new.paid_at is not null and old.paid_at is null then
    perform public.log_activity_event(
      new.organization_id, 'invoice.paid', 'finance', 'fyi', 'Invoice paid', 'stripe',
      null, 'invoice', new.id, v_order_id, null, '{}'::jsonb,
      'invoice:paid:' || new.id::text, 'all'
    );
  elsif new.status is distinct from old.status
    and new.status in ('sent', 'open')
    and coalesce(old.status, '') not in ('paid', 'sent', 'open')
    and new.paid_at is null then
    perform public.log_activity_event(
      new.organization_id, 'invoice.sent', 'finance', 'fyi', 'Invoice sent', 'stripe',
      null, 'invoice', new.id, v_order_id, null, '{}'::jsonb,
      'invoice:sent:' || new.id::text, 'all'
    );
  elsif new.stripe_invoice_status is distinct from old.stripe_invoice_status
    and new.stripe_invoice_status in ('open', 'sent')
    and coalesce(old.stripe_invoice_status, 'draft') in ('draft', '')
    and new.paid_at is null then
    perform public.log_activity_event(
      new.organization_id, 'invoice.sent', 'finance', 'fyi', 'Invoice sent', 'stripe',
      null, 'invoice', new.id, v_order_id, null, '{}'::jsonb,
      'invoice:sent:' || new.id::text, 'all'
    );
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_activity_invoices_paid_sent on public.invoices;
create trigger trg_activity_invoices_paid_sent
  after update of status, paid_at, stripe_invoice_status on public.invoices
  for each row
  execute function public.trg_activity_invoice_paid_sent();

create or replace function public.trg_activity_enquiry_created()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is null then
    return new;
  end if;
  perform public.log_activity_event(
    new.organization_id,
    'enquiry.created',
    'sales',
    'action',
    'New enquiry',
    'customer',
    null,
    'enquiry',
    new.id,
    new.order_id,
    null,
    '{}'::jsonb,
    'enquiry:created:' || new.id::text,
    'all'
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_activity_enquiries_created on public.enquiries;
create trigger trg_activity_enquiries_created
  after insert on public.enquiries
  for each row
  execute function public.trg_activity_enquiry_created();

drop policy if exists activity_events_select_member on public.activity_events;
drop policy if exists activity_events_select_anon on public.activity_events;
drop policy if exists activity_events_update_member on public.activity_events;
drop policy if exists activity_events_update_anon on public.activity_events;
drop policy if exists activity_event_reads_select_own on public.activity_event_reads;
drop policy if exists activity_event_reads_insert_own on public.activity_event_reads;
drop policy if exists activity_event_reads_delete_own on public.activity_event_reads;
drop policy if exists activity_event_reads_select_anon on public.activity_event_reads;
drop policy if exists activity_event_reads_insert_anon on public.activity_event_reads;

create policy activity_events_select_member
  on public.activity_events
  for select
  to authenticated
  using (public.user_is_member_of_org(organization_id));

create policy activity_events_select_anon
  on public.activity_events
  for select
  to anon
  using (false);

create policy activity_events_update_member
  on public.activity_events
  for update
  to authenticated
  using (public.user_is_member_of_org(organization_id))
  with check (public.user_is_member_of_org(organization_id));

create policy activity_events_update_anon
  on public.activity_events
  for update
  to anon
  using (false)
  with check (false);

create policy activity_event_reads_select_own
  on public.activity_event_reads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.activity_events e
      where e.id = event_id
        and public.user_is_member_of_org(e.organization_id)
    )
  );

create policy activity_event_reads_select_anon
  on public.activity_event_reads
  for select
  to anon
  using (false);

create policy activity_event_reads_insert_own
  on public.activity_event_reads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.activity_events e
      where e.id = event_id
        and public.user_is_member_of_org(e.organization_id)
    )
  );

create policy activity_event_reads_insert_anon
  on public.activity_event_reads
  for insert
  to anon
  with check (false);

create policy activity_event_reads_delete_own
  on public.activity_event_reads
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.activity_events from anon, authenticated;
revoke all on table public.activity_event_reads from anon, authenticated;

grant select on table public.activity_events to authenticated;
grant update (resolved_at) on table public.activity_events to authenticated;
grant select, insert, delete on table public.activity_event_reads to authenticated;
grant all on table public.activity_events to service_role;
grant all on table public.activity_event_reads to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_events'
  ) then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end $$;
