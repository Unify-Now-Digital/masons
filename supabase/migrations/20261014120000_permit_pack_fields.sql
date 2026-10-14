-- Mason v3 (2026-10-14): permit pack essentials + YOPA tagging.
-- WRITTEN ONLY — NOT APPLIED. Review with Giorgi before applying to prod.
-- Additive & nullable: no backfill, no existing behaviour changes.

alter table public.orders
  add column if not exists deceased_dob date,
  add column if not exists deceased_dod date,
  add column if not exists burial_date date,
  add column if not exists cemetery_section text,
  add column if not exists grave_owner_name text,
  add column if not exists deed_number text,
  add column if not exists permit_fee_paid_to_cemetery_at timestamptz,
  add column if not exists permit_submitted_at timestamptz,
  add column if not exists permit_approved_at timestamptz,
  add column if not exists permit_missing_fields jsonb;

-- Widen permit_status (superset of 20260402120000).
alter table public.orders drop constraint if exists orders_permit_status_check;
alter table public.orders add constraint orders_permit_status_check
  check (permit_status in ('not_started', 'form_sent', 'customer_completed', 'ready_to_submit',
                           'pending', 'returned_incomplete', 'approved'));

-- YOPA (partner call-answering) messages: tagged so they never count as our reply.
alter table public.inbox_messages
  add column if not exists source text;
comment on column public.inbox_messages.source is
  'Origin tag, e.g. ''yopa'' for Your Office and PA call notifications (inbound, never a reply).';
