-- ============================================================
-- Migration: paid_quote_order_type_guard
-- Purpose: when a quote converts to a paid customer (deposit_paid /
--   job confirmed / paid invoice), orders.order_type must be
--   'New Memorial' or 'Renovation' — never left as 'quote'.
-- Evidence (SM org): ORD-245, ORD-267 were quote + deposit_paid +
--   job confirmed; UI subtitle showed "Quote".
-- ============================================================

-- Resolve paid type from renovation evidence (mirrors paidOrderType.ts).
create or replace function public.resolve_paid_customer_order_type(
  p_order_type text,
  p_renovation_description text,
  p_renovation_cost numeric
)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(p_order_type, ''))) in ('renovation') then 'Renovation'
    when nullif(trim(coalesce(p_renovation_description, '')), '') is not null then 'Renovation'
    when coalesce(p_renovation_cost, 0) > 0 then 'Renovation'
    else 'New Memorial'
  end;
$$;

-- True when this order row should no longer be typed as quote.
create or replace function public.order_is_paid_or_converted(p_order public.orders)
returns boolean
language plpgsql
stable
as $$
begin
  if p_order.stage = 'deposit_paid' then
    return true;
  end if;

  if p_order.job_id is not null and exists (
    select 1 from public.jobs j
    where j.id = p_order.job_id
      and (
        j.paid_at is not null
        or j.stage in ('confirmed', 'in_production', 'fixed', 'complete')
      )
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.invoices i
    where i.order_id = p_order.id
      and i.deleted_at is null
      and (
        i.paid_at is not null
        or coalesce(i.amount_paid, 0) > 0
        or i.stripe_status = 'paid'
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- BEFORE insert/update on orders: flip quote → New Memorial/Renovation when paid.
create or replace function public.trg_orders_flip_quote_type_on_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if lower(trim(coalesce(new.order_type, ''))) = 'quote'
     and public.order_is_paid_or_converted(new) then
    new.order_type := public.resolve_paid_customer_order_type(
      new.order_type,
      new.renovation_service_description,
      new.renovation_service_cost
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_flip_quote_type_on_paid on public.orders;
create trigger trg_orders_flip_quote_type_on_paid
before insert or update of order_type, stage, job_id,
  renovation_service_description, renovation_service_cost
on public.orders
for each row
execute function public.trg_orders_flip_quote_type_on_paid();

-- AFTER job moves to after-paid / gets paid_at: flip linked quote orders.
create or replace function public.trg_jobs_flip_linked_quote_order_type()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.paid_at is not null
     or new.stage in ('confirmed', 'in_production', 'fixed', 'complete') then
    update public.orders o
    set order_type = public.resolve_paid_customer_order_type(
      o.order_type,
      o.renovation_service_description,
      o.renovation_service_cost
    )
    where o.job_id = new.id
      and o.archived_at is null
      and lower(trim(coalesce(o.order_type, ''))) = 'quote';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_flip_linked_quote_order_type on public.jobs;
create trigger trg_jobs_flip_linked_quote_order_type
after insert or update of stage, paid_at
on public.jobs
for each row
execute function public.trg_jobs_flip_linked_quote_order_type();

-- AFTER invoice paid: flip linked quote order.
create or replace function public.trg_invoices_flip_linked_quote_order_type()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.order_id is not null
     and new.deleted_at is null
     and (
       new.paid_at is not null
       or coalesce(new.amount_paid, 0) > 0
       or new.stripe_status = 'paid'
     ) then
    update public.orders o
    set order_type = public.resolve_paid_customer_order_type(
      o.order_type,
      o.renovation_service_description,
      o.renovation_service_cost
    )
    where o.id = new.order_id
      and o.archived_at is null
      and lower(trim(coalesce(o.order_type, ''))) = 'quote';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoices_flip_linked_quote_order_type on public.invoices;
create trigger trg_invoices_flip_linked_quote_order_type
after insert or update of order_id, paid_at, amount_paid, stripe_status, deleted_at
on public.invoices
for each row
execute function public.trg_invoices_flip_linked_quote_order_type();

-- Backfill: any live quote that is already paid/converted → New Memorial
-- (or Renovation when renovation fields say so). Covers ORD-245 / ORD-267.
update public.orders o
set order_type = public.resolve_paid_customer_order_type(
  o.order_type,
  o.renovation_service_description,
  o.renovation_service_cost
)
where lower(trim(coalesce(o.order_type, ''))) = 'quote'
  and o.archived_at is null
  and (
    o.stage = 'deposit_paid'
    or (
      o.job_id is not null
      and exists (
        select 1 from public.jobs j
        where j.id = o.job_id
          and (
            j.paid_at is not null
            or j.stage in ('confirmed', 'in_production', 'fixed', 'complete')
          )
      )
    )
    or exists (
      select 1 from public.invoices i
      where i.order_id = o.id
        and i.deleted_at is null
        and (
          i.paid_at is not null
          or coalesce(i.amount_paid, 0) > 0
          or i.stripe_status = 'paid'
        )
    )
  );
