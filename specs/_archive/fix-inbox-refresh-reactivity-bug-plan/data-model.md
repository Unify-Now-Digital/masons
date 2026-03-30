# Data Model and Query Key Model

## Database model
- No schema changes.
- Source-of-truth remains:
  - `inbox_conversations`
  - `inbox_messages`

## Canonical query keys

Use `inboxKeys` as the single registry:

- Conversations
  - `inboxKeys.conversations.all`
  - `inboxKeys.conversations.lists(filters)`
  - `inboxKeys.conversations.detail(id)`

- Messages
  - `inboxKeys.messages.byConversation(id)`
  - `inboxKeys.messages.personTimeline(personId, conversationIds)`

- Customer threads/messages
  - Customer thread list is **derived** from conversations lists (no separate remote key required).
  - Customer mixed timeline uses `personTimeline` (no custom ad-hoc key).

## Invalidation fan-out model

On inbound/outbound update:
- Always invalidate `inboxKeys.conversations.all`
- Always invalidate `['inbox', 'messages']`

Optional targeted invalidation:
- `inboxKeys.messages.byConversation(conversationId)` for immediate local thread responsiveness.

