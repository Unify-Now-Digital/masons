-- create_quote: store web attribution sent by the website form (approved 15 Oct 2026).
-- Backward compatible: every new payload key is optional; callers that don't send
-- them behave exactly as before (lead_source still recorded as 'Web form').
-- Body is the live definition (15 Oct 2026) plus the attribution fields.
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
  -- attribution (optional)
  v_utm_source   text := left(nullif(payload->>'utm_source', ''), 255);
  v_utm_medium   text := left(nullif(payload->>'utm_medium', ''), 255);
  v_utm_campaign text := left(nullif(payload->>'utm_campaign', ''), 255);
  v_utm_term     text := left(nullif(payload->>'utm_term', ''), 255);
  v_utm_content  text := left(nullif(payload->>'utm_content', ''), 255);
  v_gclid        text := left(nullif(payload->>'gclid', ''), 512);
  v_gbraid       text := left(nullif(payload->>'gbraid', ''), 512);
  v_wbraid       text := left(nullif(payload->>'wbraid', ''), 512);
  v_landing_page text := left(nullif(payload->>'landing_page', ''), 2048);
  v_lead_source  text := left(nullif(payload->>'lead_source', ''), 64);
  v_person_id   public.people.id%type;
  v_job_id      public.jobs.id%type;
  v_enq_id      public.enquiries.id%type;
  v_cemetery_id public.cemeteries.id%type;
begin
  if v_email is null or v_email = '' then
    raise exception 'create_quote: email is required';
  end if;

  if v_lead_source is null then
    v_lead_source := case
      when coalesce(v_gclid, v_gbraid, v_wbraid) is not null then 'Google Ads'
      when v_utm_source ~* '^google$' and v_utm_medium ~* '^(cpc|ppc|paid)' then 'Google Ads'
      else 'Web form'
    end;
  end if;

  -- edit_token is echoed in the return for worker compatibility but is no
  -- longer persisted anywhere (no orders row; capture trigger starved).
  if v_edit_token is null then
    v_edit_token := encode(extensions.gen_random_bytes(24), 'hex');
  end if;

  -- 1. Person upsert (dedupe by org-scoped email — people_org_email_key).
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
    insert into public.jobs (organization_id, person_id, source, stage, stage_status, lead_source)
    values (v_org, v_person_id, 'website', 'enquired', 'uncontacted', v_lead_source)
    returning id into v_job_id;
  end if;

  -- 4. Enquiry — CRM record; NO order_id (quotes no longer create orders).
  insert into public.enquiries (
    organization_id, person_id, channel, source_page, message,
    location, cemetery_id, details,
    lead_source, landing_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    gclid, gbraid, wbraid
  ) values (
    v_org, v_person_id, 'quote', v_source_page, v_message,
    v_location, v_cemetery_id, v_product,
    v_lead_source, v_landing_page, v_utm_source, v_utm_medium, v_utm_campaign, v_utm_term, v_utm_content,
    v_gclid, v_gbraid, v_wbraid
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

  return jsonb_build_object(
    'person_id',  v_person_id,
    'order_id',   null,
    'enquiry_id', v_enq_id,
    'edit_token', v_edit_token,
    'job_id',     v_job_id
  );
end;
$function$;

-- Grants unchanged (create or replace keeps them): postgres, service_role only.
