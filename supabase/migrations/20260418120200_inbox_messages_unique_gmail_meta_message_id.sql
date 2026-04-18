-- Bridge unique index: Gmail message id in JSON meta (with connection) for email rows.
-- Application dedupe uses external_message_id (see quickstart / T011); this enforces DB-level uniqueness when meta is populated.

create unique index if not exists idx_inbox_messages_email_gmail_connection_meta_message_id
  on public.inbox_messages (gmail_connection_id, ((meta->'gmail'->>'messageId')))
  where channel = 'email'
    and gmail_connection_id is not null
    and (meta->'gmail'->>'messageId') is not null;

comment on index public.idx_inbox_messages_email_gmail_connection_meta_message_id is
  'Uniqueness bridge for Gmail API message id in meta (email + gmail_connection_id); pairs with external_message_id SSOT in app code.';
