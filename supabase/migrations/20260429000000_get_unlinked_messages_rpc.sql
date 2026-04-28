create or replace function public.get_unlinked_messages(
  p_channel text,
  p_handle  text,
  p_organization_id uuid
)
returns setof public.inbox_messages
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.inbox_messages as m
  join public.inbox_conversations as c
    on c.id = m.conversation_id
  where c.organization_id = p_organization_id
    and c.channel        = p_channel
    and c.primary_handle = p_handle
    and c.person_id      is null
  order by coalesce(m.sent_at, m.created_at) asc, m.created_at asc, m.id asc;
$$;

revoke all on function public.get_unlinked_messages(text, text, uuid) from public;
grant execute on function public.get_unlinked_messages(text, text, uuid) to authenticated;
