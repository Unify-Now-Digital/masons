-- RLS (#11) and finance-role scoping. Run as the browser roles.
set search_path = public, extensions;
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid::text, false); perform set_config('request.jwt.claim.role', 'authenticated', false); set role authenticated; end $$;

select id as raw_payment from payments where raw is not null limit 1 \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select count(*) from payments where organization_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, '#11 org B admin cannot read org A payments');
select pg_temp.ok((select count(*) from payment_allocations where organization_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, '#11 … nor allocations');
do $$ begin
  begin perform public.ledger_ignore((select id from payments limit 1), 'x'); exception when others then null; end;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ok((select count(*) from payments) = 0 and (select count(*) from payment_audit_log) = 0, 'staff (non-finance role) sees no payments or audit log');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select count(*) from payments) > 0, 'org A admin (finance role) reads org A payments');
do $$ begin
  begin perform raw from public.payments limit 1; raise exception 'FAIL: raw readable';
  exception when insufficient_privilege then raise notice 'ok - raw webhook payload not selectable from the browser'; end;
  begin insert into public.payments (organization_id, source, external_id, gross_pence, received_at)
        values ('aaaaaaaa-0000-0000-0000-000000000001', 'manual', 'x', 1, now());
        raise exception 'FAIL: browser insert';
  exception when insufficient_privilege then raise notice 'ok - payments are insert-only from ingestion (no browser insert)'; end;
  begin perform public.ledger_ingest_payment('{"organization_id":"aaaaaaaa-0000-0000-0000-000000000001","source":"manual","external_id":"y","gross_pence":1}');
        raise exception 'FAIL: browser ingest';
  exception when insufficient_privilege then raise notice 'ok - ingestion RPC is service-role only'; end;
end $$;
select pg_temp.ok(public.ledger_payment_raw(:'raw_payment') is not null, 'finance user can read raw via the finance-only RPC');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  begin perform public.ledger_record_manual_payment('aaaaaaaa-0000-0000-0000-000000000001', 100, now(), 'cash', 'x');
        raise exception 'FAIL: staff recorded a payment';
  exception when insufficient_privilege then raise notice 'ok - staff cannot record or match payments'; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform 1 from public.payments limit 1; raise exception 'FAIL: anon read';
  exception when insufficient_privilege then raise notice 'ok - anon has no access'; end;
end $$;
reset role;
