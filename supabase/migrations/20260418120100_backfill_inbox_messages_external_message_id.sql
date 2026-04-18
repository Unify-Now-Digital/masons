-- Backfill inbox_messages.external_message_id from meta.gmail.messageId for email rows (Gmail sync dedupe SSOT).

update public.inbox_messages
set external_message_id = meta->'gmail'->>'messageId'
where channel = 'email'
  and external_message_id is null
  and meta->'gmail'->>'messageId' is not null;
