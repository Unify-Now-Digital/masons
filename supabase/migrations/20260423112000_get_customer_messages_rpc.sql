-- migration: add get_customer_messages rpc for customer timeline reads
-- purpose:
--   - eliminate customer timeline waterfall (conversations -> messages)
--   - return timeline messages in a single rpc call scoped by person + organization
-- notes:
--   - security definer is intentional so the rpc can serve a narrow, controlled read path
--   - function remains read-only and stable

create or replace function public.get_customer_messages(
  p_person_id uuid,
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
  where c.person_id = p_person_id
    and c.organization_id = p_organization_id
  order by coalesce(m.sent_at, m.created_at) asc, m.created_at asc, m.id asc;
$$;

revoke all on function public.get_customer_messages(uuid, uuid) from public;
grant execute on function public.get_customer_messages(uuid, uuid) to authenticated;
