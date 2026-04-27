-- ============================================================
-- Migration: permits_five_stage_migration
-- Purpose: collapse order_permits.permit_phase from 7 values to 5
--          to match the design's pipeline. Add Drive-folder metadata,
--          paperwork delivery + return capture, memorial-spec
--          completion fields and cemetery regulation rules.
--
-- Companion code change: src/modules/permitAgent is being removed in
-- the same PR because its UI is tightly coupled to the 7 phases.
-- The permitTracker module reads orders.permit_status (a separate
-- 5-value enum) and is unaffected.
--
-- DESTRUCTIVE: existing permit_phase values are rewritten in place.
-- ============================================================

-- 1. Drop the old CHECK constraint first so we can remap values
alter table public.order_permits
  drop constraint if exists order_permits_permit_phase_check;

-- 2. Remap existing rows: 7 phases → 5 stages
--    REQUIRED | SEARCHING | FORM_FOUND   → form_needed
--    SENT_TO_CLIENT                      → with_customer
--    PREFILLED                           → completing
--    SUBMITTED                           → submitted
--    APPROVED                            → approved
update public.order_permits
set permit_phase = case permit_phase
  when 'REQUIRED'       then 'form_needed'
  when 'SEARCHING'      then 'form_needed'
  when 'FORM_FOUND'     then 'form_needed'
  when 'SENT_TO_CLIENT' then 'with_customer'
  when 'PREFILLED'      then 'completing'
  when 'SUBMITTED'      then 'submitted'
  when 'APPROVED'       then 'approved'
  else 'form_needed'
end
where permit_phase in (
  'REQUIRED','SEARCHING','FORM_FOUND','SENT_TO_CLIENT',
  'PREFILLED','SUBMITTED','APPROVED'
);

-- 3. Change the column default + re-add CHECK with the new enum
alter table public.order_permits
  alter column permit_phase set default 'form_needed';

alter table public.order_permits
  add constraint order_permits_permit_phase_check
  check (permit_phase in (
    'form_needed', 'with_customer', 'completing', 'submitted', 'approved'
  ));

-- 4. Paperwork delivery + return capture (design "With customer" stage)
alter table public.order_permits
  add column if not exists sent_via text check (
    sent_via in ('email', 'post', 'whatsapp', 'both')
  ),
  add column if not exists returned_via text check (
    returned_via in ('scan', 'photo', 'post', 'walked_in')
  ),
  add column if not exists returned_at timestamptz;

-- 5. Memorial-spec completion (design "Completing" stage — 5 checkboxes).
--    Inscription, material and dimensions can be read from orders/memorials;
--    fixings and plot_ref aren't modelled anywhere else.
alter table public.order_permits
  add column if not exists spec_fixings text,
  add column if not exists spec_plot_ref text,
  add column if not exists specs_completed_at timestamptz;

-- 6. Drive-folder integration on permit_forms (design "Form needed" stage).
--    The match_reason is for AI auditability (e.g. "matched by cemetery name").
alter table public.permit_forms
  add column if not exists drive_file_id text,
  add column if not exists drive_url text,
  add column if not exists cemetery_id uuid references public.cemeteries(id),
  add column if not exists match_reason text;

create index if not exists idx_permit_forms_cemetery_id
  on public.permit_forms (cemetery_id);

-- 7. Cemetery regulation rules (AI regs-check during Completing stage)
alter table public.cemeteries
  add column if not exists max_height_mm int,
  add column if not exists max_width_mm int,
  add column if not exists allowed_typefaces text[],
  add column if not exists regulation_notes text;

comment on column public.order_permits.permit_phase is
  'Design pipeline stage: form_needed | with_customer | completing | submitted | approved. Migrated from 7-phase schema on 2026-04-19.';
