# Data model (no schema changes)

This feature uses **existing tables and types only**. No migrations, no new columns, no RLS changes.

## Existing entities

- **inbox_conversations** — `id`, `channel`, `person_id`, `primary_handle`, `subject`, `status`, `last_message_at`, etc. Linking to person is via `person_id`.
- **inbox_messages** — `id`, `conversation_id`, `channel`, `direction`, `from_handle`, `to_handle`, `body_text`, `subject`, `sent_at`, `created_at`, etc.

## Query composition for All timeline

1. **Person → conversation IDs**  
   Use existing `fetchConversations({ status: 'open', person_id: selectedPersonId })` with **no** `channel` filter so we get Email + SMS + WhatsApp conversations for that person. Extract `conversation.id` from the result.

2. **Conversation IDs → messages**  
   Add a **client-only** helper in `src/modules/inbox/api/inboxMessages.api.ts`:
   - `fetchMessagesByConversationIds(conversationIds: string[]): Promise<InboxMessage[]>`
   - Query: `supabase.from('inbox_messages').select('*').in('conversation_id', conversationIds).order('sent_at', { ascending: true })`
   - Returns existing `InboxMessage[]` type. If `conversationIds.length === 0`, return `[]` without calling Supabase (avoid invalid query).

3. **Merge and sort**  
   Server ordering by `sent_at` ascending is sufficient. If needed, client-side sort by `sent_at` (fallback `created_at`) as a safety net.

## Types (unchanged)

- `InboxConversation`, `InboxMessage`, `ConversationFilters` from `src/modules/inbox/types/inbox.types.ts` — use as-is for the new timeline component and hook.
