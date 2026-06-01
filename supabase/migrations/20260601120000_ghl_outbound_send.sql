-- GHL Inbox Phase 2: outbound send feature flag + idempotency metadata (011-ghl-inbox-outbound)
-- No message bodies stored; idempotency rows track send attempt metadata only.

alter table public.ghl_connections
  add column if not exists outbound_enabled boolean not null default false;

comment on column public.ghl_connections.outbound_enabled is
  'When true, org members may send outbound GHL messages via ghl-send-message Edge Function.';

create table if not exists public.ghl_send_idempotency (
  request_id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id text not null,
  contact_id text not null,
  channel_type text not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  ghl_message_id text,
  ghl_conversation_id text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.ghl_send_idempotency is
  'Deduplication metadata for GHL outbound sends; service_role only via Edge Functions.';

create index if not exists ghl_send_idempotency_org_created_idx
  on public.ghl_send_idempotency (organization_id, created_at desc);

alter table public.ghl_send_idempotency enable row level security;

-- Post-apply (operator): NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';