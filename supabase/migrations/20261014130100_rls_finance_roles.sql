-- RLS hardening 2/6: finance data limited to finance roles (admin, member); payment rows
-- are not writable from the browser. Audit findings #1 and #3.
-- Uses public.user_can_view_org_finance(org) from 20261014120000_payments_ledger.sql
-- (admin + member; 'staff' excluded), matching the app's canViewFinancials.

-- invoices: finance roles read and write (the Invoicing UI creates/edits drafts directly).
drop policy if exists invoices_org_select on public.invoices;
drop policy if exists invoices_org_insert on public.invoices;
drop policy if exists invoices_org_update on public.invoices;
drop policy if exists invoices_org_delete on public.invoices;
drop policy if exists invoices_finance_select on public.invoices;
create policy invoices_finance_select on public.invoices for select to authenticated
  using ((select public.user_can_view_org_finance(organization_id)));
drop policy if exists invoices_finance_insert on public.invoices;
create policy invoices_finance_insert on public.invoices for insert to authenticated
  with check ((select public.user_can_view_org_finance(organization_id)));
drop policy if exists invoices_finance_update on public.invoices;
create policy invoices_finance_update on public.invoices for update to authenticated
  using ((select public.user_can_view_org_finance(organization_id)))
  with check ((select public.user_can_view_org_finance(organization_id)));
drop policy if exists invoices_finance_delete on public.invoices;
create policy invoices_finance_delete on public.invoices for delete to authenticated
  using ((select public.user_can_view_org_finance(organization_id)));

-- invoice_line_items: read-only for finance roles (written by Stripe edge functions).
drop policy if exists invoice_line_items_org_select on public.invoice_line_items;
drop policy if exists invoice_line_items_finance_select on public.invoice_line_items;
create policy invoice_line_items_finance_select on public.invoice_line_items for select to authenticated
  using ((select public.user_can_view_org_finance(organization_id)));
revoke insert, update, delete, truncate on public.invoice_line_items from anon, authenticated;

-- Legacy payment tables: read-only for finance roles; no browser writes at all.
drop policy if exists invoice_payments_org_select on public.invoice_payments;
drop policy if exists invoice_payments_org_insert on public.invoice_payments;
drop policy if exists invoice_payments_org_update on public.invoice_payments;
drop policy if exists invoice_payments_org_delete on public.invoice_payments;
drop policy if exists invoice_payments_finance_select on public.invoice_payments;
create policy invoice_payments_finance_select on public.invoice_payments for select to authenticated
  using ((select public.user_can_view_org_finance(organization_id)));
revoke insert, update, delete, truncate on public.invoice_payments from anon, authenticated;

drop policy if exists order_payments_org_members_all on public.order_payments;
drop policy if exists order_payments_finance_select on public.order_payments;
create policy order_payments_finance_select on public.order_payments for select to authenticated
  using (organization_id is not null and (select public.user_can_view_org_finance(organization_id)));
revoke insert, update, delete, truncate on public.order_payments from anon, authenticated;

-- Ledger tables (PR #35): belt and braces, no browser writes.
do $$
declare t text; r record;
begin
  foreach t in array array['payments','payment_allocations','payment_match_suggestions','payment_audit_log'] loop
    if to_regclass('public.'||t) is not null then
      -- Without PR #35, public.payments is still the empty 2025 legacy table (no gross_pence
      -- column): close it to browser roles entirely. The SM website uses the service key.
      if t = 'payments' and not exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'payments' and column_name = 'gross_pence') then
        for r in select polname from pg_policy where polrelid = 'public.payments'::regclass loop
          execute format('drop policy %I on public.payments', r.polname);
        end loop;
        execute 'revoke all on public.payments from anon, authenticated';
        execute 'drop policy if exists payments_legacy_deny_browser_roles on public.payments';
        execute 'create policy payments_legacy_deny_browser_roles on public.payments for all to anon, authenticated using (false) with check (false)';
      end if;
      execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    end if;
  end loop;
  -- Renamed 2025 legacy table (0 rows): no browser access.
  if to_regclass('public.payments_legacy_2025') is not null then
    for t in select polname from pg_policy where polrelid = 'public.payments_legacy_2025'::regclass loop
      execute format('drop policy %I on public.payments_legacy_2025', t);
    end loop;
    execute 'revoke all on public.payments_legacy_2025 from anon, authenticated';
    execute 'create policy payments_legacy_2025_deny_browser_roles on public.payments_legacy_2025 for all to anon, authenticated using (false) with check (false)';
  end if;
  if to_regclass('public.ledger_backfill_snapshot') is not null then
    execute 'drop policy if exists ledger_backfill_snapshot_deny_browser_roles on public.ledger_backfill_snapshot';
    execute 'create policy ledger_backfill_snapshot_deny_browser_roles on public.ledger_backfill_snapshot for all to anon, authenticated using (false) with check (false)';
  end if;
end $$;
