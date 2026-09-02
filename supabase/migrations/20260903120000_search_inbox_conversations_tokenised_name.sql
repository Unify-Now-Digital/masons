-- migration: tokenised name matching for search_inbox_conversations (full-name-search, C1a amendment)
-- purpose:
--   - name arm now tokenises p_q: split on non-alphanumerics; every token must appear as a
--     case-insensitive substring of concat_ws(' ', first_name, last_name) — "First Last",
--     "Last, First", doubled separators, and partial tokens ("Bun Rub") all match (FR-001)
--   - handle / subject / last_message_preview arms unchanged: whole-term ILIKE exactly as
--     applied in 20260903001012 — not widened, not narrowed
-- notes:
--   - zero-token guard: bool_and over zero unnested tokens is NULL; the trailing `is true`
--     forces the name arm FALSE for punctuation-only terms — never true-for-all
--   - tokens are alphanumeric-only by construction: no ILIKE metacharacters (%, _) can enter
--     the name arm
--   - create or replace with the identical signature preserves ownership and the applied ACL
--     (authenticated=X; public/anon revoked 20260903001012) — no re-grant statements needed
--   - unlinked rows: concat_ws over two NULLs = '' → name arm false → they still match only
--     via handle/subject/preview (FR-005 left-join guard holds)

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
      or (
        select bool_and(concat_ws(' ', p.first_name, p.last_name) ilike '%' || t.tok || '%')
        from unnest(array_remove(regexp_split_to_array(p_q, '[^[:alnum:]]+'), '')) as t(tok)
      ) is true
    )
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;
