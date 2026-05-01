-- enquiries → inbox sync
--
-- every web form submission lives in public.enquiries. mirror each new enquiry
-- into inbox_conversations + inbox_messages so the unified inbox is the single
-- render surface for contact, quote, callback, appointment, shortlist and
-- partner-order intakes.

alter table public.inbox_conversations drop constraint inbox_conversations_channel_check;
alter table public.inbox_conversations
  add constraint inbox_conversations_channel_check
  check (channel = any (array['email','sms','whatsapp','web']));

alter table public.inbox_messages drop constraint inbox_messages_channel_check;
alter table public.inbox_messages
  add constraint inbox_messages_channel_check
  check (channel = any (array['email','sms','whatsapp','web']));

alter table public.enquiries drop constraint enquiries_channel_check;
alter table public.enquiries
  add constraint enquiries_channel_check
  check (channel = any (array['quote','contact','appointment','call','shortlist','partner_order']));

create or replace function public.create_inbox_from_enquiry(p_enquiry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  p record;
  v_handle text;
  v_intake_label text;
  v_subject text;
  v_body text;
  v_conversation_id uuid;
begin
  select * into e from public.enquiries where id = p_enquiry_id;
  if not found then
    return null;
  end if;

  select id into v_conversation_id
  from public.inbox_conversations
  where external_thread_id = 'enquiry:' || e.id::text
  limit 1;
  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  select first_name, last_name, email, phone into p
  from public.people where id = e.person_id;

  v_handle := coalesce(nullif(p.email, ''), nullif(p.phone, ''), 'web-form');

  v_intake_label := case e.channel
    when 'quote'         then 'Quote request'
    when 'contact'       then 'Contact form'
    when 'appointment'   then 'Appointment request'
    when 'call'          then 'Callback request'
    when 'shortlist'     then 'Shortlist enquiry'
    when 'partner_order' then 'Partner order'
    else 'Web enquiry'
  end;

  v_subject := v_intake_label || coalesce(' (' || e.sub_type || ')', '');

  v_body := v_intake_label;
  if coalesce(p.first_name, '') <> '' or coalesce(p.last_name, '') <> '' then
    v_body := v_body || E'\nFrom: ' || trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''));
  end if;
  if p.email is not null then
    v_body := v_body || E'\nEmail: ' || p.email;
  end if;
  if p.phone is not null then
    v_body := v_body || E'\nPhone: ' || p.phone;
  end if;
  if e.source_page is not null then
    v_body := v_body || E'\nPage: ' || e.source_page;
  end if;
  if e.location is not null then
    v_body := v_body || E'\nLocation: ' || e.location;
  end if;
  if e.appointment_at is not null then
    v_body := v_body || E'\nAppointment: ' || e.appointment_at::text || coalesce(' (' || e.appointment_kind || ')', '');
  end if;
  if e.contact_pref is not null then
    v_body := v_body || E'\nContact pref: ' || e.contact_pref;
  end if;
  if coalesce(e.message, '') <> '' then
    v_body := v_body || E'\n\n' || e.message;
  end if;

  insert into public.inbox_conversations (
    organization_id, channel, primary_handle, subject, status,
    external_thread_id, last_message_at, last_inbound_at,
    last_message_preview, person_id, link_state, link_meta, order_id, created_at
  ) values (
    e.organization_id, 'web', v_handle, v_subject, 'open',
    'enquiry:' || e.id::text, e.created_at, e.created_at,
    left(coalesce(nullif(e.message, ''), v_intake_label), 200),
    e.person_id,
    case when e.person_id is not null then 'linked' else 'unlinked' end,
    jsonb_build_object(
      'source', 'enquiry',
      'enquiry_id', e.id,
      'enquiry_channel', e.channel,
      'sub_type', e.sub_type,
      'source_page', e.source_page
    ),
    e.order_id, e.created_at
  )
  returning id into v_conversation_id;

  insert into public.inbox_messages (
    organization_id, conversation_id, channel, direction,
    sent_at, from_handle, to_handle, body_text,
    external_message_id, status, meta, created_at
  ) values (
    e.organization_id, v_conversation_id, 'web', 'inbound',
    e.created_at, v_handle, 'inbox', v_body,
    'enquiry:' || e.id::text, 'received',
    jsonb_build_object(
      'source', 'enquiry',
      'enquiry_id', e.id,
      'enquiry_channel', e.channel,
      'sub_type', e.sub_type,
      'source_page', e.source_page,
      'appointment_at', e.appointment_at,
      'appointment_kind', e.appointment_kind,
      'location', e.location,
      'contact_pref', e.contact_pref,
      'photo_urls', e.photo_urls,
      'details', e.details
    ),
    e.created_at
  );

  return v_conversation_id;
end;
$$;

create or replace function public.trg_sync_enquiry_to_inbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_inbox_from_enquiry(new.id);
  return new;
end;
$$;

drop trigger if exists trg_sync_enquiry_to_inbox on public.enquiries;
create trigger trg_sync_enquiry_to_inbox
  after insert on public.enquiries
  for each row execute function public.trg_sync_enquiry_to_inbox();

do $$
declare
  r record;
begin
  for r in select id from public.enquiries order by created_at loop
    perform public.create_inbox_from_enquiry(r.id);
  end loop;
end
$$;
