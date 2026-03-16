-- Canonical backfill for Inbox email → customers linking (v2).
-- Idempotent and deterministic; safe to run multiple times.

-- Ensure supporting index exists for case-insensitive email lookups.
create index if not exists customers_email_lower_idx
  on public.customers (lower(email));

-- Backfill conversations with exactly one matching customer by normalized email.
with normalized_customers as (
  select
    id,
    lower(trim(email)) as norm_email
  from public.customers
  where email is not null
),
email_candidates as (
  select
    c.id as conversation_id,
    nc.id as customer_id
  from public.inbox_conversations c
  join normalized_customers nc
    on lower(trim(c.primary_handle)) = nc.norm_email
  where
    c.channel = 'email'
    and c.person_id is null
),
unique_matches as (
  -- Conversations with exactly one matching customer.
  -- Use array_agg(...)[1] instead of min() to avoid type issues on some setups.
  select
    conversation_id,
    (array_agg(customer_id))[1] as customer_id
  from email_candidates
  group by conversation_id
  having count(*) = 1
),
ambiguous_matches as (
  -- Conversations with more than one matching customer.
  select
    conversation_id,
    array_agg(customer_id) as customer_ids
  from email_candidates
  group by conversation_id
  having count(*) > 1
)
-- 1) Link conversations with exactly one matching customer.
update public.inbox_conversations c
set
  person_id = u.customer_id,
  link_state = 'linked',
  link_meta = coalesce(c.link_meta, '{}'::jsonb)
              || jsonb_build_object('matched_on', 'email')
from unique_matches u
where c.id = u.conversation_id
  and c.person_id is null;

-- 2) Mark ambiguous conversations where multiple customers share the same email.
with normalized_customers as (
  select
    id,
    lower(trim(email)) as norm_email
  from public.customers
  where email is not null
),
email_candidates as (
  select
    c.id as conversation_id,
    nc.id as customer_id
  from public.inbox_conversations c
  join normalized_customers nc
    on lower(trim(c.primary_handle)) = nc.norm_email
  where
    c.channel = 'email'
    and c.person_id is null
),
ambiguous_matches as (
  select
    conversation_id,
    array_agg(customer_id) as customer_ids
  from email_candidates
  group by conversation_id
  having count(*) > 1
)
update public.inbox_conversations c
set
  person_id = null,
  link_state = 'ambiguous',
  link_meta = coalesce(c.link_meta, '{}'::jsonb)
              || jsonb_build_object(
                   'matched_on', 'email',
                   'candidates', a.customer_ids
                 )
from ambiguous_matches a
where c.id = a.conversation_id
  and c.person_id is null;

