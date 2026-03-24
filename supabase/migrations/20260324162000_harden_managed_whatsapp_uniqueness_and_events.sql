-- Safety precheck: block migration if duplicate managed sender ownership already exists.
-- To inspect duplicates before applying, run:
-- 1) select platform_twilio_account_sid, twilio_sender, count(*) from public.whatsapp_managed_connections
--    where twilio_sender is not null group by 1,2 having count(*) > 1;
-- 2) select platform_twilio_account_sid, display_number, count(*) from public.whatsapp_managed_connections
--    where display_number is not null group by 1,2 having count(*) > 1;

do $$
begin
  if exists (
    select 1
    from public.whatsapp_managed_connections
    where twilio_sender is not null
    group by platform_twilio_account_sid, twilio_sender
    having count(*) > 1
  ) then
    raise exception 'Cannot apply managed WhatsApp uniqueness constraints: duplicate (platform_twilio_account_sid, twilio_sender) rows exist.';
  end if;

  if exists (
    select 1
    from public.whatsapp_managed_connections
    where display_number is not null
    group by platform_twilio_account_sid, display_number
    having count(*) > 1
  ) then
    raise exception 'Cannot apply managed WhatsApp uniqueness constraints: duplicate (platform_twilio_account_sid, display_number) rows exist.';
  end if;
end $$;

create unique index if not exists idx_whatsapp_managed_unique_sender_sid
  on public.whatsapp_managed_connections (platform_twilio_account_sid, twilio_sender)
  where twilio_sender is not null;

create unique index if not exists idx_whatsapp_managed_unique_from_address
  on public.whatsapp_managed_connections (platform_twilio_account_sid, display_number)
  where display_number is not null;

-- Audit integrity hardening: authenticated users can read own events, but cannot forge inserts directly.
drop policy if exists "Users can insert own whatsapp_connection_events" on public.whatsapp_connection_events;
drop policy if exists "Service role can insert whatsapp_connection_events" on public.whatsapp_connection_events;

create policy "Service role can insert whatsapp_connection_events"
  on public.whatsapp_connection_events for insert to service_role
  with check (true);
