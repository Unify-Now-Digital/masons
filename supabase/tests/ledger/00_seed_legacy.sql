-- Seed legacy (pre-ledger) data. Runs after migration 1, before migration 2 (backfill).
set search_path = public, extensions;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok - %', msg; end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@a.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'staff@a.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'admin@b.test');
insert into organizations (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Org A'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Org B');
insert into organization_members (organization_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'staff'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'admin');
insert into people (id, first_name, last_name, organization_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'Jane', 'Doyle', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000002', 'Tom', 'Hart', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000003', 'Bea', 'Moss', 'bbbbbbbb-0000-0000-0000-000000000001');
-- Order 123: customer Jane Doyle, memorial for "Arthur Smith" (the deceased, in customer_name).
insert into orders (id, customer_name, person_id, person_name, order_number, organization_id, value, order_type) select v.*, 'New Memorial' from (values
  ('dddddddd-0000-0000-0000-000000000123'::uuid, 'Arthur Smith', 'cccccccc-0000-0000-0000-000000000001'::uuid, 'Jane Doyle', 123, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 2500),
  ('dddddddd-0000-0000-0000-000000000124', 'Mary Hart', 'cccccccc-0000-0000-0000-000000000002', 'Tom Hart', 124, 'aaaaaaaa-0000-0000-0000-000000000001', 1000),
  ('dddddddd-0000-0000-0000-000000000125', 'No Invoice Yet', 'cccccccc-0000-0000-0000-000000000002', 'Tom Hart', 125, 'aaaaaaaa-0000-0000-0000-000000000001', 900),
  ('dddddddd-0000-0000-0000-000000000901', 'B order', 'cccccccc-0000-0000-0000-000000000003', 'Bea Moss', 901, 'bbbbbbbb-0000-0000-0000-000000000001', 100)) v(id, customer_name, person_id, person_name, order_number, organization_id, value);
-- Invoices: amount in pounds (legacy); some with fractional pence.
insert into invoices (id, order_id, person_id, invoice_number, customer_name, amount, status, due_date, issue_date, organization_id, invoice_type,
                      amount_paid, amount_remaining, stripe_invoice_id, stripe_payment_intent_id, intended_deposit_pence, paid_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000123', 'cccccccc-0000-0000-0000-000000000001', 'INV-000101', 'Jane Doyle', 1250.00, 'pending', '2026-10-30', '2026-10-01', 'aaaaaaaa-0000-0000-0000-000000000001', 'deposit', 50000, 75000, 'in_dep1', 'pi_dep1', 125000, null),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000123', 'cccccccc-0000-0000-0000-000000000001', 'INV-000102', 'Jane Doyle', 1250.00, 'pending', '2026-11-30', '2026-10-02', 'aaaaaaaa-0000-0000-0000-000000000001', 'balance', 0, 125000, null, null, null, null),
  ('eeeeeeee-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000124', 'cccccccc-0000-0000-0000-000000000002', 'INV-000103', 'Tom Hart', 499.99, 'paid', '2026-09-30', '2026-09-01', 'aaaaaaaa-0000-0000-0000-000000000001', null, 0, 0, null, null, null, '2026-09-10T10:00:00Z'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000124', 'cccccccc-0000-0000-0000-000000000002', 'INV-000104', 'Tom Hart', 500.01, 'pending', '2026-10-30', '2026-10-05', 'aaaaaaaa-0000-0000-0000-000000000001', null, 0, 50001, null, null, null, null),
  ('eeeeeeee-0000-0000-0000-000000000901', 'dddddddd-0000-0000-0000-000000000901', 'cccccccc-0000-0000-0000-000000000003', 'INV-000901', 'Bea Moss', 100.00, 'pending', '2026-10-30', '2026-10-05', 'bbbbbbbb-0000-0000-0000-000000000001', null, 0, 10000, null, null, null, null);

-- Legacy payments: one Stripe deposit £500 recorded in BOTH tables (the double count),
-- one Revolut £200 order payment matched to order 124, one unmatched Revolut row with ref "OR-123".
insert into invoice_payments (id, invoice_id, stripe_invoice_id, stripe_payment_intent_id, stripe_charge_id, amount, status, organization_id, created_at, source, stripe_invoice_payment_id)
values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'in_dep1', 'pi_dep1', 'ch_dep1', 50000, 'paid', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-03T09:00:00Z', 'stripe', 'inpay_1'),
       ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'in_dep1', null, null, 777, 'duplicate', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-03T09:00:00Z', 'migration', null);
insert into order_payments (id, order_id, organization_id, source, external_id, amount, payment_type, reference, status, matched_by, matched_at, received_at) values
  ('99999999-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000123', 'aaaaaaaa-0000-0000-0000-000000000001', 'stripe', 'pi_dep1', 500.00, 'deposit', null, 'matched', 'auto', '2026-10-03T09:01:00Z', '2026-10-03T09:00:00Z'),
  ('99999999-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000124', 'aaaaaaaa-0000-0000-0000-000000000001', 'revolut', 'rev_tx_1', 200.00, 'deposit', 'HART MEMORIAL', 'matched', 'Arin', '2026-10-06T10:00:00Z', '2026-10-06T09:00:00Z'),
  ('99999999-0000-0000-0000-000000000003', null, 'aaaaaaaa-0000-0000-0000-000000000001', 'revolut', 'rev_tx_2', 100.00, null, 'OR-123', 'unmatched', null, null, '2026-10-07T09:00:00Z');

select pg_temp.ok((select count(*) from invoices where total_pence is not null) = 5, 'expand: total_pence backfilled on insert for every invoice');
select pg_temp.ok((select total_pence from invoices where id = 'eeeeeeee-0000-0000-0000-000000000004') = 50001, 'expand: £500.01 → 50001p (no float drift)');
