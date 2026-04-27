-- ============================================================
-- Migration: enquiry_link_and_extraction
-- Purpose: enable the Enquiry Triage page by (a) letting an inbox
--          conversation point at the order it spawned, and
--          (b) persisting AI-extracted draft-order fields per
--          conversation in a typed table.
-- ============================================================

-- 1. Conversation → Order link (nullable FK). Keep the existing
--    person_id linkage; this simply adds the parallel order_id path.
alter table public.inbox_conversations
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists idx_inbox_conversations_order_id
  on public.inbox_conversations (order_id);

-- 2. Enquiry extraction cache (one row per conversation, latest value)
create table if not exists public.inbox_enquiry_extraction (
  conversation_id uuid primary key references public.inbox_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_type text check (order_type in (
    'new_memorial',
    'additional_inscription',
    'trade',
    'status_query',
    'quote'
  )),
  customer_name text,
  customer_phone text,
  cemetery_text text,
  product_text text,
  inscription_text text,
  linked_order_id uuid references public.orders(id) on delete set null,
  confidence int check (confidence between 0 and 100),
  flags text[] not null default '{}',
  model text,
  model_meta jsonb,
  extracted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inbox_enquiry_extraction_org
  on public.inbox_enquiry_extraction (organization_id);

create index if not exists idx_inbox_enquiry_extraction_linked_order
  on public.inbox_enquiry_extraction (linked_order_id)
  where linked_order_id is not null;

alter table public.inbox_enquiry_extraction enable row level security;

create policy "Allow read access to inbox_enquiry_extraction in same org"
  on public.inbox_enquiry_extraction
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

create policy "Allow write access to inbox_enquiry_extraction in same org"
  on public.inbox_enquiry_extraction
  for all
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  )
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

create trigger update_inbox_enquiry_extraction_updated_at
  before update on public.inbox_enquiry_extraction
  for each row execute function public.update_updated_at_column();
