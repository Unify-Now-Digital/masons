-- ============================================================
-- Migration: orders_correct_inverted_names
-- Purpose: BEFORE INSERT/UPDATE guard on public.orders that swaps
--   customer_name and person_name when a writer has used the inverted
--   convention.
--
-- Why: Mason convention (20260106003849, every Mason writer,
--   orderTransform.ts) is customer_name = deceased, person_name = living
--   customer. Orders inserted via direct SQL used the opposite:
--   customer_name = customer, person_name = deceased. Every surface that
--   reads the columns per the Mason convention then shows the names
--   swapped.
--
-- Evidence (SM org): #276 confirmed inserted by direct SQL as the postgres
--   user (Postgres log 2026-10-10, no activity_logs rows). #267/#272/#273
--   match the same signature. Supersedes the T32 handoff note that
--   #272/#276 were Mason-created. On each, customer_name matched the
--   linked people row's first_name || ' ' || last_name and person_name
--   held a different name.
--
-- Detection rule (all must hold, else the row is returned unchanged):
--   - new.person_id is not null
--   - new.person_name is non-empty after trim
--   - lower(trim(new.customer_name)) equals lower(trim(first_name || ' ' ||
--     last_name)) of the linked public.people row in the SAME
--     organization_id
--   - lower(trim(new.person_name)) <> lower(trim(new.customer_name))
--   Equal-name rows (the pre-cutover create_quote shape, T32) are not
--   touched: the last condition excludes them.
--
-- Scope: forward-only. Existing rows are corrected only when a later
--   write touches customer_name, person_name or person_id.
--
-- Security: SECURITY INVOKER, search_path = ''. The people lookup runs
--   under the caller's RLS; a caller that cannot read the people row gets
--   no swap (row unchanged). All relations are schema-qualified;
--   lower/trim/|| resolve from pg_catalog, which is always searched.
--
-- Existing orders triggers, confirmed live via pg_trigger 2026-10-13
--   (5 triggers, as listed); no conflict:
--   BEFORE, fire alphabetically after this one:
--     trg_orders_flip_quote_type_on_paid (order_type only)
--     trg_orders_updated_at, update_orders_updated_at (updated_at only)
--   AFTER, see the corrected NEW:
--     capture_quote_access_token_after_write (fires on edit_token; its
--       inner UPDATE sets edit_token only, so does not re-fire this one)
--     orders_activity_log
--
-- Rollback:
--   drop trigger if exists trg_orders_correct_inverted_names on public.orders;
--   drop function if exists public.orders_correct_inverted_names();
--
-- Apply: Dashboard SQL editor, statement by statement. Read back with
--   position(e'\r' in pg_get_functiondef(...)) (expect 0) and pg_trigger.
--
-- Applied 2026-10-13 (Dashboard, 3 statements). pg_trigger read-back:
--   6 triggers incl. trg_orders_correct_inverted_names. Existing rows
--   corrected via no-op touch (set person_id = person_id), SM org,
--   order_number 267, 272, 273, 276: 4 rows returned; read-back 4/4
--   person_name = linked person, customer_name != linked person.
-- ============================================================

create or replace function public.orders_correct_inverted_names()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_full_name text;
  v_swap text;
begin
  if new.person_id is null
     or nullif(trim(new.person_name), '') is null then
    return new;
  end if;

  select trim(p.first_name || ' ' || p.last_name)
    into v_person_full_name
  from public.people p
  where p.id = new.person_id
    and p.organization_id = new.organization_id;

  if v_person_full_name is not null
     and lower(trim(new.customer_name)) = lower(v_person_full_name)
     and lower(trim(new.person_name)) <> lower(trim(new.customer_name)) then
    v_swap := new.customer_name;
    new.customer_name := new.person_name;
    new.person_name := v_swap;
    raise notice 'orders_correct_inverted_names: swapped customer_name/person_name on order % (order_number %)',
      new.id, new.order_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_correct_inverted_names on public.orders;

create trigger trg_orders_correct_inverted_names
before insert or update of customer_name, person_name, person_id
on public.orders
for each row
execute function public.orders_correct_inverted_names();
