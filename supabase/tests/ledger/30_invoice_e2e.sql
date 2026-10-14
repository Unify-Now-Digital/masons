-- End-to-end on the LOCAL DB: create (browser, RLS) → send (stubbed: the edge function's
-- DB writes, done as service_role; no email or Stripe call) → pay (Revolut + Stripe ingest) → paid.
set search_path = public, extensions;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok - %', msg; end $$;

-- 1. create, as a finance user through RLS, in pence
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
insert into invoices (id, order_id, invoice_number, customer_name, total_pence, due_date, organization_id, invoice_type, status)
values ('eeeeeeee-0000-0000-0000-00000000e2e1', 'dddddddd-0000-0000-0000-000000000124', 'INV-000777', 'Jane Doyle', 125050, current_date + 14,
        'aaaaaaaa-0000-0000-0000-000000000001', 'balance', 'draft'),
       ('eeeeeeee-0000-0000-0000-00000000e2e2', 'dddddddd-0000-0000-0000-000000000124', 'INV-000778', 'Jane Doyle', 30000, current_date + 14,
        'aaaaaaaa-0000-0000-0000-000000000001', 'deposit', 'draft');
select pg_temp.ok((select amount from invoices where id = 'eeeeeeee-0000-0000-0000-00000000e2e1') = 1250.50, 'create: total_pence 125050 keeps legacy amount £1250.50 in sync');
reset role;

-- 2. send (stub): what the send edge function writes; no real email / Stripe
set role service_role;
update invoices set status = 'pending', stripe_invoice_id = 'in_e2e_2', stripe_payment_intent_id = 'pi_e2e_2',
  hosted_invoice_url = 'https://example.test/i/e2e2' where id = 'eeeeeeee-0000-0000-0000-00000000e2e2';
update invoices set status = 'pending' where id = 'eeeeeeee-0000-0000-0000-00000000e2e1';
select pg_temp.ok((select count(*) from invoices where id::text like 'eeeeeeee-0000-0000-0000-00000000e2e%' and status = 'pending') = 2, 'send (stubbed): both invoices pending');

-- 3a. pay by Revolut bank transfer quoting the invoice number → auto-confirmed, invoice paid
select public.ledger_ingest_payment(jsonb_build_object('organization_id', 'aaaaaaaa-0000-0000-0000-000000000001',
  'source', 'revolut', 'external_id', 'rev_e2e_1', 'gross_pence', 125050, 'received_at', now(),
  'payer_name', 'JANE DOYLE', 'reference', 'inv 777 memorial'));
-- 3b. pay the deposit by Stripe (linked by payment intent), with a fee
select public.ledger_ingest_payment(jsonb_build_object('organization_id', 'aaaaaaaa-0000-0000-0000-000000000001',
  'source', 'stripe', 'external_id', 'ch_e2e_2', 'gross_pence', 30000, 'fee_pence', 455, 'received_at', now(),
  'stripe_payment_intent_id', 'pi_e2e_2', 'stripe_invoice_id', 'in_e2e_2', 'payer_name', 'Jane Doyle'));
reset role;
select pg_temp.ok((select status = 'paid' and amount_paid = 125050 and amount_remaining = 0 and paid_at is not null
  from invoices where id = 'eeeeeeee-0000-0000-0000-00000000e2e1'), 'pay: Revolut payment quoting INV-000777 marks the invoice paid');
select pg_temp.ok((select status = 'paid' from invoices where id = 'eeeeeeee-0000-0000-0000-00000000e2e2'), 'pay: Stripe-linked deposit marks its own deposit invoice paid');
select pg_temp.ok((select fee_pence = 455 and net_pence = 29545 from payments where external_id = 'ch_e2e_2'), 'Stripe fee kept separately from gross');
select pg_temp.ok((select paid_pence = 30000 and remaining_pence = 0 from invoice_balances where invoice_id = 'eeeeeeee-0000-0000-0000-00000000e2e2'), 'invoice_balances derives paid/remaining from allocations');

-- Revolut pending → completed via state-change event
set role service_role;
select public.ledger_ingest_payment(jsonb_build_object('organization_id', 'aaaaaaaa-0000-0000-0000-000000000001',
  'source', 'revolut', 'external_id', 'rev_e2e_p', 'state', 'pending', 'gross_pence', 100, 'received_at', now(), 'reference', 'x'));
select public.ledger_set_state('aaaaaaaa-0000-0000-0000-000000000001', 'revolut', 'rev_e2e_p', 'completed');
reset role;
select pg_temp.ok((select match_status::text <> 'pending' from payments where external_id = 'rev_e2e_p'), 'Revolut state change: pending → completed leaves the waiting group');
