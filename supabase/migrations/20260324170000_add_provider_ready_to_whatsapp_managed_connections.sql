alter table public.whatsapp_managed_connections
  add column if not exists provider_ready boolean not null default false;

-- Safe backfill:
-- If a row is already connected and has concrete sender identity, mark provider_ready true.
update public.whatsapp_managed_connections
set provider_ready = true
where state = 'connected'
  and twilio_sender is not null
  and display_number is not null;
