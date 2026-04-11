-- Expose member list with email + display name for org admins (joins auth.users; callable only when caller is org member)

create or replace function public.get_organization_members_with_identity(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  email text,
  display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_is_member_of_org(p_organization_id) then
    return;
  end if;

  return query
  select
    m.id,
    m.organization_id,
    m.user_id,
    m.role::text,
    m.created_at,
    u.email::text,
    (
      coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(u.raw_user_meta_data ->> 'name'), '')
      )
    )::text as display_name
  from public.organization_members m
  inner join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
  order by m.created_at asc;
end;
$$;

grant execute on function public.get_organization_members_with_identity(uuid) to authenticated;

comment on function public.get_organization_members_with_identity(uuid) is
  'Organisation members with email and display name from auth.users; returns nothing if caller is not a member.';
