-- LOCAL ONLY test for 20261015170100_record_manual_payment.sql. Build a throwaway Postgres from PR #37's
-- scripts/local-db shim + schema snapshot + #37's RLS migrations (= prod RLS state 15 Oct). Never run against Supabase.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'member@test'),
  ('00000000-0000-0000-0000-0000000000a2', 'staff@test'),
  ('00000000-0000-0000-0000-0000000000a3', 'other@test');
insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Org A'), ('00000000-0000-0000-0000-00000000000b', 'Org B');
-- Role admin or member is not enough. record_manual_payment requires is_owner.
-- The insert runs as postgres, so the owner-flag guard allows these rows.
insert into public.organization_members (organization_id, user_id, role, is_owner) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'member', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'staff', false),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a3', 'admin', false);
insert into public.orders (id, organization_id, customer_name, order_type) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'Test', 'New Memorial');

set local role authenticated;

-- owner (role member is not what allows this): allowed
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
set local request.jwt.claims = '{"email":"member@test"}';
select public.record_manual_payment('00000000-0000-0000-0000-0000000000f1', 250.004, current_date, 'bank', 'deposit', ' REF1 ') is not null as member_ok;
select public.record_manual_payment('00000000-0000-0000-0000-0000000000f1', 10, current_date - 3, 'cash', 'deposit', null) is not null as member_ok_2;

do $$ declare n int; begin
  -- staff: refused
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  begin perform public.record_manual_payment('00000000-0000-0000-0000-0000000000f1', 5, current_date, 'bank', 'final', null);
    raise exception 'FAIL: staff was allowed';
  exception when insufficient_privilege then raise notice 'ok: staff refused'; end;
  -- other org admin: refused
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
  begin perform public.record_manual_payment('00000000-0000-0000-0000-0000000000f1', 5, current_date, 'bank', 'final', null);
    raise exception 'FAIL: other org allowed';
  exception when insufficient_privilege then raise notice 'ok: other org refused'; end;
  -- not signed in: refused
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.record_manual_payment('00000000-0000-0000-0000-0000000000f1', 5, current_date, 'bank', 'final', null);
    raise exception 'FAIL: anonymous allowed';
  exception when invalid_authorization_specification then raise notice 'ok: signed-out refused'; end;
  -- bad input: refused
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  begin perform public.record_manual_payment('00000000-0000-0000-0000-0000000000f1', 0, current_date, 'bank', 'final', null);
    raise exception 'FAIL: zero amount allowed';
  exception when invalid_parameter_value then raise notice 'ok: zero refused'; end;
  begin perform public.record_manual_payment('00000000-0000-0000-0000-0000000000f1', 5, current_date, 'stripe', 'final', null);
    raise exception 'FAIL: stripe source allowed';
  exception when invalid_parameter_value then raise notice 'ok: stripe source refused'; end;
end $$;

reset role;
do $$ declare n int; d date; amt numeric; r text; begin
  select count(*) into n from public.order_payments where order_id = '00000000-0000-0000-0000-0000000000f1';
  if n <> 2 then raise exception 'FAIL: expected 2 payments, got %', n; end if;
  select deposit_date into d from public.orders where id = '00000000-0000-0000-0000-0000000000f1';
  if d <> current_date then raise exception 'FAIL: deposit_date % (first payment should win)', d; end if;
  select amount, reference into amt, r from public.order_payments where order_id = '00000000-0000-0000-0000-0000000000f1' and source = 'bank';
  if amt <> 250.00 or r <> 'REF1' then raise exception 'FAIL: amount/reference % %', amt, r; end if;
  if has_function_privilege('anon', 'public.record_manual_payment(uuid,numeric,date,text,text,text)', 'execute') then
    raise exception 'FAIL: anon can execute'; end if;
  raise notice 'ALL OK';
end $$;
rollback;
