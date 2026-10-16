-- Owner-only money lock for Sears Melvin.
--
-- One person may see or change money: arin@searsmelvin.co.uk on the Sears Melvin
-- organisation. The flag is organization_members.is_owner. Only an existing owner
-- (or a privileged migration / service role) can set it. Roles are not changed.
--
-- public.user_can_view_org_finance now means "is_owner", so every policy that
-- already calls it (invoices, invoice_payments, order_payments including Revolut
-- accept and ignore, record_manual_payment) becomes owner-only without a rewrite.
--
-- Money columns are revoked from anon and authenticated. The owner reads them
-- through security-definer views that filter with money_row_visible. Staff get
-- order_payment_status (three booleans, no amounts) and enquiry_details_safe
-- (price keys removed). Service role is not revoked and is treated as visible,
-- so Make, n8n and edge functions keep reading and writing the same rows.
-- Existing order_payments rows are not deleted or updated.

-- ---------------------------------------------------------------------------
-- Owner flag
-- ---------------------------------------------------------------------------

alter table public.organization_members
  add column if not exists is_owner boolean not null default false;

comment on column public.organization_members.is_owner is
  'Only flag that may see or change money. Only an existing owner can set it.';

create or replace function public.session_is_privileged()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
    or coalesce((select auth.role()) = 'service_role', false);
$$;

-- Views call this as the caller, so callers need EXECUTE. It only reports the session role.
revoke all on function public.session_is_privileged() from public;
grant execute on function public.session_is_privileged() to anon, authenticated, service_role;

create or replace function public.organization_members_owner_flag_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owners_left integer;
begin
  if tg_op = 'INSERT' then
    if new.is_owner is not true or public.session_is_privileged() then
      return new;
    end if;
    if not exists (
      select 1
      from public.organization_members m
      where m.organization_id = new.organization_id
        and m.user_id = (select auth.uid())
        and m.is_owner
    ) then
      raise exception 'Only an owner can change the owner flag' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_owner is not distinct from old.is_owner or public.session_is_privileged() then
      return new;
    end if;
    if not exists (
      select 1
      from public.organization_members m
      where m.organization_id = old.organization_id
        and m.user_id = (select auth.uid())
        and m.is_owner
    ) then
      raise exception 'Only an owner can change the owner flag' using errcode = '42501';
    end if;
    if old.is_owner and new.is_owner is not true then
      select count(*)::integer into v_owners_left
      from public.organization_members m
      where m.organization_id = old.organization_id
        and m.is_owner
        and m.id is distinct from old.id;
      if v_owners_left = 0 then
        raise exception 'The workshop must keep an owner' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_owner is not true then
      return old;
    end if;
    if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
      return old;
    end if;
    if not public.session_is_privileged() then
      if not exists (
        select 1
        from public.organization_members m
        where m.organization_id = old.organization_id
          and m.user_id = (select auth.uid())
          and m.is_owner
          and m.id is distinct from old.id
      ) then
        raise exception 'Only an owner can change the owner flag' using errcode = '42501';
      end if;
      select count(*)::integer into v_owners_left
      from public.organization_members m
      where m.organization_id = old.organization_id
        and m.is_owner
        and m.id is distinct from old.id;
      if v_owners_left = 0 then
        raise exception 'The workshop must keep an owner' using errcode = '42501';
      end if;
    end if;
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists organization_members_owner_flag_guard on public.organization_members;
create trigger organization_members_owner_flag_guard
  before insert or update or delete on public.organization_members
  for each row execute function public.organization_members_owner_flag_guard();

-- Seed the only owner. Lookup is by email and organisation name. No role changes.
do $$
declare
  n integer;
begin
  update public.organization_members m
  set is_owner = true
  from public.organizations o
  join auth.users u on lower(u.email) = 'arin@searsmelvin.co.uk'
  where m.organization_id = o.id
    and o.name = 'Sears Melvin'
    and m.user_id = u.id;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception
      'Expected to mark exactly one Sears Melvin owner (arin@searsmelvin.co.uk), updated %', n;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finance helper now means "owner"
-- ---------------------------------------------------------------------------

create or replace function public.user_can_view_org_finance(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Organisations with an owner: owner only. Organisations with no owner keep
  -- the previous rule (admin and member see money).
  select case
    when exists (
      select 1 from public.organization_members o
      where o.organization_id = p_org and o.is_owner
    ) then exists (
      select 1 from public.organization_members m
      where m.organization_id = p_org
        and m.user_id = (select auth.uid())
        and m.is_owner
    )
    else exists (
      select 1 from public.organization_members m
      where m.organization_id = p_org
        and m.user_id = (select auth.uid())
        and m.role in ('admin', 'member')
    )
  end;
$$;

-- For the UI: which of my organisations have an owner set.
create or replace function public.my_org_owner_flags()
returns table (organization_id uuid, has_owner boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id,
    exists (
      select 1 from public.organization_members o
      where o.organization_id = m.organization_id and o.is_owner
    )
  from public.organization_members m
  where m.user_id = (select auth.uid());
$$;

revoke all on function public.my_org_owner_flags() from public, anon;
grant execute on function public.my_org_owner_flags() to authenticated, service_role;

create or replace function public.money_row_visible(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.session_is_privileged()
    or public.user_can_view_org_finance(p_org);
$$;

revoke all on function public.money_row_visible(uuid) from public, anon;
grant execute on function public.money_row_visible(uuid) to authenticated, service_role;

create or replace function public.money_write_allowed(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.money_row_visible(p_org);
$$;

revoke all on function public.money_write_allowed(uuid) from public, anon;
grant execute on function public.money_write_allowed(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Strip price keys out of jsonb / text blobs (product_config, enquiry details)
-- ---------------------------------------------------------------------------

create or replace function public.strip_money_json(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  elem jsonb;
  out jsonb := '{}'::jsonb;
  arr jsonb := '[]'::jsonb;
  keys text[] := array[
    'price', 'permit_fee', 'permitfee', 'amount', 'value', 'cost', 'total',
    'total_value', 'base_price', 'inscription_price_per_char', 'line_cost',
    'net_revenue', 'additional_options_total', 'permit_cost',
    'renovation_service_cost'
  ];
begin
  if p is null then
    return null;
  end if;
  if jsonb_typeof(p) = 'object' then
    for k, v in select e.key, e.value from jsonb_each(p) as e
    loop
      if lower(k) = any (keys) then
        continue;
      elsif jsonb_typeof(v) in ('object', 'array') then
        out := out || jsonb_build_object(k, public.strip_money_json(v));
      else
        out := out || jsonb_build_object(k, v);
      end if;
    end loop;
    return out;
  elsif jsonb_typeof(p) = 'array' then
    for elem in select e.value from jsonb_array_elements(p) as e
    loop
      arr := arr || jsonb_build_array(public.strip_money_json(elem));
    end loop;
    return arr;
  end if;
  return p;
end;
$$;

create or replace function public.strip_money_text(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or btrim(p) = '' then
    return p;
  end if;
  begin
    return public.strip_money_json(p::jsonb)::text;
  exception when others then
    return p;
  end;
end;
$$;

-- Pure helpers called inside views as the caller; they only remove data.
revoke all on function public.strip_money_json(jsonb) from public;
revoke all on function public.strip_money_text(text) from public;
grant execute on function public.strip_money_json(jsonb) to anon, authenticated, service_role;
grant execute on function public.strip_money_text(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Freeze money columns unless the writer is the owner or a privileged role.
-- Non-owners may still update the rest of the row. Inserts store zeros / nulls
-- so not-null columns stay valid, and price keys are stripped from blobs.
-- ---------------------------------------------------------------------------

create or replace function public.freeze_order_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.money_write_allowed(new.organization_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.value := null;
    new.permit_cost := 0;
    new.permit_fee := null;
    new.renovation_service_cost := 0;
    new.product_config := public.strip_money_text(new.product_config);
    return new;
  end if;
  new.value := old.value;
  new.permit_cost := old.permit_cost;
  new.permit_fee := old.permit_fee;
  new.renovation_service_cost := old.renovation_service_cost;
  new.product_config := old.product_config;
  return new;
end;
$$;

create or replace function public.freeze_quote_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.money_write_allowed(new.organization_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.value := null;
    new.total_value := null;
    new.permit_cost := null;
    new.product_config := public.strip_money_text(new.product_config);
    return new;
  end if;
  new.value := old.value;
  new.total_value := old.total_value;
  new.permit_cost := old.permit_cost;
  new.product_config := old.product_config;
  return new;
end;
$$;

create or replace function public.freeze_product_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.money_write_allowed(new.organization_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.base_price := 0;
    new.inscription_price_per_char := null;
    return new;
  end if;
  new.base_price := old.base_price;
  new.inscription_price_per_char := old.inscription_price_per_char;
  return new;
end;
$$;

create or replace function public.freeze_option_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.money_write_allowed(new.organization_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.cost := 0;
    return new;
  end if;
  new.cost := old.cost;
  return new;
end;
$$;

create or replace function public.freeze_enquiry_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kept jsonb;
begin
  if public.money_write_allowed(new.organization_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.details := public.strip_money_json(new.details);
    return new;
  end if;
  new.details := public.strip_money_json(new.details);
  if old.details is not null and jsonb_typeof(old.details) = 'object' then
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      into kept
    from jsonb_each(old.details) as e
    where lower(e.key) = any (array[
      'price', 'permit_fee', 'permitfee', 'amount', 'value', 'cost', 'total',
      'total_value', 'base_price', 'inscription_price_per_char', 'line_cost',
      'net_revenue', 'additional_options_total', 'permit_cost',
      'renovation_service_cost'
    ]);
    new.details := coalesce(new.details, '{}'::jsonb) || coalesce(kept, '{}'::jsonb);
  else
    new.details := old.details;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_freeze_money on public.orders;
create trigger orders_freeze_money
  before insert or update on public.orders
  for each row execute function public.freeze_order_money();

drop trigger if exists quotes_freeze_money on public.quotes;
create trigger quotes_freeze_money
  before insert or update on public.quotes
  for each row execute function public.freeze_quote_money();

drop trigger if exists products_freeze_money on public.products;
create trigger products_freeze_money
  before insert or update on public.products
  for each row execute function public.freeze_product_money();

drop trigger if exists order_additional_options_freeze_money on public.order_additional_options;
create trigger order_additional_options_freeze_money
  before insert or update on public.order_additional_options
  for each row execute function public.freeze_option_money();

drop trigger if exists enquiries_freeze_money on public.enquiries;
create trigger enquiries_freeze_money
  before insert or update on public.enquiries
  for each row execute function public.freeze_enquiry_money();

-- Column privileges are role-wide, so the owner cannot select these either.
-- Owners use the views below. Service role keeps its existing grants.
-- A public catalogue select('*') on products will fail for anon after this.
-- Column revokes do nothing while a table-level SELECT grant exists, so drop the
-- table-level grant and grant SELECT back on every non-money column, only to the
-- roles that had table-level SELECT before. Service role keeps its grants.
-- NOTE: a column added to these tables later must be granted explicitly.
do $$
declare
  spec record;
  r text;
  cols text;
begin
  for spec in
    select * from (values
      ('orders',                   array['value','permit_cost','permit_fee','renovation_service_cost','product_config']),
      ('quotes',                   array['value','total_value','permit_cost','product_config']),
      ('products',                 array['base_price','inscription_price_per_char']),
      ('order_additional_options', array['cost']),
      ('enquiries',                array['details'])
    ) as t(tbl, money)
  loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
    from pg_attribute a
    where a.attrelid = format('public.%I', spec.tbl)::regclass
      and a.attnum > 0 and not a.attisdropped
      and a.attname <> all (spec.money);
    foreach r in array array['anon', 'authenticated'] loop
      if has_table_privilege(r, format('public.%I', spec.tbl), 'SELECT') then
        execute format('revoke select on table public.%I from %I', spec.tbl, r);
        execute format('grant select (%s) on table public.%I to %I', cols, spec.tbl, r);
      end if;
      execute format('revoke select (%s) on table public.%I from %I',
        (select string_agg(quote_ident(x), ', ') from unnest(spec.money) x), spec.tbl, r);
    end loop;
  end loop;
  -- Public catalogue: active products keep their list price for anon (the
  -- "Public can view active products" policy). List prices are public; this
  -- is not revenue.
  execute 'grant select (base_price, inscription_price_per_char) on table public.products to anon';
end;
$$;

-- ---------------------------------------------------------------------------
-- Column-safe views. security_invoker stays off: the view owner reads the
-- revoked columns, then the where clause decides who sees the row.
-- ---------------------------------------------------------------------------

create or replace view public.order_amounts as
select
  o.id,
  o.organization_id,
  o.value,
  o.permit_cost,
  o.permit_fee,
  o.renovation_service_cost,
  coalesce(opt.additional_options_total, 0) as additional_options_total
from public.orders o
left join (
  select order_id, sum(cost) as additional_options_total
  from public.order_additional_options
  group by order_id
) opt on opt.order_id = o.id
where public.money_row_visible(o.organization_id);

create or replace view public.quote_amounts as
select q.id, q.organization_id, q.value, q.total_value, q.permit_cost
from public.quotes q
where public.money_row_visible(q.organization_id);

create or replace view public.product_prices as
select p.id, p.organization_id, p.base_price, p.inscription_price_per_char
from public.products p
where public.money_row_visible(p.organization_id);

create or replace view public.option_amounts as
select ao.id, ao.order_id, ao.organization_id, ao.cost
from public.order_additional_options ao
where public.money_row_visible(ao.organization_id);

create or replace view public.order_configs as
select
  o.id,
  o.organization_id,
  case
    when public.money_row_visible(o.organization_id) then o.product_config
    else public.strip_money_text(o.product_config)
  end as product_config
from public.orders o
where public.session_is_privileged()
  or public.user_is_member_of_org(o.organization_id);

create or replace view public.quote_configs as
select
  q.id,
  q.organization_id,
  case
    when public.money_row_visible(q.organization_id) then q.product_config
    else public.strip_money_text(q.product_config)
  end as product_config
from public.quotes q
where public.session_is_privileged()
  or public.user_is_member_of_org(q.organization_id);

create or replace view public.enquiry_details_safe as
select
  e.id,
  e.organization_id,
  case
    when public.money_row_visible(e.organization_id) then e.details
    else public.strip_money_json(e.details)
  end as details
from public.enquiries e
where public.session_is_privileged()
  or public.user_is_member_of_org(e.organization_id);

-- Yes / no only. No numeric column, so a select * cannot return a pound figure.
create or replace view public.order_payment_status as
select
  o.id,
  o.organization_id,
  (
    o.deposit_date is not null
    or exists (
      select 1
      from public.order_payments p
      where p.order_id = o.id
        and p.status = 'matched'
        and p.payment_type = 'deposit'
    )
  ) as deposit_received,
  (tot.total > 0.01 and tot.balance <= 0.01) as fully_paid,
  (tot.balance > 0.01) as balance_outstanding
from public.orders o
cross join lateral (
  select
    coalesce(o.value, 0) + coalesce(o.renovation_service_cost, 0) + coalesce(opt.additional_options_total, 0) as total,
    greatest(
      coalesce(o.value, 0) + coalesce(o.renovation_service_cost, 0) + coalesce(opt.additional_options_total, 0)
        - (coalesce(op.paid, 0) + coalesce(pay.amount_paid, 0)),
      0
    ) as balance
  from (select 1) _
  left join (
    select order_id, sum(cost) as additional_options_total
    from public.order_additional_options
    group by order_id
  ) opt on opt.order_id = o.id
  left join (
    select order_id, sum(amount) as paid
    from public.order_payments
    where status = 'matched' and order_id is not null
    group by order_id
  ) op on op.order_id = o.id
  left join (
    select i.order_id, sum(i.amount) as amount_paid
    from public.invoices i
    where i.status = 'paid' and i.order_id is not null
      and not exists (
        select 1
        from public.order_payments p
        where p.external_id is not null
          and p.external_id = i.stripe_payment_intent_id
      )
    group by i.order_id
  ) pay on pay.order_id = o.id
) tot
where public.session_is_privileged()
  or public.user_is_member_of_org(o.organization_id);

-- orders_with_balance keeps its column list. amount_paid includes matched
-- order_payments plus paid invoices whose payment intent is not already a
-- payment row (same rule as 20261014200100). Rows are owner-only.
create or replace view public.orders_with_balance as
select o.id, o.customer_name, o.customer_email, o.customer_phone, o.order_type, o.sku, o.material, o.color,
  o.stone_status, o.permit_status, o.proof_status, o.deposit_date, o.second_payment_date, o.due_date,
  o.installation_date, o.location, o.value, o.progress, o.assigned_to, o.priority, o.timeline_weeks, o.notes,
  o.created_at, o.updated_at, o.invoice_id, o.latitude, o.longitude, o.permit_cost,
  o.renovation_service_description, o.renovation_service_cost, o.geocode_status, o.geocode_error,
  o.geocoded_at, o.geocode_place_id, o.order_number, o.person_id, o.person_name, o.product_photo_url,
  o.permit_form_id, o.partner_id, o.edit_token, o.product_config, o.status, o.quote_id, o.tracking_token,
  o.inscription_text, o.inscription_status, o.proof_url, o.proof_uploaded_at, o.proof_notes,
  o.estimated_completion, o.permit_transferred_at, o.permit_fee, o.inscription_font, o.inscription_font_other,
  o.inscription_layout, o.inscription_additional, o.product_id, o.organization_id, o.cemetery_id,
  o.admin_notes, o.is_test,
  (coalesce(o.value, 0) + coalesce(o.renovation_service_cost, 0) + coalesce(opt.additional_options_total, 0)) as total_order_value,
  (coalesce(op.paid, 0) + coalesce(pay.amount_paid, 0)) as amount_paid,
  greatest(
    coalesce(o.value, 0) + coalesce(o.renovation_service_cost, 0) + coalesce(opt.additional_options_total, 0)
      - (coalesce(op.paid, 0) + coalesce(pay.amount_paid, 0)),
    0
  ) as balance_due,
  fin.final_invoice_id,
  fin.final_invoice_sent_at
from public.orders o
left join (
  select order_id, sum(cost) as additional_options_total
  from public.order_additional_options
  group by order_id
) opt on opt.order_id = o.id
left join (
  select order_id, sum(amount) as paid
  from public.order_payments
  where status = 'matched' and order_id is not null
  group by order_id
) op on op.order_id = o.id
left join (
  select i.order_id, sum(i.amount) as amount_paid
  from public.invoices i
  where i.status = 'paid' and i.order_id is not null
    and not exists (
      select 1
      from public.order_payments p
      where p.external_id is not null
        and p.external_id = i.stripe_payment_intent_id
    )
  group by i.order_id
) pay on pay.order_id = o.id
left join lateral (
  select i.id as final_invoice_id, i.issue_date as final_invoice_sent_at
  from public.invoices i
  where i.order_id = o.id
  order by i.issue_date desc nulls last, i.created_at desc
  limit 1
) fin on true
where public.money_row_visible(o.organization_id);

create or replace view public.orders_with_options_total as
select
  o.id,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.order_type,
  o.sku,
  o.material,
  o.color,
  o.stone_status,
  o.permit_status,
  o.proof_status,
  o.deposit_date,
  o.second_payment_date,
  o.due_date,
  o.installation_date,
  o.location,
  o.value,
  o.progress,
  o.assigned_to,
  o.priority,
  o.timeline_weeks,
  o.notes,
  o.created_at,
  o.updated_at,
  o.invoice_id,
  o.latitude,
  o.longitude,
  o.permit_cost,
  o.renovation_service_description,
  o.renovation_service_cost,
  o.geocode_status,
  o.geocode_error,
  o.geocoded_at,
  o.geocode_place_id,
  o.order_number,
  o.person_id,
  o.person_name,
  o.product_photo_url,
  o.permit_form_id,
  o.partner_id,
  o.edit_token,
  o.product_config,
  o.status,
  o.quote_id,
  o.tracking_token,
  o.inscription_text,
  o.inscription_status,
  o.proof_url,
  o.proof_uploaded_at,
  o.proof_notes,
  o.estimated_completion,
  o.permit_transferred_at,
  o.permit_fee,
  o.inscription_font,
  o.inscription_font_other,
  o.inscription_layout,
  o.inscription_additional,
  o.product_id,
  o.organization_id,
  coalesce(sum(ao.cost), 0::numeric) as additional_options_total,
  o.custom_product_name
from public.orders o
left join public.order_additional_options ao on ao.order_id = o.id
where public.money_row_visible(o.organization_id)
group by o.id;

create or replace view public.invoices_with_breakdown as
select
  i.id,
  i.order_id,
  i.invoice_number,
  i.customer_name,
  i.amount,
  i.status,
  i.due_date,
  i.issue_date,
  i.payment_method,
  i.payment_date,
  i.notes,
  i.created_at,
  i.updated_at,
  i.stripe_checkout_session_id,
  i.stripe_payment_intent_id,
  i.stripe_status,
  i.paid_at,
  i.stripe_invoice_id,
  i.stripe_invoice_status,
  i.user_id,
  i.hosted_invoice_url,
  i.amount_paid,
  i.amount_remaining,
  i.revised_from_invoice_id,
  i.locked_at,
  i.deleted_at,
  i.organization_id,
  i.is_test,
  coalesce(o.value, 0::numeric) as main_product_total,
  coalesce(opt.additional_options_total, 0::numeric) as additional_options_total,
  coalesce(o.permit_cost, 0::numeric) as permit_total_cost,
  i.intended_deposit_pence,
  i.person_id
from public.invoices i
left join public.orders o on o.id = i.order_id
left join (
  select order_additional_options.order_id, sum(order_additional_options.cost) as additional_options_total
  from public.order_additional_options
  group by order_additional_options.order_id
) opt on opt.order_id = i.order_id
where public.money_row_visible(i.organization_id);

-- v_monthly_revenue stays security invoker. It only reads invoices, and invoice
-- select RLS now requires the owner. Making it definer would skip RLS and leak
-- every organisation, because the view has no organisation column.

create or replace view public.v_top_products as
select
  order_type as product_name,
  count(*) as order_count,
  sum(coalesce(value, 0::numeric) + coalesce(renovation_service_cost, 0::numeric)) as net_revenue
from public.orders
where value is not null
  and public.money_row_visible(organization_id)
group by order_type
order by (sum(coalesce(value, 0::numeric) + coalesce(renovation_service_cost, 0::numeric))) desc
limit 10;

create or replace view public.v_order_line_items as
select
  o.id as order_id,
  o.order_number,
  o.customer_name,
  o.partner_id,
  o.person_id,
  'memorial'::text as line_type,
  o.sku as item_ref,
  coalesce(o.order_type, 'Memorial'::text) as item_name,
  null::text as item_description,
  o.value as line_cost,
  o.created_at
from public.orders o
where o.value is not null and o.value > 0::numeric
  and public.money_row_visible(o.organization_id)
union all
select
  o.id as order_id,
  o.order_number,
  o.customer_name,
  o.partner_id,
  o.person_id,
  'renovation'::text as line_type,
  null::text as item_ref,
  'Renovation Service'::text as item_name,
  o.renovation_service_description as item_description,
  o.renovation_service_cost as line_cost,
  o.created_at
from public.orders o
where o.renovation_service_cost is not null and o.renovation_service_cost > 0::numeric
  and public.money_row_visible(o.organization_id)
union all
select
  o.id as order_id,
  o.order_number,
  o.customer_name,
  o.partner_id,
  o.person_id,
  'addon'::text as line_type,
  ao.id::text as item_ref,
  ao.name as item_name,
  ao.description as item_description,
  ao.cost as line_cost,
  ao.created_at
from public.orders o
join public.order_additional_options ao on ao.order_id = o.id
where public.money_row_visible(o.organization_id)
order by 2, 6;

create or replace view public.v_permit_reconciliation as
select
  id as order_id,
  order_number,
  customer_name,
  location,
  permit_cost,
  deposit_date as collected_date,
  permit_transferred_at,
  case
    when permit_transferred_at is not null then 'transferred'::text
    when permit_cost > 0::numeric then 'held'::text
    else 'none'::text
  end as permit_status,
  case
    when permit_transferred_at is null and permit_cost > 0::numeric then permit_cost
    else 0::numeric
  end as amount_still_held
from public.orders o
where permit_cost > 0::numeric
  and public.money_row_visible(o.organization_id)
order by deposit_date desc nulls last;

-- Same columns as today. Money columns and product_config are blank unless the
-- caller is the owner. Membership filter replaces the RLS this view used to inherit.
create or replace view public.v_orders_with_stage as
select
  id,
  customer_name,
  customer_email,
  customer_phone,
  order_type,
  sku,
  material,
  color,
  stone_status,
  permit_status,
  proof_status,
  deposit_date,
  second_payment_date,
  due_date,
  installation_date,
  location,
  (case when public.money_row_visible(organization_id) then value else null end)::numeric(10,2) as value,
  progress,
  assigned_to,
  priority,
  timeline_weeks,
  notes,
  created_at,
  updated_at,
  invoice_id,
  latitude,
  longitude,
  (case when public.money_row_visible(organization_id) then permit_cost else null end)::numeric(10,2) as permit_cost,
  renovation_service_description,
  (case when public.money_row_visible(organization_id) then renovation_service_cost else null end)::numeric(10,2) as renovation_service_cost,
  geocode_status,
  geocode_error,
  geocoded_at,
  geocode_place_id,
  order_number,
  person_id,
  person_name,
  product_photo_url,
  permit_form_id,
  partner_id,
  edit_token,
  case
    when public.money_row_visible(organization_id) then product_config
    else public.strip_money_text(product_config)
  end as product_config,
  status,
  quote_id,
  tracking_token,
  inscription_text,
  inscription_status,
  proof_url,
  proof_uploaded_at,
  proof_notes,
  estimated_completion,
  permit_transferred_at,
  (case when public.money_row_visible(organization_id) then permit_fee else null end)::numeric(10,2) as permit_fee,
  inscription_font,
  inscription_font_other,
  inscription_layout,
  inscription_additional,
  product_id,
  organization_id,
  public.order_stage(stone_status, proof_status, permit_status) as stage
from public.orders
where public.session_is_privileged()
  or public.user_is_member_of_org(organization_id);

-- total_value and the monetary score are blank for non-owners so the band
-- cannot encode the £8,000 bracket. Frequency and recency stay.
create or replace view public.customer_scores as
with base as (
  select
    p.id,
    p.organization_id,
    p.first_name,
    p.last_name,
    count(o.id) as order_count,
    coalesce(sum(o.value), 0::numeric) as total_value,
    max(o.created_at) as last_order_at
  from public.people p
  join public.orders o on o.person_id = p.id and o.is_test = false
  where public.session_is_privileged()
    or public.user_is_member_of_org(p.organization_id)
  group by p.id, p.organization_id, p.first_name, p.last_name
),
c as (
  select
    base.id,
    base.organization_id,
    base.first_name,
    base.last_name,
    base.order_count,
    base.total_value,
    base.last_order_at,
    case
      when public.money_row_visible(base.organization_id) and base.total_value >= 8000::numeric then 40
      when public.money_row_visible(base.organization_id) and base.total_value >= 5000::numeric then 30
      when public.money_row_visible(base.organization_id) and base.total_value >= 3500::numeric then 20
      when public.money_row_visible(base.organization_id) and base.total_value >= 2000::numeric then 10
      when public.money_row_visible(base.organization_id) and base.total_value > 0::numeric then 5
      else 0
    end as pts_monetary,
    case
      when base.order_count >= 3 then 30
      when base.order_count = 2 then 20
      when base.order_count = 1 then 10
      else 0
    end as pts_frequency,
    case
      when base.last_order_at > (now() - '90 days'::interval) then 30
      when base.last_order_at > (now() - '180 days'::interval) then 20
      when base.last_order_at > (now() - '365 days'::interval) then 10
      else 0
    end as pts_recency
  from base
)
select
  id,
  organization_id,
  first_name,
  last_name,
  order_count,
  case when public.money_row_visible(organization_id) then total_value else null end as total_value,
  last_order_at,
  pts_monetary + pts_frequency + pts_recency as score,
  case
    when (pts_monetary + pts_frequency + pts_recency) >= 70 then 'Priority'::text
    when (pts_monetary + pts_frequency + pts_recency) >= 40 then 'Established'::text
    else 'Standard'::text
  end as band,
  jsonb_build_object(
    'monetary', pts_monetary,
    'frequency', pts_frequency,
    'recency', pts_recency,
    'total_value', case when public.money_row_visible(organization_id) then total_value else null end,
    'order_count', order_count
  ) as breakdown
from c;

-- Definer views skip RLS. Turn security_invoker off explicitly (replace can
-- leave the old option in place).
alter view public.order_amounts set (security_invoker = false);
alter view public.quote_amounts set (security_invoker = false);
alter view public.product_prices set (security_invoker = false);
alter view public.option_amounts set (security_invoker = false);
alter view public.order_configs set (security_invoker = false);
alter view public.quote_configs set (security_invoker = false);
alter view public.enquiry_details_safe set (security_invoker = false);
alter view public.order_payment_status set (security_invoker = false);
alter view public.orders_with_balance set (security_invoker = false);
alter view public.orders_with_options_total set (security_invoker = false);
alter view public.invoices_with_breakdown set (security_invoker = false);
alter view public.v_top_products set (security_invoker = false);
alter view public.v_order_line_items set (security_invoker = false);
alter view public.v_permit_reconciliation set (security_invoker = false);
alter view public.v_orders_with_stage set (security_invoker = false);
alter view public.customer_scores set (security_invoker = false);

grant select on
  public.order_amounts,
  public.quote_amounts,
  public.product_prices,
  public.option_amounts,
  public.order_configs,
  public.quote_configs,
  public.enquiry_details_safe,
  public.order_payment_status,
  public.orders_with_balance,
  public.orders_with_options_total,
  public.invoices_with_breakdown,
  public.v_top_products,
  public.v_order_line_items,
  public.v_permit_reconciliation,
  public.v_orders_with_stage,
  public.customer_scores
to authenticated, service_role;

revoke all on
  public.order_amounts,
  public.quote_amounts,
  public.product_prices,
  public.option_amounts,
  public.order_configs,
  public.quote_configs,
  public.enquiry_details_safe,
  public.order_payment_status
from anon;

-- ---------------------------------------------------------------------------
-- Owner-only totals. Same figures the Finance page used to add up in the browser.
-- ---------------------------------------------------------------------------

create or replace function public.finance_totals(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_outstanding numeric := 0;
  v_expected numeric := 0;
  v_collected numeric := 0;
  v_overdue_n integer := 0;
  v_overdue numeric := 0;
  v_month date := date_trunc('month', current_date)::date;
  v_next date := (date_trunc('month', current_date) + interval '1 month')::date;
begin
  if p_org is null or not public.money_row_visible(p_org) then
    raise exception 'Only the owner can view finance totals' using errcode = '42501';
  end if;

  select
    coalesce(sum(b.balance_due), 0),
    coalesce(sum(b.balance_due) filter (
      where b.installation_date >= v_month and b.installation_date < v_next
    ), 0)
  into v_outstanding, v_expected
  from public.orders_with_balance b
  where b.organization_id = p_org;

  select coalesce(sum(p.amount), 0)
  into v_collected
  from public.order_payments p
  where p.organization_id = p_org
    and p.status = 'matched'
    and p.received_at >= v_month::timestamptz;

  select v_collected + coalesce(sum(ip.amount), 0) / 100.0
  into v_collected
  from public.invoice_payments ip
  where ip.organization_id = p_org
    and ip.status = 'paid'
    and ip.created_at >= v_month::timestamptz;

  select
    count(*)::integer,
    coalesce(sum(
      case
        when i.amount_remaining is not null then i.amount_remaining / 100.0
        else coalesce(i.amount, 0)
      end
    ), 0)
  into v_overdue_n, v_overdue
  from public.invoices i
  where i.organization_id = p_org
    and i.deleted_at is null
    and i.status in ('pending', 'overdue')
    and coalesce(i.stripe_invoice_status, '') not in ('void', 'uncollectible')
    and (i.status = 'overdue' or (i.due_date is not null and i.due_date < current_date));

  return jsonb_build_object(
    'outstanding_balance', v_outstanding,
    'collected_this_month', v_collected,
    'expected_this_month', v_expected,
    'overdue_invoices', v_overdue_n,
    'overdue_value', v_overdue
  );
end;
$$;

revoke all on function public.finance_totals(uuid) from public, anon;
grant execute on function public.finance_totals(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record payment: same body, owner wording. The helper above is the check.
-- ---------------------------------------------------------------------------

create or replace function public.record_manual_payment(
  p_order_id uuid,
  p_amount numeric,
  p_received_at date,
  p_source text,
  p_payment_type text,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select o.organization_id into v_org from public.orders o where o.id = p_order_id;
  if v_org is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if not public.user_can_view_org_finance(v_org) then
    raise exception 'Only the owner can record payments' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be more than £0' using errcode = '22023';
  end if;
  if p_source not in ('revolut', 'bank', 'cash') then
    raise exception 'Unknown payment source %', p_source using errcode = '22023';
  end if;
  if p_payment_type not in ('deposit', 'final') then
    raise exception 'Unknown payment type %', p_payment_type using errcode = '22023';
  end if;
  if p_received_at is null or p_received_at > (current_date + 1) then
    raise exception 'Received date is missing or in the future' using errcode = '22023';
  end if;

  insert into public.order_payments (
    organization_id, order_id, user_id, source, external_id, amount, currency, payment_type,
    reference, match_reason, matched_at, matched_by, status, received_at
  ) values (
    v_org, p_order_id, v_uid, p_source, 'manual:' || gen_random_uuid()::text, round(p_amount, 2), 'GBP',
    p_payment_type, nullif(btrim(coalesce(p_reference, '')), ''), 'manual entry (Finance · Record payment)',
    now(), coalesce((select auth.jwt() ->> 'email'), v_uid::text), 'matched',
    (p_received_at::timestamp + time '12:00') at time zone 'Europe/London'
  )
  returning id into v_id;

  if p_payment_type = 'deposit' then
    update public.orders set deposit_date = p_received_at where id = p_order_id and deposit_date is null;
  else
    update public.orders set second_payment_date = p_received_at where id = p_order_id and second_payment_date is null;
  end if;

  return v_id;
end;
$$;
