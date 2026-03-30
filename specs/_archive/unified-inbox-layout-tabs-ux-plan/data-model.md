# Data Model: Unified Inbox Layout & Tabs UX Update

## Scope
**No data model or API changes.** This feature is UI-only (tabs, layout, styling).

## Unchanged
- `inbox_conversations`, `inbox_messages`, `inbox_channel_accounts`
- Conversation filters: `status`, `channel`, `person_id`, `unlinked_only`, `search`; `unread_only` remains in API type but is no longer set by any tab
- `unread_count` on conversations; Mark as Read mutation
- People linking (person_id, link_state, link_meta)
- All existing queries and hooks

## Optional type cleanup (non-blocking)
- `ConversationFilters` in `inbox.types.ts` may retain `unread_only?: boolean` for API compatibility; no requirement to remove it. Only the tab and the branch that sets it are removed.
