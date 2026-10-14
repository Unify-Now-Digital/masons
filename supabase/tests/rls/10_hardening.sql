-- RLS hardening tests (20261014130000..130500). Runs after the ledger tests' seed + backfill.
set search_path = public, extensions;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, false); perform set_config('request.jwt.claim.role', 'authenticated', false); set role authenticated; end $$;
create or replace function pg_temp.denied(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when insufficient_privilege then return true; end $$;

-- fixtures (service role / owner)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a3', 'member@a.test');
insert into organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'member');
insert into organizations (id, name) values ('3770972d-1bbd-417b-b413-297e844db285', 'Sears Melvin');
insert into organization_stripe_config (organization_id, test_publishable_key, test_secret_key_encrypted)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'pk_test_x', '\x01');
insert into cemeteries (id, slug, name, area, organization_id, is_active) values
  ('11111111-0000-0000-0000-00000000000a', 'a-cem', 'A Cemetery', 'X', 'aaaaaaaa-0000-0000-0000-000000000001', true),
  ('11111111-0000-0000-0000-00000000000b', 'b-cem', 'B Cemetery', 'X', 'bbbbbbbb-0000-0000-0000-000000000001', true),
  ('11111111-0000-0000-0000-00000000005a', 'sm-cem', 'SM Cemetery', 'X', '3770972d-1bbd-417b-b413-297e844db285', true);
insert into cemetery_pricing (cemetery_id, memorial_type, permit_fee) values ('11111111-0000-0000-0000-00000000000b', 'headstone', 99);
insert into order_events (order_id, event_type, summary) values ('dddddddd-0000-0000-0000-000000000123', 'note', 'x');

-- 1. Stripe config
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select test_publishable_key from organization_stripe_config) = 'pk_test_x', 'admin reads Stripe publishable key');
select pg_temp.ok(pg_temp.denied('select test_secret_key_encrypted from organization_stripe_config'), 'admin cannot read encrypted Stripe secret from the browser');
select pg_temp.ok(pg_temp.denied('select * from organization_stripe_config'), 'select * on Stripe config denied (secret columns)');
select pg_temp.ok(pg_temp.denied($$update organization_stripe_config set live_payments_enabled = true$$), 'browser cannot update Stripe config');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ok((select count(*) from organization_stripe_config) = 0, 'member (non-admin) sees no Stripe config row');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ok((select count(*) from organization_stripe_config) = 0, 'staff sees no Stripe config row');
reset role;
set role anon;
select pg_temp.ok(pg_temp.denied('select organization_id from organization_stripe_config'), 'anon has no Stripe config access');
reset role;

-- 2. Finance roles
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ok((select count(*) from invoices) = 0 and (select count(*) from invoice_payments) = 0
  and (select count(*) from order_payments) = 0 and (select count(*) from invoice_line_items) = 0, 'staff sees no invoices / payments / line items');
select pg_temp.ok((select count(*) from orders) > 0, 'staff still reads orders (normal flow)');
select pg_temp.ok((select count(*) from cemeteries) = 1, 'staff reads own org cemeteries');
do $$ begin
  insert into invoices (order_id, invoice_number, customer_name, amount, status, due_date, issue_date, organization_id)
    values ('dddddddd-0000-0000-0000-000000000123', 'INV-S', 'x', 1, 'draft', now(), now(), 'aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'FAIL: staff inserted invoice';
exception when insufficient_privilege then raise notice 'ok - staff cannot create invoices'; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ok((select count(*) from invoices) > 0, 'member (finance role) reads invoices');
insert into invoices (order_id, invoice_number, customer_name, amount, status, due_date, issue_date, organization_id)
  values ('dddddddd-0000-0000-0000-000000000123', 'INV-M', 'x', 1, 'draft', now(), now(), 'aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.ok(true, 'member creates a draft invoice (Invoicing UI flow)');
update invoices set customer_name = 'y' where invoice_number = 'INV-M';
select pg_temp.ok((select customer_name from invoices where invoice_number = 'INV-M') = 'y', 'member edits a draft invoice');
select pg_temp.ok((select count(*) from orders_with_balance) > 0, 'member reads orders_with_balance view');
select pg_temp.ok((select count(*) from order_payments) > 0, 'member reads legacy order_payments (Finance page)');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select count(*) from invoice_payments) > 0, 'admin reads legacy invoice_payments');
select pg_temp.ok(pg_temp.denied($$update invoice_payments set amount = 0$$), 'admin cannot edit invoice_payments from browser');
select pg_temp.ok(pg_temp.denied($$delete from order_payments$$), 'admin cannot delete order_payments from browser');
select pg_temp.ok(pg_temp.denied($$select 1 from payments$$), 'legacy 2025 public.payments closed to browser (standalone, no ledger)');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select count(*) from invoices where organization_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'org B admin cannot read org A invoices');
reset role;

-- 3. anon
set role anon;
select pg_temp.ok(pg_temp.denied('select 1 from orders'), 'anon: orders denied');
select pg_temp.ok(pg_temp.denied('select 1 from invoices'), 'anon: invoices denied');
select pg_temp.ok(pg_temp.denied('select 1 from people'), 'anon: people denied');
select pg_temp.ok(pg_temp.denied('select 1 from orders_with_balance'), 'anon: views denied');
select pg_temp.ok(not pg_temp.denied('select 1 from products, product_categories, stone_colours, product_addons, product_sizes limit 1'), 'anon: public catalogue still readable (SM site)');
select pg_temp.ok((select count(*) from cemeteries) = 1 and (select name from cemeteries) = 'SM Cemetery', 'anon: only Sears Melvin active cemeteries');
select pg_temp.ok(pg_temp.denied('select 1 from cemetery_pricing'), 'anon: cemetery pricing denied');
reset role;
select pg_temp.ok((select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and p.polroles = '{0}'::oid[]
                     and c.relname not in ('products','product_categories','stone_colours','product_addons','product_sizes')) = 0,
                  'no business-table policy targets PUBLIC');

-- 4. formerly policy-less tables
select pg_temp.ok((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
                     and not exists (select 1 from pg_policy p where p.polrelid = c.oid)) = 0, 'every RLS table has at least one policy');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ok((select count(*) from order_events) = 1, 'staff reads own org order_events');
select pg_temp.ok(pg_temp.denied('select 1 from customer_portal_tokens'), 'tokens table closed to browser');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select count(*) from order_events) = 0, 'org B cannot read org A order_events');

-- 5. cemeteries per org
select pg_temp.ok((select count(*) from cemeteries) = 1 and (select name from cemeteries) = 'B Cemetery', 'org B sees only its cemetery');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select count(*) from cemeteries where organization_id <> 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'org A cannot see other orgs cemeteries');
select pg_temp.ok((select count(*) from cemetery_pricing) = 0, 'org A cannot see org B cemetery pricing');
reset role;

-- standalone: reconciliation match stays for admin/member, not staff
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok(not pg_temp.denied($$update order_payments set match_reason = match_reason$$), 'admin can match order_payments (reconciliation)');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ declare n int; begin update order_payments set match_reason = match_reason; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'staff cannot match order_payments'); end $$;
reset role;
