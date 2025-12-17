-- Migration: Add company_id column to messages table
-- Purpose: Allow messages to be associated with a company for multi-tenant filtering
-- Note: companies table does not exist yet, so foreign key constraint is deferred
-- Date: 2025-12-17

-- Add company_id column to messages table (without foreign key constraint)
-- Note: Foreign key constraint will be added when companies table is created
alter table public.messages
  add column company_id uuid;

-- Create index for query performance on company_id lookups
create index if not exists idx_messages_company_id on public.messages(company_id);

-- Add comment to document the column purpose
comment on column public.messages.company_id is 'References the company that owns this message. Nullable. Foreign key constraint to be added when companies table exists.';

