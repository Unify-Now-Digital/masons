-- Lead source + channel attribution (SM, 15 Oct 2026). PREPARED, NOT APPLIED — needs Arin's approval.
--
-- Vocab (Arin, 15 Oct 2026):
--   lead_source  in (Google Ads, Organic, Funeral director, Referral, Repeat, Unknown)
--   lead_channel in (Contact form, RAQ, Brochure, Web chat, Call, Email)
--
-- NOTE on naming: public.enquiries.channel ALREADY EXISTS and means the web form kind
-- (quote / contact / appointment / call / shortlist / partner_order, enquiries_channel_check),
-- used by the site, create_quote, the inbox sync trigger and Finance. Re-using it would break
-- those, so the new attribution channel is a separate column, lead_channel.
-- utm_campaign, utm_term and gclid already exist on enquiries (20261014222958); the
-- "add column if not exists" lines below are no-ops kept for a clean replay.
-- Prod check 15 Oct 2026 11:30 Madrid: enquiries.lead_source and jobs.lead_source are NULL on
-- every row (144 / 117), so the constraints validate immediately.

begin;

alter table public.enquiries add column if not exists utm_campaign text;
alter table public.enquiries add column if not exists utm_term     text;
alter table public.enquiries add column if not exists gclid        text;
alter table public.enquiries add column if not exists lead_channel text;
alter table public.jobs      add column if not exists lead_channel text;

-- Map any legacy picklist values (phase5 LEAD_SOURCES, create_quote 'Web form') before constraining.
create or replace function public.normalize_lead_source(v text)
returns text language sql immutable as $$
  select case
    when v is null or btrim(v) = '' then null
    when v in ('Google Ads','Organic','Funeral director','Referral','Repeat','Unknown') then v
    when v ~* '^(fd|funeral)' then 'Funeral director'
    when v ~* '^(returning|repeat)' then 'Repeat'
    when v ~* 'referr' then 'Referral'
    when v ~* '^(google ads|ads|ppc|cpc)$' then 'Google Ads'
    when v ~* '^organic' then 'Organic'
    else 'Unknown'   -- 'Web form', 'Phone/YOPA', 'Brochure', 'Email', 'Walk-in', 'Other' are channels, not sources
  end $$;

create or replace function public.normalize_lead_channel(v text)
returns text language sql immutable as $$
  select case
    when v is null or btrim(v) = '' then null
    when v in ('Contact form','RAQ','Brochure','Web chat','Call','Email') then v
    when v ~* '^(quote|raq|request a quote)' then 'RAQ'
    when v ~* '^(contact|shortlist|web form)' then 'Contact form'
    when v ~* 'brochure' then 'Brochure'
    when v ~* 'chat' then 'Web chat'
    when v ~* '^(call|phone|yopa)' then 'Call'
    when v ~* '^e-?mail' then 'Email'
    else null
  end $$;

update public.enquiries set lead_source = public.normalize_lead_source(lead_source) where lead_source is not null;
update public.jobs      set lead_source = public.normalize_lead_source(lead_source) where lead_source is not null;

alter table public.enquiries drop constraint if exists enquiries_lead_source_check;
alter table public.enquiries add constraint enquiries_lead_source_check
  check (lead_source is null or lead_source in ('Google Ads','Organic','Funeral director','Referral','Repeat','Unknown'));
alter table public.enquiries drop constraint if exists enquiries_lead_channel_check;
alter table public.enquiries add constraint enquiries_lead_channel_check
  check (lead_channel is null or lead_channel in ('Contact form','RAQ','Brochure','Web chat','Call','Email'));
alter table public.jobs drop constraint if exists jobs_lead_source_check;
alter table public.jobs add constraint jobs_lead_source_check
  check (lead_source is null or lead_source in ('Google Ads','Organic','Funeral director','Referral','Repeat','Unknown'));
alter table public.jobs drop constraint if exists jobs_lead_channel_check;
alter table public.jobs add constraint jobs_lead_channel_check
  check (lead_channel is null or lead_channel in ('Contact form','RAQ','Brochure','Web chat','Call','Email'));

comment on column public.enquiries.lead_channel is 'How the lead reached us: Contact form, RAQ, Brochure, Web chat, Call, Email. (enquiries.channel = form kind, unchanged.)';
comment on column public.jobs.lead_channel is 'Copied from the enquiry on conversion when blank (trg_jobs_inherit_lead_attribution).';

create index if not exists enquiries_org_lead_source_idx on public.enquiries (organization_id, lead_source);
create index if not exists jobs_org_lead_source_idx      on public.jobs (organization_id, lead_source);

-- Propagation 1: when a job is created or linked to an enquiry, inherit BLANK source/channel.
create or replace function public.trg_jobs_inherit_lead_attribution()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare e record;
begin
  if new.enquiry_id is not null and (new.lead_source is null or new.lead_channel is null) then
    select lead_source, lead_channel into e from public.enquiries where id = new.enquiry_id;
    new.lead_source  := coalesce(new.lead_source,  e.lead_source);
    new.lead_channel := coalesce(new.lead_channel, e.lead_channel);
  end if;
  new.lead_source  := public.normalize_lead_source(new.lead_source);
  new.lead_channel := public.normalize_lead_channel(new.lead_channel);
  return new;
end $$;
drop trigger if exists trg_jobs_inherit_lead_attribution on public.jobs;
create trigger trg_jobs_inherit_lead_attribution
  before insert or update of enquiry_id, lead_source, lead_channel on public.jobs
  for each row execute function public.trg_jobs_inherit_lead_attribution();

-- Propagation 2: an enquiry labelled later (backfill / GHL sync) fills its jobs' BLANK fields.
create or replace function public.trg_enquiries_push_lead_attribution()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.jobs j set
    lead_source  = coalesce(j.lead_source,  new.lead_source),
    lead_channel = coalesce(j.lead_channel, new.lead_channel)
  where j.enquiry_id = new.id
    and ((j.lead_source is null and new.lead_source is not null) or (j.lead_channel is null and new.lead_channel is not null));
  return new;
end $$;
drop trigger if exists trg_enquiries_push_lead_attribution on public.enquiries;
create trigger trg_enquiries_push_lead_attribution
  after update of lead_source, lead_channel on public.enquiries
  for each row when (new.lead_source is distinct from old.lead_source or new.lead_channel is distinct from old.lead_channel)
  execute function public.trg_enquiries_push_lead_attribution();

-- Google Ads daily spend for Finance "cost per deposit" (filled by a daily Ads API pull; not built yet).
create table if not exists public.ads_spend_daily (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  day date not null,
  ads_customer_id text not null,
  campaign_id text not null,
  campaign_name text,
  cost_gbp numeric(12,2) not null default 0,
  clicks integer not null default 0,
  impressions integer not null default 0,
  conversions numeric(10,2) not null default 0,
  pulled_at timestamptz not null default now(),
  primary key (organization_id, day, campaign_id)
);
alter table public.ads_spend_daily enable row level security;
drop policy if exists ads_spend_daily_select_by_org on public.ads_spend_daily;
create policy ads_spend_daily_select_by_org on public.ads_spend_daily for select
  using (public.user_is_member_of_org(organization_id));
-- No insert/update policy: only the service role (the pull job) writes.

-- create_quote: same body as 20261014223009 plus lead_channel and the new vocab.
create or replace function public.create_quote(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org         public.people.organization_id%type := (payload->>'organization_id')::uuid;
  v_email       text  := lower(trim(payload->>'email'));
  v_first       text  := nullif(payload->>'first_name', '');
  v_last        text  := nullif(payload->>'last_name', '');
  v_phone       text  := nullif(payload->>'phone', '');
  v_name        text  := nullif(payload->>'name', '');
  v_message     text  := nullif(payload->>'message', '');
  v_source_page text  := nullif(payload->>'source_page', '');
  v_location    text  := nullif(payload->>'location', '');
  v_cem_in      text  := nullif(payload->>'cemetery_id', '');
  v_edit_token  text  := nullif(payload->>'edit_token', '');
  v_product     jsonb := payload->'product';
  v_utm_source   text := left(nullif(payload->>'utm_source', ''), 255);
  v_utm_medium   text := left(nullif(payload->>'utm_medium', ''), 255);
  v_utm_campaign text := left(nullif(payload->>'utm_campaign', ''), 255);
  v_utm_term     text := left(nullif(payload->>'utm_term', ''), 255);
  v_utm_content  text := left(nullif(payload->>'utm_content', ''), 255);
  v_gclid        text := left(nullif(payload->>'gclid', ''), 512);
  v_gbraid       text := left(nullif(payload->>'gbraid', ''), 512);
  v_wbraid       text := left(nullif(payload->>'wbraid', ''), 512);
  v_landing_page text := left(nullif(payload->>'landing_page', ''), 2048);
  v_lead_source  text := public.normalize_lead_source(left(nullif(payload->>'lead_source', ''), 64));
  v_lead_channel text := public.normalize_lead_channel(left(nullif(coalesce(payload->>'lead_channel', payload->>'channel'), ''), 64));
  v_person_id   public.people.id%type;
  v_job_id      public.jobs.id%type;
  v_enq_id      public.enquiries.id%type;
  v_cemetery_id public.cemeteries.id%type;
begin
  if v_email is null or v_email = '' then
    raise exception 'create_quote: email is required';
  end if;
  -- A click ID always wins over whatever the page claimed.
  if coalesce(v_gclid, v_gbraid, v_wbraid) is not null
     or (v_utm_source ~* '^google$' and v_utm_medium ~* '^(cpc|ppc|paid)') then
    v_lead_source := 'Google Ads';
  elsif v_lead_source is null then
    v_lead_source := 'Unknown';
  end if;
  v_lead_channel := coalesce(v_lead_channel, 'RAQ');  -- create_quote is the RAQ form
  if v_edit_token is null then
    v_edit_token := encode(extensions.gen_random_bytes(24), 'hex');
  end if;
  select id into v_person_id from public.people
  where email = v_email and organization_id = v_org limit 1;
  if v_person_id is null then
    begin
      insert into public.people (organization_id, email, first_name, last_name, phone)
      values (v_org, v_email, v_first, v_last, v_phone)
      returning id into v_person_id;
    exception when unique_violation then
      select id into v_person_id from public.people
      where email = v_email and organization_id = v_org limit 1;
    end;
  else
    update public.people set
      first_name = coalesce(v_first, first_name),
      last_name  = coalesce(nullif(v_last, '-'), last_name),
      phone      = coalesce(v_phone, phone)
    where id = v_person_id;
  end if;
  if v_cem_in is not null then
    select c.id into v_cemetery_id from public.cemeteries c where c.id::text = v_cem_in limit 1;
  elsif v_location is not null and char_length(v_location) >= 3 then
    select c.id into v_cemetery_id
    from public.cemeteries c
    where c.is_active = true
      and (c.name ilike v_location or c.name ilike v_location || '%' or c.name ilike '%' || v_location || '%')
    order by (c.name ilike v_location) desc, (c.name ilike v_location || '%') desc
    limit 1;
  end if;
  select id into v_job_id from public.jobs
  where person_id = v_person_id and organization_id = v_org and stage = 'enquired' and exit_reason is null
  order by created_at desc limit 1;
  if v_job_id is null then
    insert into public.jobs (organization_id, person_id, source, stage, stage_status, lead_source, lead_channel)
    values (v_org, v_person_id, 'website', 'enquired', 'uncontacted', v_lead_source, v_lead_channel)
    returning id into v_job_id;
  end if;
  insert into public.enquiries (
    organization_id, person_id, channel, source_page, message, location, cemetery_id, details,
    lead_source, lead_channel, landing_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, gbraid, wbraid
  ) values (
    v_org, v_person_id, 'quote', v_source_page, v_message, v_location, v_cemetery_id, v_product,
    v_lead_source, v_lead_channel, v_landing_page, v_utm_source, v_utm_medium, v_utm_campaign, v_utm_term, v_utm_content, v_gclid, v_gbraid, v_wbraid
  )
  returning id into v_enq_id;
  update public.jobs set
    enquiry_id = v_enq_id,
    conversation_id = coalesce(conversation_id, (
      select id from public.inbox_conversations
      where external_thread_id = 'enquiry:' || v_enq_id::text and organization_id = v_org limit 1))
  where id = v_job_id;
  return jsonb_build_object('person_id', v_person_id, 'order_id', null, 'enquiry_id', v_enq_id, 'edit_token', v_edit_token, 'job_id', v_job_id);
end;
$function$;

commit;
