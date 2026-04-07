-- Shared inbox read access for workspace users.
-- Keep write/update/delete policies unchanged.

drop policy if exists "Users can select own inbox_conversations" on public.inbox_conversations;
create policy "Users can select all inbox_conversations"
  on public.inbox_conversations for select to authenticated
  using (true);

drop policy if exists "Users can select own inbox_messages" on public.inbox_messages;
create policy "Users can select all inbox_messages"
  on public.inbox_messages for select to authenticated
  using (true);
