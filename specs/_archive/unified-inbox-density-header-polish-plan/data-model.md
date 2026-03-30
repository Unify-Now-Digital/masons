# Data Model: Unified Inbox Density & Header Polish

## Scope
**No data model, API, or query changes.** This feature is UI-only (styling and layout polish).

## Unchanged
- `inbox_conversations`, `inbox_messages`, linking fields (`person_id`, `link_state`, `link_meta`)
- All filters, hooks, and mutations (useConversationsList, useConversation, useMarkAsRead, etc.)
- Unread count and badge display logic
- Link/unlink behavior; only the **presentation** of link state (banner → pill) and header layout change
