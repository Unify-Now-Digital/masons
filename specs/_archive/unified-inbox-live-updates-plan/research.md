# Research: Unified Inbox Live Updates

## Realtime subscription scope and filter

- **Table:** `public.inbox_messages` only (one subscription at page level).
- **Events:** `INSERT` (required). Optionally `UPDATE` if message edits are supported later.
- **Filter column:** The codebase has a legacy `messages` table with `company_id` (see `20251217050118_add_company_id_to_messages.sql`). The **inbox** tables `inbox_messages` and `inbox_conversations` are not altered for `company_id` in existing migrations; `InboxMessage` in `src/modules/inbox/types/inbox.types.ts` does not include `company_id`.  
  **Decision:** Before implementing, confirm in Supabase Dashboard (or DB schema) whether `inbox_messages` has a tenant column:
  - If **company_id** exists on `inbox_messages`: use Realtime filter `filter: 'company_id=eq.<current_company_id>'` (obtain current company from app context/session) so only relevant rows are received.
  - If **org_id** exists: use `filter: 'org_id=eq.<current_org_id>'`.
  - If **no tenant column**: subscribe without a row filter; RLS still applies to the payloads the client receives, so only rows the user is allowed to see will be broadcast. Document that RLS policies on `inbox_messages` must be correct for multi-tenant safety.

## Gmail auto-sync strategy

- **Preferred (A): Supabase scheduled Edge Function**  
  Use Supabase Cron (or equivalent) to invoke `inbox-gmail-sync` every 60 seconds. No frontend timer; only remove the "Sync Email" button and document the schedule. If the project does not yet use Supabase Cron, add a minimal cron trigger that POSTs to the Edge Function URL with the same auth headers the client uses (or a service role). Document in `specs/unified-inbox-live-updates-plan/` or README how to enable and the schedule (e.g. `*/1 * * * *` for every minute, or every 60s via pg_cron / Supabase scheduled invocations).

- **Fallback (B): Client-side 60s polling**  
  If server-side scheduling is not available: in `UnifiedInboxPage`, start a `setInterval` (60_000 ms) that calls `syncGmail()` while the page is mounted. On success, invalidate the same React Query keys as the Realtime handler (see tasks). Clear the interval on unmount. Run polling regardless of tab (All vs Email) so that when the user switches to Email, data is already fresh; alternatively restrict to when `activeTab === 'email' || activeTab === 'all'` to save requests.

## React Query keys (confirmed from codebase)

Defined in `src/modules/inbox/hooks/useInboxConversations.ts`:

```ts
export const inboxKeys = {
  conversations: {
    all: ['inbox', 'conversations'] as const,
    lists: (filters?: ConversationFilters) => ['inbox', 'conversations', 'list', filters] as const,
    detail: (id: string) => ['inbox', 'conversations', id] as const,
  },
  messages: {
    byConversation: (id: string) => ['inbox', 'messages', 'conversation', id] as const,
    personTimeline: (personId: string, conversationIds: string[]) =>
      ['inbox', 'messages', 'personTimeline', personId, conversationIds] as const,
  },
  channels: {
    all: ['inbox', 'channels'] as const,
  },
};
```

**Usage:**  
- List: `inboxKeys.conversations.lists(filters)` (used by `useConversationsList`).  
- Invalidation: existing code uses `inboxKeys.conversations.all` for broad invalidation (e.g. after sync, mark read, archive).  
- Messages: `inboxKeys.messages.byConversation(conversationId)` (used by `useMessagesByConversation`).  

**Realtime handler:** Invalidate with `queryKey: inboxKeys.conversations.all` and `queryKey: inboxKeys.messages.byConversation(conversationId)` (from payload). Do not patch cache; invalidate only so React Query refetches.

## Debounce

Realtime can emit many events in a short time (e.g. bulk sync). Use a short debounce (e.g. 300–500 ms) before running invalidation so multiple INSERTs result in one or few refetches. Implement in the Realtime callback (e.g. collect `conversation_id`s in a Set, then after debounce invalidate `conversations.all` once and each `messages.byConversation(id)` for the collected ids).

## Constraints (from user)

- Subscribe **once** at `UnifiedInboxPage` level; do **not** subscribe inside conversation or message components.
- Realtime handler must **only invalidate queries** (no direct state patch); use debounce as above.
- Preserve existing **scroll guard** and **auto-read prevention** logic in `UnifiedInboxPage` and `ConversationView`; do not change them.
