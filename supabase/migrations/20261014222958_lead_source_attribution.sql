-- Record lead source and web attribution (approved by Arin, 15 Oct 2026).
-- Additive only: new nullable columns, no drops/renames/defaults/backfill.
-- enquiries already has utm_source/utm_medium/utm_campaign/utm_term/utm_content,
-- gclid, gbraid, wbraid and source_page (path of the form page).
-- Orders: the fixing date is the existing orders.installation_date (reused, no new column).
-- Existing RLS policies are table-level (org membership) and cover the new columns.

alter table public.enquiries add column if not exists lead_source text;
alter table public.enquiries add column if not exists landing_page text;
alter table public.jobs      add column if not exists lead_source text;

comment on column public.enquiries.lead_source is
  'Where the lead came from: Phone/YOPA, FD referral, Brochure, Google Ads, Web form, Email, Walk-in, Other.';
comment on column public.enquiries.landing_page is
  'First landing URL of the web session (with query string), captured by the website form.';
comment on column public.jobs.lead_source is
  'Lead source picked when the enquiry was added to the pipeline manually (same values as enquiries.lead_source).';
