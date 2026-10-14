-- Ledger behaviour after backfill + freeze. Each block states the acceptance criterion it covers.
set search_path = public, extensions;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, false); perform set_config('request.jwt.claim.role', 'authenticated', false); set role authenticated; end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', false); perform set_config('request.jwt.claim.role', 'service_role', false); set role service_role; end $$;
create or replace function pg_temp.ingest(j jsonb) returns jsonb language plpgsql as $$
declare r jsonb; begin perform pg_temp.as_service(); r := public.ledger_ingest_payment(j); reset role; return r; end $$;
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set ADMIN '''00000000-0000-0000-0000-0000000000a1'''

-- Backfill ------------------------------------------------------------------------------
select pg_temp.ok((select count(*) from payments where legacy_table is not null and legacy_table <> 'invoices'
                   and organization_id = :A and kind = 'payment') = 3,
  '#2 backfill: Stripe deposit in both legacy tables lands once (3 rows: Stripe, Revolut matched, Revolut unmatched)');
select pg_temp.ok((select count(*) from payments where stripe_payment_intent_id = 'pi_dep1' or external_id in ('ch_dep1','pi_dep1')) = 1,
  '#2 the £500 Stripe deposit exists exactly once');
select pg_temp.ok((select paid_pence from invoice_balances where invoice_id = 'eeeeeeee-0000-0000-0000-000000000001') = 50000,
  '#5 deposit invoice paid = sum of allocations (50000p)');
select pg_temp.ok((select count(*) from payments where legacy_table = 'invoice_payments' and gross_pence = 777) = 0,
  'backfill skips non-paid legacy rows (status duplicate)');
select pg_temp.ok((select status from invoices where id = 'eeeeeeee-0000-0000-0000-000000000003') = 'paid'
  and exists (select 1 from payments where external_id = 'legacy-paid-invoice:eeeeeeee-0000-0000-0000-000000000003' and gross_pence = 49999),
  'invoice marked paid with no payment row stays paid via a labelled manual ledger row (49999p)');
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_tx_2') = 'suggested'
  and (select count(*) from payment_match_suggestions s join payments p on p.id = s.payment_id where p.external_id = 'rev_tx_2') = 2
  and not exists (select 1 from payment_allocations a join payments p on p.id = a.payment_id where p.external_id = 'rev_tx_2'),
  '#4 legacy "OR-123" finds order 123; it has 2 open invoices, so a person picks (2 suggestions, no allocation)');
select pg_temp.ok(exists (select 1 from ledger_backfill_snapshot), 'snapshot of old cached amounts kept for audit/rollback');

-- Frozen legacy tables ----------------------------------------------------------------------
do $$ begin
  begin insert into order_payments (organization_id, source, external_id, amount, status, received_at)
        values ('aaaaaaaa-0000-0000-0000-000000000001', 'revolut', 'x', 1, 'unmatched', now());
        raise exception 'FAIL: frozen order_payments accepted an insert';
  exception when insufficient_privilege then raise notice 'ok - order_payments frozen'; end;
  begin update invoice_payments set amount = 1;
        raise exception 'FAIL: frozen invoice_payments accepted an update';
  exception when insufficient_privilege then raise notice 'ok - invoice_payments frozen'; end;
end $$;

-- Idempotent ingestion (#1) -------------------------------------------------------------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'stripe', 'external_id', 'ch_new1', 'gross_pence', 75000,
  'fee_pence', 1150, 'received_at', '2026-10-10T10:00:00Z', 'payer_name', 'Jane Doyle', 'stripe_payment_intent_id', 'pi_new1',
  'stripe_invoice_id', 'in_dep1', 'method', 'card', 'raw', '{"id":"evt_1"}')) from generate_series(1, 5);
select pg_temp.ok((select count(*) from payments where external_id = 'ch_new1') = 1, '#1 replaying a Stripe event 5x leaves one row');
select pg_temp.ok((select match_status::text from payments where external_id = 'ch_new1') = 'matched', 'Stripe-linked payment auto-matches (decision 3)');
select pg_temp.ok((select status from invoices where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'paid'
  and (select amount_paid from invoices where id = 'eeeeeeee-0000-0000-0000-000000000001') = 125000,
  'invoice cache (amount_paid, status) derived from allocations');
select pg_temp.ok((select net_pence from payments where external_id = 'ch_new1') = 73850, '#5/decision 5 gross 75000 − fee 1150 = net 73850');
do $$ begin
  begin
    perform public.ledger_ingest_payment(jsonb_build_object('organization_id', 'aaaaaaaa-0000-0000-0000-000000000001', 'source', 'stripe',
      'external_id', 'ch_other', 'gross_pence', 75000, 'stripe_payment_intent_id', 'pi_new1', 'received_at', now()));
    raise exception 'FAIL: same payment intent under a new charge id was accepted';
  exception when unique_violation then raise notice 'ok - one payment intent = one ledger row (invoice.paid + checkout paths collapse)';
  end;
end $$;

-- Reference formats (#4) -------------------------------------------------------------------
select pg_temp.ok(public.ledger_reference_order_numbers('OR-123') = '{123}' and public.ledger_reference_order_numbers('ORD-000123') = '{123}'
  and public.ledger_reference_order_numbers('123') = '{123}' and public.ledger_reference_order_numbers('order 123') = '{123}'
  and public.ledger_reference_order_numbers('Payment ord#123 thanks') = '{123}',
  '#4 OR-123, ORD-000123, 123, "order 123" all normalise to 123');
select pg_temp.ok(public.ledger_reference_order_numbers('rent 2026 sort 40-11-22') = '{}' and public.ledger_reference_order_numbers('£500') = '{}',
  'bare numbers inside other text are not treated as order numbers');
select pg_temp.ok(public.ledger_normalize_reference('or-123 inv 101') = 'ORD-000123 INV-000101', 'normalised reference uses ORD-000123 / INV-000101');

-- Revolut with ORD-000124 reference marks the right invoice paid (Revolut pays invoices) --------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_tx_3', 'gross_pence', 50001,
  'received_at', '2026-10-11T08:00:00Z', 'payer_name', 'T HART', 'reference', 'ORD-000124', 'method', 'bank_transfer'));
select pg_temp.ok((select status from invoices where id = 'eeeeeeee-0000-0000-0000-000000000004') = 'paid', 'Revolut payment with ORD-000124 marks INV-000104 paid');

-- Amount + name only → suggestion, never auto (decision 3) ------------------------------------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_tx_4', 'gross_pence', 125000,
  'received_at', '2026-10-12T08:00:00Z', 'payer_name', 'JANE DOYLE', 'reference', 'memorial balance', 'method', 'bank_transfer'));
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_tx_4') = 'suggested'
  and not exists (select 1 from payment_allocations a join payments p on p.id = a.payment_id where p.external_id = 'rev_tx_4')
  and (select score from payment_match_suggestions s join payments p on p.id = s.payment_id where p.external_id = 'rev_tx_4' order by score desc limit 1) >= 70,
  'decision 3: amount + payer surname = suggestion with score, no allocation');
select pg_temp.ok(not exists (select 1 from payment_match_suggestions s join payments p on p.id = s.payment_id
   join people pe on pe.last_name = 'Smith' where p.external_id = 'rev_tx_4'), '#3 suggestions use the customer person (Doyle), never the deceased (Smith)');

-- Finance user confirms the suggestion (audited) --------------------------------------------
select pg_temp.as_user(:ADMIN);
select public.ledger_confirm_suggestion((select id from payments where external_id = 'rev_tx_4'), 'eeeeeeee-0000-0000-0000-000000000002');
reset role;
select pg_temp.ok((select status from invoices where id = 'eeeeeeee-0000-0000-0000-000000000002') = 'paid', 'confirmed suggestion pays INV-000102');
select pg_temp.ok(exists (select 1 from payment_audit_log l join payments p on p.id = l.payment_id where p.external_id = 'rev_tx_4'
   and l.action = 'allocation_added' and l.actor_user_id = :ADMIN), 'audit log records who allocated (actor_user_id) and when');

-- Order named but no invoice yet (decision 4) ------------------------------------------------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_tx_5', 'gross_pence', 45000,
  'received_at', '2026-10-12T09:00:00Z', 'payer_name', 'Tom Hart', 'reference', 'OR-125 deposit'));
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_tx_5') = 'suggested'
  and (select match_reason from payments where external_id = 'rev_tx_5') = 'Order has no open invoice',
  'decision 4: deposit for an order with no invoice waits for its own invoice (suggested, not parked on the order)');

-- Split £1,000 across two invoices (#5) ---------------------------------------------------------
insert into invoices (id, order_id, person_id, invoice_number, customer_name, amount, status, due_date, organization_id)
values ('eeeeeeee-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000125', 'cccccccc-0000-0000-0000-000000000002', 'INV-000105', 'Tom Hart', 600, 'pending', '2026-11-01', :A),
       ('eeeeeeee-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-000000000125', 'cccccccc-0000-0000-0000-000000000002', 'INV-000106', 'Tom Hart', 700, 'pending', '2026-11-01', :A);
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_tx_6', 'gross_pence', 100000,
  'received_at', '2026-10-13T09:00:00Z', 'payer_name', 'Someone Else', 'reference', 'x', 'raw', '{"counterparty":{"name":"Someone Else"}}'::jsonb));
select pg_temp.as_user(:ADMIN);
select public.ledger_allocate((select id from payments where external_id = 'rev_tx_6'),
  '[{"invoice_id":"eeeeeeee-0000-0000-0000-000000000005","amount_pence":60000},{"invoice_id":"eeeeeeee-0000-0000-0000-000000000006","amount_pence":40000}]');
reset role;
select pg_temp.ok((select remaining_pence from invoice_balances where invoice_id = 'eeeeeeee-0000-0000-0000-000000000005') = 0
  and (select remaining_pence from invoice_balances where invoice_id = 'eeeeeeee-0000-0000-0000-000000000006') = 30000,
  '#5 £1,000 split £600/£400 updates both invoices');
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  begin
    perform public.ledger_allocate((select id from payments where external_id = 'rev_tx_6'),
      '[{"invoice_id":"eeeeeeee-0000-0000-0000-000000000006","amount_pence":1,"allocation_type":"extra"}]');
    set constraints all immediate;
    raise exception 'FAIL: over-allocation accepted';
  exception when check_violation then raise notice 'ok - allocations can never exceed the payment';
  end;
  reset role;
end $$;

-- Refund (#6) --------------------------------------------------------------------------------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'stripe', 'external_id', 're_1', 'kind', 'refund',
  'parent_external_id', 'ch_new1', 'gross_pence', -25000, 'received_at', '2026-10-13T12:00:00Z'));
select pg_temp.ok((select parent_payment_id from payments where external_id = 're_1') = (select id from payments where external_id = 'ch_new1')
  and (select remaining_pence from invoice_balances where invoice_id = 'eeeeeeee-0000-0000-0000-000000000001') = 25000
  and (select status from invoices where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'pending',
  '#6 refund is a negative row linked to its parent; invoice remaining goes back up and it is no longer paid');

-- Permit pass-through & totals (#7, decision 5) ------------------------------------------------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_permit', 'gross_pence', 15000,
  'received_at', '2026-10-13T13:00:00Z', 'payer_name', 'Tom Hart', 'reference', 'permit fee'));
select pg_temp.as_user(:ADMIN);
select public.ledger_allocate((select id from payments where external_id = 'rev_permit'),
  '[{"invoice_id":"eeeeeeee-0000-0000-0000-000000000006","amount_pence":15000,"allocation_type":"permit"}]');
select pg_temp.ok((select is_pass_through from payments where external_id = 'rev_permit'), 'permit allocation marks the payment pass-through');
select pg_temp.ok((select pass_through_pence from public.ledger_totals(:A, '2026-10-13', '2026-10-13')) = 15000
  and (select received_pence from public.ledger_totals(:A, '2026-10-13', '2026-10-13')) = 100000 - 25000 + 15000
  and (select revenue_pence from public.ledger_totals(:A, '2026-10-13', '2026-10-13')) = 100000 - 25000,
  '#7 permit pass-through counted in cash, excluded from revenue');
reset role;

-- Stripe payout landing in Revolut (#9) -------------------------------------------------------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_payout', 'gross_pence', 123456,
  'received_at', '2026-10-13T14:00:00Z', 'payer_name', 'STRIPE PAYMENTS UK LTD', 'reference', 'STRIPE'));
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_payout') = 'ignored'
  and (select match_reason from payments where external_id = 'rev_payout') = 'stripe_payout', '#9 Stripe payout in Revolut is ignored');

-- Pending → completed, reverted ------------------------------------------------------------
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_pend', 'gross_pence', 999,
  'received_at', '2026-10-13T15:00:00Z', 'state', 'pending'));
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_pend') = 'pending', 'Revolut pending = Waiting');
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_pend', 'gross_pence', 999,
  'received_at', '2026-10-13T15:00:00Z', 'state', 'reverted'));
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_pend') = 'ignored', 'reverted bank transaction is ignored');

-- Undo is audited and re-queues ------------------------------------------------------------
select pg_temp.as_user(:ADMIN);
select public.ledger_unmatch((select id from payments where external_id = 'rev_tx_3'), 'wrong customer');
reset role;
select pg_temp.ok((select status from invoices where id = 'eeeeeeee-0000-0000-0000-000000000004') = 'pending'
  and (select match_status::text from payments where external_id = 'rev_tx_3') = 'suggested'
  and exists (select 1 from payment_audit_log l join payments p on p.id = l.payment_id where p.external_id = 'rev_tx_3' and l.action = 'allocation_removed' and l.actor_user_id = :ADMIN),
  'undo removes the allocation (audited), invoice reopens, exact match comes back as a suggestion only');

-- Immutability / insert-only ----------------------------------------------------------------
do $$ begin
  begin update public.payments set gross_pence = 1 where external_id = 'ch_new1';
        raise exception 'FAIL: amount edited';
  exception when insufficient_privilege then raise notice 'ok - ledger amounts are immutable'; end;
  begin update public.payment_audit_log set action = 'x';
        raise exception 'FAIL: audit log edited';
  exception when insufficient_privilege then raise notice 'ok - audit log is append-only'; end;
end $$;

-- Invoice amount pence sync (expand) -------------------------------------------------------
update invoices set amount = 333.33 where id = 'eeeeeeee-0000-0000-0000-000000000006';
select pg_temp.ok((select total_pence from invoices where id = 'eeeeeeee-0000-0000-0000-000000000006') = 33333, 'writing amount (pounds) updates total_pence');
update invoices set total_pence = 70000 where id = 'eeeeeeee-0000-0000-0000-000000000006';
select pg_temp.ok((select amount from invoices where id = 'eeeeeeee-0000-0000-0000-000000000006') = 700.00, 'writing total_pence updates amount (pounds)');

-- Raw payload retention ---------------------------------------------------------------------
update payments set created_at = now() - interval '200 days' where external_id = 'ch_new1';
select public.ledger_purge_raw(180) as purged \gset
select pg_temp.ok(:purged >= 1 and (select raw is null and raw_purged_at is not null from payments where external_id = 'ch_new1'), 'raw payloads purged after 180 days');
