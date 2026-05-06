-- Inquiries pipeline Kanban: single SECURITY DEFINER RPC with membership guard,
-- channel/date filters, computed stage (new | quoted | order_created), flat row shape.

create or replace function public.get_inquiries_pipeline(
  p_organization_id uuid,
  p_channels text[] default null,
  p_from_date timestamptz default null,
  p_to_date timestamptz default null
)
returns table (
  enquiry_id uuid,
  stage text,
  channel text,
  sub_type text,
  created_at timestamptz,
  source_page text,
  message text,
  location text,
  contact_pref text,
  appointment_at timestamptz,
  appointment_kind text,
  details jsonb,
  photo_urls text[],
  order_id uuid,
  person_id uuid,
  person_first_name text,
  person_last_name text,
  person_email text,
  person_phone text,
  linked_quote_id uuid,
  linked_quote_status text,
  linked_quote_total numeric,
  linked_quote_created_at timestamptz,
  linked_order_id uuid,
  linked_order_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_allowed constant text[] := array['contact', 'quote', 'appointment', 'call', 'shortlist'];
begin
  if not public.user_is_member_of_org(p_organization_id) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_channels is not null then
    if cardinality(p_channels) = 0 then
      raise exception 'invalid channel filter'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from unnest(p_channels) ch
      where not (ch = any (v_allowed))
    ) then
      raise exception 'invalid channel filter'
        using errcode = '22023';
    end if;
  end if;

  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'invalid date range'
      using errcode = '22023';
  end if;

  return query
  select
    e.id as enquiry_id,
    (
      case
        when e.order_id is not null then 'order_created'
        when lq.id is not null then 'quoted'
        else 'new'
      end
    )::text as stage,
    e.channel::text as channel,
    e.sub_type::text as sub_type,
    e.created_at as created_at,
    e.source_page::text as source_page,
    e.message::text as message,
    e.location::text as location,
    e.contact_pref::text as contact_pref,
    e.appointment_at as appointment_at,
    e.appointment_kind::text as appointment_kind,
    e.details as details,
    e.photo_urls as photo_urls,
    e.order_id as order_id,
    e.person_id as person_id,
    pe.first_name::text as person_first_name,
    pe.last_name::text as person_last_name,
    pe.email::text as person_email,
    pe.phone::text as person_phone,
    lq.id as linked_quote_id,
    lq.status::text as linked_quote_status,
    lq.total_value::numeric as linked_quote_total,
    lq.created_at as linked_quote_created_at,
    lo.id as linked_order_id,
    lo.status::text as linked_order_status
  from public.enquiries e
  left join public.people pe
    on pe.id = e.person_id
  left join lateral (
    select q.id, q.status, q.total_value, q.created_at
    from public.quotes q
    where q.customer_id = e.person_id
      and q.organization_id = e.organization_id
      and q.created_at >= e.created_at
      and q.status = 'accepted'
    order by q.created_at desc
    limit 1
  ) lq on true
  left join lateral (
    select o.id, o.status
    from public.orders o
    where o.id = e.order_id
      and o.organization_id = e.organization_id
    limit 1
  ) lo on true
  where e.organization_id = p_organization_id
    and (
      p_channels is null
      or e.channel = any (p_channels)
    )
    and (p_from_date is null or e.created_at >= p_from_date)
    and (p_to_date is null or e.created_at <= p_to_date)
  order by e.created_at desc;
end;
$$;

comment on function public.get_inquiries_pipeline(uuid, text[], timestamptz, timestamptz) is
  'Returns enquiries pipeline rows with computed stage and linked quote/order summaries for the Kanban board.';

revoke all on function public.get_inquiries_pipeline(uuid, text[], timestamptz, timestamptz) from public;

grant execute on function public.get_inquiries_pipeline(uuid, text[], timestamptz, timestamptz) to authenticated;

grant execute on function public.get_inquiries_pipeline(uuid, text[], timestamptz, timestamptz) to service_role;
