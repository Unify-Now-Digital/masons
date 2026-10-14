-- Arin's decisions on PR #35 (1, 2, 3, 5, 7). Runs after backfill + freeze.
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

-- 1. Stripe is the source of truth for the mismatched invoice; flagged in the audit log.
select pg_temp.ok((select total_pence from invoices where invoice_number = 'INV-000073') = 185500
  and (select amount from invoices where invoice_number = 'INV-000073') = 1855.00, 'decision 1: INV-000073 total taken from Stripe (£1,855)');
select pg_temp.ok((select status from invoices where invoice_number = 'INV-000073') = 'paid'
  and (select remaining_pence from invoice_balances b join invoices i on i.id = b.invoice_id where i.invoice_number = 'INV-000073') = 0,
  'decision 1: INV-000073 stays paid, nothing remaining');
select pg_temp.ok(exists (select 1 from payment_audit_log where action = 'invoice_total_from_stripe' and after->>'invoice_number' = 'INV-000073'
  and (before->>'total_pence')::bigint = 0 and (after->>'total_pence')::bigint = 185500), 'decision 1: override recorded in payment_audit_log');
select pg_temp.ok((select total_pence from invoices where invoice_number = 'INV-000133') = 120000
  and not exists (select 1 from payment_audit_log where after->>'invoice_number' = 'INV-000133'), 'decision 1: other Stripe/Mason differences (INV-000133) untouched');
select pg_temp.ok(not exists (select 1 from payments where external_id = 'legacy-paid-invoice:eeeeeeee-0000-0000-0000-000000000073'),
  'decision 1: no stand-in row needed once the Stripe total is used');

-- 2. Labelled stand-in payments for paid invoices with no payment row.
select pg_temp.ok((select count(*) from payments where matched_by = 'backfill:stand-in' and needs_review
  and match_reason like 'Stand-in payment:%' and payer_name = 'Stand-in (no payment recorded)') = 1, 'decision 2: stand-in row is labelled and flagged for review');
select pg_temp.ok((select source::text from payments where matched_by = 'backfill:stand-in') = 'manual', 'decision 2: stand-in is a manual-source row (not Stripe/Revolut)');

-- 3. Revolut: table exists, flag off, nothing scheduled.
select pg_temp.ok(to_regclass('public.revolut_connections') is not null, 'decision 3: revolut_connections exists');
select pg_temp.ok(public.feature_enabled('revolut_ledger') = false, 'decision 3: revolut_ledger flag is off');
select pg_temp.ok(not exists (select 1 from cron.job where command ilike '%revolut%'), 'decision 3: no Revolut job scheduled');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin perform access_token from public.revolut_connections; raise exception 'FAIL: token readable';
  exception when insufficient_privilege then raise notice 'ok - decision 3: Revolut tokens not readable from the browser'; end;
  begin perform public.feature_enabled('revolut_ledger'); raise exception 'FAIL: flag fn callable';
  exception when insufficient_privilege then raise notice 'ok - decision 3: flag lookup is service-role only'; end;
end $$;
reset role;

-- 5. No score-based auto-match: a 100-score single candidate is still only a suggestion.
insert into invoices (id, order_id, person_id, invoice_number, customer_name, amount, status, due_date, issue_date, organization_id, invoice_type, intended_deposit_pence)
values ('eeeeeeee-0000-0000-0000-000000000500', 'dddddddd-0000-0000-0000-000000000125', 'cccccccc-0000-0000-0000-000000000002', 'INV-000500', 'Tom Hart', 321.00, 'pending', '2026-11-30', '2026-10-01', :A, 'deposit', 32100);
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_score', 'gross_pence', 32100,
  'received_at', '2026-10-13T10:00:00Z', 'payer_name', 'T HART', 'reference', 'memorial'));
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_score') = 'suggested'
  and not exists (select 1 from payment_allocations a join payments p on p.id = a.payment_id where p.external_id = 'rev_score'),
  'decision 5: amount + surname + date + only candidate never auto-confirms');
select pg_temp.ok((select max(score) from payment_match_suggestions s join payments p on p.id = s.payment_id where p.external_id = 'rev_score') >= 90,
  'decision 5: … even when the score is 90+');
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_ref', 'gross_pence', 10000,
  'received_at', '2026-10-13T11:00:00Z', 'payer_name', 'Someone', 'reference', 'INV-000500'));
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_ref') = 'matched'
  and (select matched_by from payments where external_id = 'rev_ref') = 'auto', 'decision 5: invoice reference still auto-confirms');

-- 7. Revolut reversal of a matched payment: keep match, flag, negative reversal row.
select (select remaining_pence from invoice_balances where invoice_id = 'eeeeeeee-0000-0000-0000-000000000500') as before_rem \gset
select pg_temp.as_service();
select public.ledger_set_state(:A, 'revolut', 'rev_ref', 'reverted');
reset role;
select pg_temp.ok((select match_status::text from payments where external_id = 'rev_ref') = 'matched'
  and exists (select 1 from payment_allocations a join payments p on p.id = a.payment_id where p.external_id = 'rev_ref'),
  'decision 7: reversed payment keeps its match');
select pg_temp.ok((select needs_review from payments where external_id = 'rev_ref'), 'decision 7: reversed payment flagged for review');
select pg_temp.ok((select gross_pence from payments where external_id = 'rev_ref:reversal') = -10000
  and (select kind::text from payments where external_id = 'rev_ref:reversal') = 'refund'
  and (select parent_payment_id from payments where external_id = 'rev_ref:reversal') = (select id from payments where external_id = 'rev_ref'),
  'decision 7: negative reversal row linked to the original');
select pg_temp.ok((select remaining_pence from invoice_balances where invoice_id = 'eeeeeeee-0000-0000-0000-000000000500') = :before_rem + 10000,
  'decision 7: invoice balance goes back up by the reversed amount');
select pg_temp.ok(exists (select 1 from payment_audit_log l join payments p on p.id = l.payment_id where p.external_id = 'rev_ref' and l.action = 'flagged_for_review'),
  'decision 7: flag is in the audit log');
-- Replays (webhook state event again, or the sync seeing state=reverted) add nothing.
select pg_temp.as_service();
select public.ledger_set_state(:A, 'revolut', 'rev_ref', 'reverted');
reset role;
select pg_temp.ingest(jsonb_build_object('organization_id', :A, 'source', 'revolut', 'external_id', 'rev_ref', 'gross_pence', 10000,
  'received_at', '2026-10-13T11:00:00Z', 'state', 'reverted'));
select pg_temp.ok((select count(*) from payments where external_id like 'rev_ref%') = 2, 'decision 7: reversal is idempotent');
-- A finance user clears the flag (audited); staff cannot.
select id as rev_ref_id from payments where external_id = 'rev_ref' \gset
select set_config('test.rev_ref', :'rev_ref_id', false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  begin perform public.ledger_mark_reviewed(current_setting('test.rev_ref')::uuid, 'x'); raise exception 'FAIL: staff cleared';
  exception when insufficient_privilege then raise notice 'ok - decision 7: staff cannot clear a review flag'; end;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.ledger_mark_reviewed((select id from payments where external_id = 'rev_ref'), 'Customer confirmed bank recall');
reset role;
select pg_temp.ok(not (select needs_review from payments where external_id = 'rev_ref')
  and exists (select 1 from payment_audit_log l join payments p on p.id = l.payment_id where p.external_id = 'rev_ref' and l.action = 'review_cleared'),
  'decision 7: finance user marks it checked (audited)');
