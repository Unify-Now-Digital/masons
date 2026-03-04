-- Create activity_logs table for per-user audit trail
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb
);

-- Indexes for common access patterns
create index if not exists activity_logs_user_id_created_at_idx
  on public.activity_logs (user_id, created_at desc);

create index if not exists activity_logs_entity_idx
  on public.activity_logs (entity_type, entity_id, created_at desc);

-- Enable RLS and add policies (idempotent)
alter table public.activity_logs enable row level security;

drop policy if exists activity_logs_select_own on public.activity_logs;
create policy activity_logs_select_own on public.activity_logs
  for select
  using (user_id = auth.uid());

drop policy if exists activity_logs_no_update on public.activity_logs;
create policy activity_logs_no_update on public.activity_logs
  for update using (false) with check (false);

drop policy if exists activity_logs_no_delete on public.activity_logs;
create policy activity_logs_no_delete on public.activity_logs
  for delete using (false);

-- Helper: JSONB diff as PL/pgSQL, ignoring keys like updated_at
create or replace function public.jsonb_diff_rows(
  old_row jsonb,
  new_row jsonb,
  ignore_keys text[] default array['updated_at']
) returns jsonb
language plpgsql
as $$
declare
  key text;
  result jsonb := '{}'::jsonb;
  old_val jsonb;
  new_val jsonb;
begin
  -- Iterate over union of keys from old and new
  for key in
    select distinct k from (
      select jsonb_object_keys(coalesce(old_row, '{}')) as k
      union
      select jsonb_object_keys(coalesce(new_row, '{}')) as k
    ) s
  loop
    if key = any(ignore_keys) then
      continue;
    end if;

    old_val := coalesce(old_row -> key, 'null'::jsonb);
    new_val := coalesce(new_row -> key, 'null'::jsonb);

    if old_val is distinct from new_val then
      result := result || jsonb_build_object(
        key,
        jsonb_build_object(
          'from', old_row -> key,
          'to',   new_row -> key
        )
      );
    end if;
  end loop;

  return coalesce(result, '{}'::jsonb);
end;
$$;

-- SECURITY DEFINER writer so triggers can insert regardless of RLS
create or replace function public.activity_log_write(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_changes jsonb,
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.activity_logs (user_id, entity_type, entity_id, action, changes, context)
  values (
    p_user_id,
    p_entity_type,
    p_entity_id,
    p_action,
    coalesce(p_changes, '{}'::jsonb),
    coalesce(p_context, '{}'::jsonb)
  );
end;
$$;

-- Generic trigger function for logging INSERT/UPDATE/DELETE
create or replace function public.log_activity_generic() returns trigger
language plpgsql
as $$
declare
  v_user_id uuid;
  v_entity_type text := tg_argv[0];
  v_entity_id uuid;
  v_action text;
  v_changes jsonb := '{}'::jsonb;
  v_status_changed boolean := false;
begin
  -- Determine actor: auth.uid(), or optional mason.user_id setting for service-role flows
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if v_user_id is null then
    begin
      v_user_id := current_setting('mason.user_id', true)::uuid;
    exception when others then
      v_user_id := null;
    end;
  end if;

  -- If we have no user, skip logging but never block DML
  if v_user_id is null then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_action := 'insert';
    -- For inserts, you can log full row or keep changes empty; here we leave changes as {}
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_action := 'update';
    v_changes := public.jsonb_diff_rows(to_jsonb(old), to_jsonb(new), array['updated_at']);
    if v_changes = '{}'::jsonb then
      return new; -- no meaningful change
    end if;
  elsif tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_action := 'delete';
  else
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  -- Status change classification per table
  if tg_op = 'UPDATE' then
    if tg_table_name = 'invoices' then
      if (old.status is distinct from new.status)
         or (old.stripe_invoice_status is distinct from new.stripe_invoice_status) then
        v_status_changed := true;
      end if;
    elsif tg_table_name = 'orders' then
      if old.status is distinct from new.status then
        v_status_changed := true;
      end if;
    elsif tg_table_name = 'inbox_conversations' then
      if old.status is distinct from new.status then
        v_status_changed := true;
      end if;
    elsif tg_table_name = 'jobs' then
      begin
        if (to_jsonb(old) -> 'status') is distinct from (to_jsonb(new) -> 'status') then
          v_status_changed := true;
        end if;
      exception when others then
        v_status_changed := false;
      end;
    end if;

    if v_status_changed then
      v_action := 'status_changed';
    end if;
  end if;

  perform public.activity_log_write(
    v_user_id,
    v_entity_type,
    v_entity_id,
    v_action,
    v_changes,
    '{}'::jsonb
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Attach triggers to core tables (idempotent: drop then create)

-- invoices
drop trigger if exists invoices_activity_log on public.invoices;
create trigger invoices_activity_log
  after insert or update or delete on public.invoices
  for each row
  execute function public.log_activity_generic('invoice');

-- orders
drop trigger if exists orders_activity_log on public.orders;
create trigger orders_activity_log
  after insert or update or delete on public.orders
  for each row
  execute function public.log_activity_generic('order');

-- customers
drop trigger if exists customers_activity_log on public.customers;
create trigger customers_activity_log
  after insert or update or delete on public.customers
  for each row
  execute function public.log_activity_generic('customer');

-- invoice_payments
drop trigger if exists invoice_payments_activity_log on public.invoice_payments;
create trigger invoice_payments_activity_log
  after insert or update or delete on public.invoice_payments
  for each row
  execute function public.log_activity_generic('invoice_payment');

-- inbox_conversations
drop trigger if exists inbox_conversations_activity_log on public.inbox_conversations;
create trigger inbox_conversations_activity_log
  after insert or update or delete on public.inbox_conversations
  for each row
  execute function public.log_activity_generic('inbox_conversation');

-- inbox_messages
drop trigger if exists inbox_messages_activity_log on public.inbox_messages;
create trigger inbox_messages_activity_log
  after insert or update or delete on public.inbox_messages
  for each row
  execute function public.log_activity_generic('inbox_message');

