alter table public.inbox_conversations
  add column if not exists enquiry_stage text not null default 'new'
  constraint inbox_conversations_enquiry_stage_check
    check (enquiry_stage in ('new', 'in_progress', 'order_created'));

comment on column public.inbox_conversations.enquiry_stage is
  'Human-driven enquiry triage stage (new | in_progress | order_created). Email rows inherit per-user visibility via user_id; WhatsApp/SMS rows are workshop-shared. order_created is set on order link for audit/query; Enquiries UI shows two board columns only (new, in_progress) — linked rows leave the funnel.';

create index if not exists idx_inbox_conversations_enquiry_pipeline
  on public.inbox_conversations (organization_id, enquiry_stage, last_message_at desc nulls last)
  where status = 'open' and order_id is null;
