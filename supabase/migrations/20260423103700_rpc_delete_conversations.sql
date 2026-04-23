-- RPC: bulk delete conversations (hard delete) for authorized org members.

create or replace function public.delete_conversations(p_conversation_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_ids uuid[];
  v_ids_len integer;
  v_distinct_len integer;
  v_deleted_count integer := 0;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Must be authenticated to delete conversations'
      using errcode = '28000';
  end if;

  v_ids := coalesce(p_conversation_ids, '{}'::uuid[]);
  v_ids_len := coalesce(array_length(v_ids, 1), 0);

  if v_ids_len = 0 then
    raise exception 'At least one conversation id is required'
      using errcode = 'P0001';
  end if;

  if v_ids_len > 50 then
    raise exception 'Cannot delete more than 50 conversations at once'
      using errcode = 'P0001';
  end if;

  select count(distinct t.id)::integer
    into v_distinct_len
    from unnest(v_ids) as t(id);

  if v_distinct_len <> v_ids_len then
    raise exception 'Conversation id list contains duplicates'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as t(id)
    left join public.inbox_conversations c on c.id = t.id
    where c.id is null
  ) then
    raise exception 'One or more conversations were not found'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.inbox_conversations c
    where c.id = any(v_ids)
      and not (select public.user_is_member_of_org(c.organization_id))
  ) then
    raise exception 'Cannot delete conversations outside your organisation access'
      using errcode = '42501';
  end if;

  delete from public.inbox_conversations c
  where c.id = any(v_ids);

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

comment on function public.delete_conversations(uuid[]) is
  'Member-scoped hard delete of up to 50 conversations; dependent message cleanup is handled by FK cascades.';

revoke all on function public.delete_conversations(uuid[]) from public;
grant execute on function public.delete_conversations(uuid[]) to authenticated;
