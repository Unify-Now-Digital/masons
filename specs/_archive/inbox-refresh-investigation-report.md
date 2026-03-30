# Inbox refresh investigation report

## Exact query/hook chain used by the visible UI

| UI element | Hook | Query key | File:line |
|------------|------|-----------|-----------|
| **Conversation list** (left column) | `useConversationsList(filters)` | `['inbox','conversations','list',filters]` | UnifiedInboxPage.tsx:77 |
| **Open thread messages** (right panel) | `useMessagesByConversation(conversationId)` | `['inbox','messages','conversation',id]` | ConversationView.tsx:20 → useInboxMessages.ts |

- The list is rendered from `conversations` (line 399); no other query feeds it.
- The thread is rendered from `messages` in ConversationView (line 69), which comes from `useMessagesByConversation`.

**Conclusion:** The recently changed hooks (`useConversationsList`, `useMessagesByConversation`) are the ones powering the visible UI.

---

## Is 4s polling actually running?

- Both hooks have `refetchInterval: 4000`.
- **Issue:** React Query does **not** run `refetchInterval` when the tab is in the background (default `refetchIntervalInBackground: false`). If the user switches tabs or minimizes the window, polling stops until they return.

**Change applied:** Set `refetchIntervalInBackground: true` on both hooks so polling continues when the tab is not focused.

**Debug logs added (DEV only):** In the `queryFn` of both hooks, a `console.log` runs on each refetch so you can confirm in the browser console that refetches occur every ~4s.

---

## Realtime subscription

**Location:** UnifiedInboxPage.tsx lines 156–199.

- **Listens to:** `postgres_changes` on `public.inbox_messages`, `event: 'INSERT'`.
- **On event:** Pushes `payload.new.conversation_id` into a ref, then after 200ms debounce invalidates:
  - `inboxKeys.conversations.all` (all conversation queries, including the list),
  - `inboxKeys.messages.byConversation(conversationId)` for each affected conversation.

So when Realtime fires for a webhook-created `inbox_messages` row, it should invalidate the list and the open thread and trigger a refetch.

**Why it might not fire:** Supabase Realtime only sends events for tables in the **`supabase_realtime`** publication. There is **no migration** in this repo that adds `inbox_messages` to that publication. If it was never enabled in the Supabase Dashboard (Database → Replication), the client will never receive INSERT events, so Realtime will not run and the UI will only update via polling or refetch-on-focus.

---

## Thread list dependency

The visible conversation list does **not** depend on a different query or a memoized selector that avoids invalidation. It is exactly `conversations` from `useConversationsList(filters)`.

---

## Minimal code change to make new inbound WhatsApp messages appear within a few seconds

1. **Already done:** `refetchIntervalInBackground: true` on both `useConversationsList` and `useMessagesByConversation` so 4s polling continues when the tab is in the background.
2. **Optional (if you want Realtime as well):** Enable Realtime for `inbox_messages` in the Supabase Dashboard (Database → Replication → add `inbox_messages` to the publication), or add a migration:
   ```sql
   alter publication supabase_realtime add table public.inbox_messages;
   ```
3. **Verify:** With dev server running, open the Unified Inbox, open DevTools console, and confirm you see `[inbox] useConversationsList refetch` and (when a thread is open) `[inbox] useMessagesByConversation refetch` about every 4 seconds. If Realtime is enabled and a message is inserted, you should also see `[inbox] Realtime inbox_messages INSERT`.

Remove the temporary `console.log` calls once you are satisfied with behavior.
