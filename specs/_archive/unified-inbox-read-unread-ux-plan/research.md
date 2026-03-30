## Research / Inventory

- **Existing patterns to mirror**
  - Unified Inbox selection + side panel behavior (`UnifiedInboxPage`, `ConversationView`) for how `selectedConversationId` is driven.
  - Existing inbox “Mark as Read” mutation flow (API + React Query cache updates) to reuse for the new auto-read behavior.
  - React Query optimistic update patterns from nearby inbox or orders/invoicing modules (for consistent cache manipulation + error rollback).
- **Data assumptions**
  - Conversation unread state is exposed in the frontend as `unread_count` on each conversation.
  - An existing API/mutation already marks conversations as read; we should extend or wrap this rather than invent a new semantics.
  - No schema changes are allowed for this feature; we operate entirely within the current model.
- **Interaction patterns**
  - Selecting a conversation in the list sets `selectedConversationId` and loads messages but currently does not clear unread.
  - A toolbar/header button labeled “Mark as Read” exists and only supports unread → read.
  - Unread badges and tab-level counts are driven by conversation-level `unread_count`.

