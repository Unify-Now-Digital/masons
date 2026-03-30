## Quickstart / Execution Notes

1) **Auto-mark read on open**
- Locate the existing Unified Inbox page and selection logic (`UnifiedInboxPage.tsx`).
- When `selectedConversationId` changes:
  - Look up the selected conversation from the conversations query cache.
  - If `unread_count > 0` and the channel is Email/SMS/WhatsApp, call the existing mark-as-read mutation.
  - Apply an optimistic cache update to set `unread_count = 0` for that conversation across all relevant queries.

2) **Read/Unread toggle button**
- Replace the current one-way “Mark as Read” toolbar action with a dynamic button:
  - If the selected conversation has `unread_count > 0`, show **“Mark as Read”** and call the read mutation.
  - If the selected conversation has `unread_count === 0`, show **“Mark as Unread”** and call a new mark-as-unread mutation.
- Implement the mark-as-unread mutation in the inbox API/hooks layer:
  - For a count-only model, set `unread_count = 1`.
  - Mirror optimistic cache patterns and error handling used by mark-as-read.

3) **Guardrails**
- Only fire auto mark-as-read when transitioning from unread → read:
  - Guard on `unread_count > 0` and avoid re-firing for a conversation that is already read in cache.
- Ensure React Query cache updates keep All + channel-specific tabs in sync.
- Use existing toast/error patterns if a mutation fails; rollback or refetch conversations as appropriate.

