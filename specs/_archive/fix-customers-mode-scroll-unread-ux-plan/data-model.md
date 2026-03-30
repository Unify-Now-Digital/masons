# Data Model and Derived State

No database schema changes.

## Derived fields

### `CustomerThreadRow`
- Existing:
  - `unreadCount: number`
  - `conversationIds: string[]`
- Add:
  - `hasUnread: boolean` (computed as `unreadCount > 0`)

## Read flow model
- On customer thread open:
  - gather all `conversationIds` for selected `personId`
  - if row `hasUnread`, call existing `markAsRead` mutation with those IDs

## Scroll state model (customers mode only)
- `isNearBottom: boolean`
- `lastMessageKey` or message length/timestamp snapshot
- Auto-scroll trigger:
  - only when new message arrives and `isNearBottom === true`

