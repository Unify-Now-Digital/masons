alter table public.inbox_messages
  add column if not exists body_html text null;

comment on column public.inbox_messages.body_html is
  'Optional HTML body for email messages (sanitized at render time).';
