-- ============================================================================
-- Quote-to-job pipeline cutover (spec: specs/quote-to-job-pipeline/)
-- ONE coordinated window: create_quote rewrite (S2) + SM backfill (S3-S7).
-- Applied manually via Dashboard SQL editor, statement by statement, by Giorgi.
-- This file is the record, not the applier. Lowercase keywords; LF endings.
--
-- Org guard: every DML statement is scoped to Sears Melvin
--   organization_id = '3770972d-1bbd-417b-b413-297e844db285'
-- Churchill has zero portal quotes — this backfill is SM-only. The single DDL
-- statement (S1 column add) is tenant-neutral by nature.
--
-- Dry-run SELECTs are executable (read-only) statements placed ABOVE each
-- write; run each, paste its output below, THEN run the write and paste
-- rows-affected + RETURNING. "Applied" != "rows affected" — a 0-row UPDATE's
-- "Success" is a failure here.
--
-- F1 HARD REQUIREMENT: S0's partition output MUST be pasted into this header
-- BEFORE S3/S4 run — the create-vs-attach split is recorded fact, not
-- inference.
--
-- ============================================================================
-- EVIDENCE (filled at apply time — placeholders until then; FR-012)
--   Applied:        IN PROGRESS 20 Aug 2026, Giorgi, Dashboard SQL editor
--                   (S0 run, S1-S2 applied; S3+ pending)
--   S0 partition:   SUMMARY (Giorgi, 20 Aug): 23 persons, 30 orders,
--                   30 stamped conversations; no null latest_quote_enquiry_id;
--                   Partition A=15 (active_job_count >= 1), B=8 (post-1-Aug
--                   arrivals); d4b7a8ac-399c-4cb7-9f81-baf02da35786 carries
--                   4 active jobs -> S4c amendment.
--                   Derived predictions: S3=8, S4c=3, S5~13 (17 pre-1-Aug
--                   stamped orders, not the 1-Aug file's recorded 20), S6=30,
--                   S7=30.
--                   Per-person 23-row table (person_id | quote_order_count |
--                   active_job_count | latest_quote_enquiry_id |
--                   stamped_conversation_ids):
--                   <PASTE raw Dashboard output — held by Giorgi; raw rows
--                    never entered the CC session and are not reconstructed
--                    here by policy (evidence discipline: no narrative rows)>
--   S1 read-back:   archived_at | timestamp with time zone | YES
--   S2 read-back:   first read-back: orders_insert_pos=0, cr_pos=167 (CRLF
--                   entered via Dashboard PASTE path despite LF-clean file;
--                   see supabase/CLAUDE.md 20 Aug note) -> server-side strip
--                   (do $$ execute replace(pg_get_functiondef, e'\r', '') $$)
--                   -> re-read-back: orders_insert_pos=0, cr_pos=0.
--                   ACL: {postgres=X/postgres,service_role=X/postgres}
--                   (service_role-only, unchanged by CREATE OR REPLACE).
--   S3 dry-run:     <PASTE>   S3 applied: <n rows + RETURNING>
--   S4 dry-run:     <PASTE>   S4 applied: <n rows + RETURNING>
--   S5 dry-run:     <PASTE>   S5 applied: <n rows + RETURNING>
--   S6 dry-run:     <PASTE>   S6 applied: <n rows + RETURNING>
--   S7 dry-run:     <PASTE>   S7 applied: <n rows + RETURNING>
--   S8 read-backs:  <PASTE all six outputs>
-- ============================================================================


-- ============================================================================
-- S0. PARTITION SELECT (read-only; run FIRST; paste output in header above)
-- Expected: 23 rows (one per distinct person behind the 30 quote orders).
-- Partition A = active_job_count >= 1 (attach, S4). Partition B = 0 (create, S3).
-- ============================================================================
select
  o.person_id,
  count(distinct o.id) as quote_order_count,
  (select count(*) from public.jobs j
     where j.person_id = o.person_id
       and j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
       and j.exit_reason is null) as active_job_count,
  (select e.id from public.enquiries e
     join public.orders o2 on o2.id = e.order_id
     where e.person_id = o.person_id
       and e.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
       and o2.order_type = 'quote'
     order by e.created_at desc limit 1) as latest_quote_enquiry_id,
  array_agg(distinct c.id) filter (where c.id is not null) as stamped_conversation_ids
from public.orders o
left join public.inbox_conversations c
  on c.order_id = o.id
 and c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and o.order_type = 'quote'
group by o.person_id
order by o.person_id;


-- ============================================================================
-- S1. DDL — archive mechanism (defined by this cycle; research.md V2: none
-- existed). Additive nullable column; non-null = archived. Tenant-neutral DDL.
-- ============================================================================
alter table public.orders add column archived_at timestamptz;

-- S1 read-back:
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'orders' and column_name = 'archived_at';


-- ============================================================================
-- S2. create_quote rewrite (contracts/create_quote.md). Placed BEFORE the
-- backfill DML so no new quote-order can arrive mid-window (race-free).
-- Person upsert preserved VERBATIM from 20260819120000 (f683e4c org-scoping).
-- CREATE OR REPLACE keeps owner + ACL (service_role-only); re-verified below.
-- ============================================================================
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
  v_person_id   public.people.id%type;
  v_job_id      public.jobs.id%type;
  v_enq_id      public.enquiries.id%type;
  v_cemetery_id public.cemeteries.id%type;
begin
  if v_email is null or v_email = '' then
    raise exception 'create_quote: email is required';
  end if;

  -- edit_token is echoed in the return for worker compatibility but is no
  -- longer persisted anywhere (no orders row; capture trigger starved).
  if v_edit_token is null then
    v_edit_token := encode(extensions.gen_random_bytes(24), 'hex');
  end if;

  -- 1. Person upsert (dedupe by org-scoped email — people_org_email_key).
  --    select-then-insert/update with a unique_violation fallback so it does
  --    not depend on the unique index name. organization_id is never changed
  --    for an existing row.
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

  -- 2. Resolve cemetery: prefer the supplied id, else best-effort name match.
  if v_cem_in is not null then
    select c.id into v_cemetery_id
    from public.cemeteries c
    where c.id::text = v_cem_in
    limit 1;
  elsif v_location is not null and char_length(v_location) >= 3 then
    select c.id into v_cemetery_id
    from public.cemeteries c
    where c.is_active = true
      and (c.name ilike v_location
           or c.name ilike v_location || '%'
           or c.name ilike '%' || v_location || '%')
    order by (c.name ilike v_location) desc,
             (c.name ilike v_location || '%') desc
    limit 1;
  end if;

  -- 3. Forward dedupe (FR-004): reuse the person's active 'enquired' job, else
  --    create one. Later-stage jobs never match — a fresh quote from someone
  --    in production is a new memorial.
  select id into v_job_id from public.jobs
  where person_id = v_person_id
    and organization_id = v_org
    and stage = 'enquired'
    and exit_reason is null
  order by created_at desc
  limit 1;
  if v_job_id is null then
    insert into public.jobs (organization_id, person_id, source, stage, stage_status)
    values (v_org, v_person_id, 'website', 'enquired', 'uncontacted')
    returning id into v_job_id;
  end if;

  -- 4. Enquiry — CRM record; NO order_id (quotes no longer create orders).
  --    trg_sync_enquiry_to_inbox fires synchronously here and creates the
  --    web-channel conversation.
  insert into public.enquiries (
    organization_id, person_id, channel, source_page, message,
    location, cemetery_id, details
  ) values (
    v_org, v_person_id, 'quote', v_source_page, v_message,
    v_location, v_cemetery_id, v_product
  )
  returning id into v_enq_id;

  -- 5. Attach: the latest enquiry is the job's config source; the conversation
  --    created by the trigger above is linked on first attach only.
  update public.jobs set
    enquiry_id = v_enq_id,
    conversation_id = coalesce(conversation_id, (
      select id from public.inbox_conversations
      where external_thread_id = 'enquiry:' || v_enq_id::text
        and organization_id = v_org
      limit 1))
  where id = v_job_id;

  -- Legacy keys kept for portal-worker compatibility (research.md F2):
  -- order_id is always null now; edit_token is an unpersisted echo.
  return jsonb_build_object(
    'person_id',  v_person_id,
    'order_id',   null,
    'enquiry_id', v_enq_id,
    'edit_token', v_edit_token,
    'job_id',     v_job_id
  );
end;
$function$;

-- S2 read-backs: definition (must contain NO "insert into public.orders", no \r),
-- and ACL still service_role-only.
select position('insert into public.orders' in pg_get_functiondef('public.create_quote(jsonb)'::regprocedure)) as orders_insert_pos,  -- expected: 0
       position(e'\r' in pg_get_functiondef('public.create_quote(jsonb)'::regprocedure)) as cr_pos;                                  -- expected: 0
select proacl from pg_proc where oid = 'public.create_quote(jsonb)'::regprocedure;


-- ============================================================================
-- S3. Backfill, Partition B — persons behind quote orders with NO active job:
-- create one job per person from their LATEST quote enquiry.
-- stage_status 'pending' matches the 1-Aug backfill convention for backfilled
-- rows (live intake uses 'uncontacted'). created_at = enquiry's created_at.
-- Expected rows: Partition-B size from S0 (paste prediction before running).
-- ============================================================================
-- S3 dry-run (read-only; row set = the inserts S3 will make):
select p.person_id, p.latest_enquiry_id, e.created_at as enquiry_created_at, c.id as conversation_id
from (
  select distinct on (e.person_id) e.person_id, e.id as latest_enquiry_id
  from public.enquiries e
  join public.orders o on o.id = e.order_id
  where e.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.order_type = 'quote'
    and not exists (
      select 1 from public.jobs j
      where j.person_id = e.person_id
        and j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
        and j.exit_reason is null)
  order by e.person_id, e.created_at desc
) p
join public.enquiries e on e.id = p.latest_enquiry_id
left join public.inbox_conversations c
  on c.external_thread_id = 'enquiry:' || p.latest_enquiry_id::text
 and c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
order by p.person_id;

-- S3 write:
insert into public.jobs
  (organization_id, person_id, enquiry_id, conversation_id, source, stage, stage_status, created_at)
select
  '3770972d-1bbd-417b-b413-297e844db285',
  p.person_id,
  p.latest_enquiry_id,
  c.id,
  'website',
  'enquired',
  'pending',
  e.created_at
from (
  select distinct on (e.person_id) e.person_id, e.id as latest_enquiry_id
  from public.enquiries e
  join public.orders o on o.id = e.order_id
  where e.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.order_type = 'quote'
    and not exists (
      select 1 from public.jobs j
      where j.person_id = e.person_id
        and j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
        and j.exit_reason is null)
  order by e.person_id, e.created_at desc
) p
join public.enquiries e on e.id = p.latest_enquiry_id
left join public.inbox_conversations c
  on c.external_thread_id = 'enquiry:' || p.latest_enquiry_id::text
 and c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
returning id, person_id, enquiry_id;


-- ============================================================================
-- S4. Backfill, Partition A — persons who already HAVE an active job (1-Aug
-- backfill): repoint that job's enquiry_id at the person's LATEST quote
-- enquiry; stage NOT touched. The "is distinct from" guard makes S4 skip jobs
-- already pointing at the latest enquiry (incl. everything S3 just inserted),
-- so S3/S4 never overlap and the pair is idempotent. Target = the person's
-- most recently created active job.
-- Expected rows: from the S4 dry-run (paste prediction before running).
-- ============================================================================
-- S4 dry-run (read-only; row set = the updates S4 will make):
with latest as (
  select distinct on (e.person_id) e.person_id, e.id as enquiry_id
  from public.enquiries e
  join public.orders o on o.id = e.order_id
  where e.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.order_type = 'quote'
  order by e.person_id, e.created_at desc
),
target_job as (
  select distinct on (j.person_id) j.id as job_id, j.person_id, j.enquiry_id as current_enquiry_id
  from public.jobs j
  join latest l on l.person_id = j.person_id
  where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and j.exit_reason is null
  order by j.person_id, j.created_at desc
)
select t.job_id, t.person_id, t.current_enquiry_id, l.enquiry_id as new_enquiry_id
from target_job t
join latest l on l.person_id = t.person_id
where t.current_enquiry_id is distinct from l.enquiry_id
order by t.person_id;

-- S4 write:
with latest as (
  select distinct on (e.person_id) e.person_id, e.id as enquiry_id
  from public.enquiries e
  join public.orders o on o.id = e.order_id
  where e.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.order_type = 'quote'
  order by e.person_id, e.created_at desc
),
target_job as (
  select distinct on (j.person_id) j.id as job_id, j.person_id, j.enquiry_id as current_enquiry_id
  from public.jobs j
  join latest l on l.person_id = j.person_id
  where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and j.exit_reason is null
  order by j.person_id, j.created_at desc
)
update public.jobs j set
  enquiry_id = l.enquiry_id,
  conversation_id = coalesce(j.conversation_id, c.id)
from target_job t
join latest l on l.person_id = t.person_id
left join public.inbox_conversations c
  on c.external_thread_id = 'enquiry:' || l.enquiry_id::text
 and c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
where j.id = t.job_id
  and j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and t.current_enquiry_id is distinct from l.enquiry_id
returning j.id, j.person_id, j.enquiry_id;


-- ============================================================================
-- S4c. AMENDMENT (decision b, Giorgi 20 Aug — S0 finding: person
-- d4b7a8ac-399c-4cb7-9f81-baf02da35786 carries 4 active jobs, one per
-- comparison-shopping enquiry from the 1-Aug per-enquiry backfill).
-- Collapse duplicates: for any person in the S0 set with >1 active job, exit
-- every active job EXCEPT the keeper — the person's most recently created
-- active job, i.e. the same target_job predicate S4 just repointed.
-- First production use of the exit machinery; 'closed' chosen for superseded
-- duplicates (vocabulary SELECT 20 Aug returned zero rows — no prior
-- convention existed). Sets BOTH exit_reason and exited_at per the
-- jobs_exit_pairs constraint; 'dormant' avoided (would require wake_at).
-- Generic predicate, not hardcoded to one person; S0 evidence bounds the
-- expected rows: 3 (d4b7a8ac's three older jobs).
-- ============================================================================
-- S4c dry-run (read-only; row set = the jobs S4c will exit):
with quote_persons as (
  select distinct o.person_id
  from public.orders o
  where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.order_type = 'quote'
),
keeper as (
  select distinct on (j.person_id) j.person_id, j.id as job_id
  from public.jobs j
  join quote_persons qp on qp.person_id = j.person_id
  where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and j.exit_reason is null
  order by j.person_id, j.created_at desc
)
select j.id, j.person_id, j.stage, j.enquiry_id, j.created_at
from public.jobs j
join keeper k on k.person_id = j.person_id
where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and j.exit_reason is null
  and j.id <> k.job_id
order by j.person_id, j.created_at;

-- S4c write:
with quote_persons as (
  select distinct o.person_id
  from public.orders o
  where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and o.order_type = 'quote'
),
keeper as (
  select distinct on (j.person_id) j.person_id, j.id as job_id
  from public.jobs j
  join quote_persons qp on qp.person_id = j.person_id
  where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and j.exit_reason is null
  order by j.person_id, j.created_at desc
)
update public.jobs j set
  exit_reason = 'closed',
  exited_at = now()
from keeper k
where j.person_id = k.person_id
  and j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and j.exit_reason is null
  and j.id <> k.job_id
returning j.id, j.person_id, j.exit_reason, j.exited_at;


-- ============================================================================
-- S5. Provenance — stamp orders.job_id on quote orders that lack it.
-- S0 evidence (20 Aug): 17 pre-1-Aug stamped orders — not the 20 the 1-Aug
-- file recorded; this dry-run's output supersedes that count as the record.
-- Expected rows: approx. 13 — the S5 dry-run is authoritative.
-- Note: runs after S4c, so the distinct-on active-job pick is unique for
-- multi-job persons by construction.
-- ============================================================================
-- S5 dry-run (read-only):
select o.id, o.order_number, o.person_id, t.job_id
from public.orders o
join (
  select distinct on (j.person_id) j.person_id, j.id as job_id
  from public.jobs j
  where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and j.exit_reason is null
  order by j.person_id, j.created_at desc
) t on t.person_id = o.person_id
where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and o.order_type = 'quote'
  and o.job_id is null
order by o.order_number;

-- S5 write:
update public.orders o set job_id = t.job_id
from (
  select distinct on (j.person_id) j.person_id, j.id as job_id
  from public.jobs j
  where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and j.exit_reason is null
  order by j.person_id, j.created_at desc
) t
where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and o.order_type = 'quote'
  and o.job_id is null
  and o.person_id = t.person_id
returning o.id, o.order_number, o.job_id;


-- ============================================================================
-- S6. Archive the quote orders (archive-don't-drop: rows preserved as the
-- historical quote record; product_config untouched).
-- Expected rows: 30 (exact count from S0).
-- ============================================================================
-- S6 dry-run (read-only):
select count(*) as to_archive
from public.orders
where organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and order_type = 'quote'
  and archived_at is null;

-- S6 write:
update public.orders set archived_at = now()
where organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and order_type = 'quote'
  and archived_at is null
returning id, order_number;


-- ============================================================================
-- S7. FR-008 — null the order_id stamps on the affected conversations. The
-- badge flip must not depend on archive semantics; this also removes dangling
-- references feeding inbox.api.ts message counts.
-- Expected rows: stamped-conversation count from S0.
-- ============================================================================
-- S7 dry-run (read-only):
select c.id, c.person_id, c.order_id
from public.inbox_conversations c
where c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and c.order_id in (
    select o.id from public.orders o
    where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
      and o.order_type = 'quote')
order by c.person_id;

-- S7 write:
update public.inbox_conversations c set order_id = null
where c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and c.order_id in (
    select o.id from public.orders o
    where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
      and o.order_type = 'quote')
returning c.id, c.person_id;


-- ============================================================================
-- S8. READ-BACK SUITE (all read-only; paste every output into the header)
-- ============================================================================
-- a) End-state invariant (SC-002 as corrected by F1): persons violating
--    "has an active job attached to their latest quote enquiry" — expected 0;
--    and distinct persons — expected 23.
select
  (select count(distinct o.person_id)
     from public.orders o
     where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
       and o.order_type = 'quote') as distinct_persons,          -- expected 23
  (select count(*) from (
     select distinct o.person_id
     from public.orders o
     where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
       and o.order_type = 'quote') p
   where not exists (
     select 1 from public.jobs j
     where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
       and j.person_id = p.person_id
       and j.exit_reason is null
       and j.enquiry_id = (
         select e.id from public.enquiries e
         join public.orders o2 on o2.id = e.order_id
         where e.person_id = p.person_id
           and e.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
           and o2.order_type = 'quote'
         order by e.created_at desc limit 1))) as persons_missing_invariant;  -- expected 0

-- b) 0 unarchived quote orders; c) 0 quote orders without job_id:
select
  count(*) filter (where archived_at is null) as unarchived,   -- expected 0
  count(*) filter (where job_id is null)      as job_less      -- expected 0
from public.orders
where organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  and order_type = 'quote';

-- d) 0 conversations stamped with an archived quote-order id (org-wide):
select count(*) as stamped_remaining   -- expected 0
from public.inbox_conversations c
join public.orders o on o.id = c.order_id
where o.order_type = 'quote'
  and o.archived_at is not null;

-- e) Function definition + ACL (same checks as S2 read-back, post-window):
select position('insert into public.orders' in pg_get_functiondef('public.create_quote(jsonb)'::regprocedure)) as orders_insert_pos,  -- expected 0
       position(e'\r' in pg_get_functiondef('public.create_quote(jsonb)'::regprocedure)) as cr_pos;                                   -- expected 0
select proacl from pg_proc where oid = 'public.create_quote(jsonb)'::regprocedure;

-- f) Churchill sanity — counts UNCHANGED vs pre-apply (substitute the real id
--    from CLAUDE.local.md at run time; not committed here by policy):
-- select
--   (select count(*) from public.jobs                where organization_id = '<CHURCHILL_ORG_ID>') as churchill_jobs,
--   (select count(*) from public.orders              where organization_id = '<CHURCHILL_ORG_ID>') as churchill_orders,
--   (select count(*) from public.orders              where organization_id = '<CHURCHILL_ORG_ID>' and archived_at is not null) as churchill_archived,  -- expected 0
--   (select count(*) from public.inbox_conversations where organization_id = '<CHURCHILL_ORG_ID>') as churchill_conversations;

-- g) 0 persons in the S0 set with >1 active job (post-S4c):
select count(*) as multi_job_persons   -- expected 0
from (
  select j.person_id
  from public.jobs j
  where j.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
    and j.exit_reason is null
    and j.person_id in (
      select distinct o.person_id from public.orders o
      where o.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
        and o.order_type = 'quote')
  group by j.person_id
  having count(*) > 1
) m;


-- ============================================================================
-- ROLLBACK MAP (per statement; Dashboard has no wrapping transaction)
--   S1: keep (harmless) or: alter table public.orders drop column archived_at;
--   S2: re-run supabase/migrations/20260819120000_org_scope_create_quote_person_dedupe.sql
--       (restores the order-creating version — the same file that constitutes
--       the documented SearsMelvin revert RISK).
--   S3: delete from public.jobs where id in (<RETURNING ids>);  -- Dashboard/
--       service-role only; jobs has no DELETE policy by design.
--   S4: restore prior (enquiry_id, conversation_id) per job from the dry-run
--       output recorded above.
--   S4c: update public.jobs set exit_reason = null, exited_at = null
--        where id in (<RETURNING ids>);  -- un-exit the 3 collapsed duplicates
--   S5: update public.orders set job_id = null where id in (<RETURNING ids>);
--   S6: update public.orders set archived_at = null where id in (<RETURNING ids>);
--   S7: restore order_id per conversation from the S7 dry-run output.
-- ============================================================================
