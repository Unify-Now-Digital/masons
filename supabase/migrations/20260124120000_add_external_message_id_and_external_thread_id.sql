-- Add external_message_id and external_thread_id for Twilio SMS Inbox
-- Purpose: Idempotent inbound webhook dedupe (MessageSid) and SMS conversation identity (From|To).
-- Affected: public.inbox_messages, public.inbox_conversations.
-- Additive only; existing rows unchanged.

-- inbox_messages: external id for provider deduplication (e.g. twilio:MessageSid)
alter table public.inbox_messages
  add column if not exists external_message_id text;

comment on column public.inbox_messages.external_message_id is 'Provider-scoped message id for idempotent dedupe (e.g. twilio:MessageSid).';

-- Unique partial index: at most one row per external_message_id when set
create unique index if not exists idx_inbox_messages_external_message_id
  on public.inbox_messages (external_message_id)
  where external_message_id is not null;

comment on index public.idx_inbox_messages_external_message_id is 'Enforce dedupe by external_message_id for inbound webhooks (Twilio retries).';

-- inbox_conversations: external thread id for SMS find-or-create (canonical From|To)
alter table public.inbox_conversations
  add column if not exists external_thread_id text;

comment on column public.inbox_conversations.external_thread_id is 'Provider-scoped thread id for SMS find-or-create (e.g. canonical From|To).';

-- Partial index for fast lookup by channel + external_thread_id
create index if not exists idx_inbox_conversations_external_thread_id
  on public.inbox_conversations (channel, external_thread_id)
  where external_thread_id is not null;

comment on index public.idx_inbox_conversations_external_thread_id is 'Fast find-or-create by channel and external_thread_id for SMS.';
