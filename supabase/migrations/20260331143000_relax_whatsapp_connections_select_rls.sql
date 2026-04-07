-- Shared workspace WhatsApp status visibility:
-- allow authenticated users to read connected whatsapp_connections rows
-- across users. Write policies remain owner-scoped.

drop policy if exists "Users can select own whatsapp_connections" on public.whatsapp_connections;
create policy "Users can select all whatsapp_connections"
  on public.whatsapp_connections for select to authenticated
  using (true);
