-- Index to support case-insensitive email lookups on customers.email
create index if not exists customers_email_lower_idx
  on public.customers (lower(email));

-- Backfill inbox_conversations where channel='email' and person_id is null
-- Match lower(trim(primary_handle)) = lower(trim(customers.email))
-- Set person_id to customers.id, link_state='linked', and merge link_meta.matched_on='email'
update public.inbox_conversations c
set
  person_id = cust.id,
  link_state = 'linked',
  link_meta = coalesce(c.link_meta, '{}'::jsonb)
              || jsonb_build_object('matched_on', 'email')
from public.customers cust
where
  c.channel = 'email'
  and c.person_id is null
  and lower(trim(c.primary_handle)) = lower(trim(cust.email));

