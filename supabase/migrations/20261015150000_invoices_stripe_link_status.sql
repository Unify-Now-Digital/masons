-- Stripe-created invoice linking (eng/stripe-invoice-linking-finance-cards).
-- NOT APPLIED TO PROD by the PR author: apply before deploying stripe-webhook / merging the UI.
-- stripe_link_status:
--   NULL        = invoice created in Mason (legacy / normal path)
--   'auto'      = created from a Stripe webhook/import and matched automatically
--   'manual'    = linked by hand from the Unmatched invoices list (or an operator fix)
--   'unmatched' = created from Stripe, no order found yet -> shows in the Unmatched list
alter table public.invoices
  add column if not exists stripe_link_status text,
  add column if not exists stripe_link_reason text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_stripe_link_status_check') then
    alter table public.invoices
      add constraint invoices_stripe_link_status_check
      check (stripe_link_status is null or stripe_link_status in ('auto','manual','unmatched'));
  end if;
end $$;

-- One Mason row per Stripe invoice (the webhook upsert relies on this).
create unique index if not exists invoices_stripe_invoice_id_key
  on public.invoices (stripe_invoice_id) where stripe_invoice_id is not null;

create index if not exists invoices_unmatched_idx
  on public.invoices (organization_id) where stripe_link_status = 'unmatched' and deleted_at is null;
