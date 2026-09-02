-- migration: add search_inbox_conversations rpc (feature/full-name-search C1a)
-- purpose:
--   - inbox search matches the linked person's name via LEFT join to people (FR-001, FR-005)
--   - term reaches sql only as a bound parameter p_q — closes F-027 (FR-007)
-- notes:
--   - SECURITY INVOKER: inbox_conversations RLS (user_is_member_of_org policies) is the
--     boundary; p_organization_id is a filter, not security (AC-002)
--   - Flag 4 ruled 2026-09-03: silent filter (language sql stable); no membership raise —
--     RLS blocks cross-org reads either way, a wrong org id shows as an empty list
--   - filters mirror fetchConversations (inboxConversations.api.ts:26-45) for the filters
--     that co-occur with search: status / channel / unread_only / unlinked_only (plan §1)
--   - search_path pin + revoke/grant copied from 20260423112000 per FR-011 (NOT its
--     DEFINER mode, NOT its unchecked org trust)

create or replace function public.search_inbox_conversations(
  p_organization_id uuid,
  p_q               text,
  p_status          text    default 'open',
  p_channel         text    default null,
  p_unread_only     boolean default false,
  p_unlinked_only   boolean default false
)
returns setof public.inbox_conversations
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
  from public.inbox_conversations as c
  left join public.people as p
    on p.id = c.person_id
  where c.organization_id = p_organization_id
    and c.status = coalesce(p_status, 'open')
    and (p_channel is null or c.channel = p_channel)
    and (p_unread_only is not true or c.unread_count > 0)
    and (p_unlinked_only is not true or c.person_id is null)
    and (
      c.primary_handle ilike '%' || trim(p_q) || '%'
      or c.subject ilike '%' || trim(p_q) || '%'
      or c.last_message_preview ilike '%' || trim(p_q) || '%'
      or concat_ws(' ', p.first_name, p.last_name) ilike '%' || trim(p_q) || '%'
    )
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

revoke all on function public.search_inbox_conversations(uuid, text, text, text, boolean, boolean) from public;
grant execute on function public.search_inbox_conversations(uuid, text, text, text, boolean, boolean) to authenticated;
