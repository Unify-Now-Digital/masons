# Data Model and Transform Layer

No schema changes. Reuse existing entities:
- `inbox_conversations` (source for conversation/channel/person linkage and unread counts)
- `inbox_messages` (source for timeline and outbound persistence)

## New frontend types/selectors

## `CustomerThreadRow` (UI aggregate)
- `personId: string`
- `displayName: string`
- `latestMessageAt: string | null`
- `latestPreview: string | null`
- `unreadCount: number` (sum across person conversations)
- `channels: ('email' | 'sms' | 'whatsapp')[]`
- `latestConversationIdByChannel: Record<'email' | 'sms' | 'whatsapp', string | null>`
- `defaultReplyChannel: 'email' | 'sms' | 'whatsapp'` (latest inbound channel fallback)

## `CustomerThreadMessage` (timeline row)
- Reuse `InboxMessage` with optional display metadata:
  - `channelLabel`
  - `displayTimestamp`
  - `isInbound`

## New hooks/selectors

## `useCustomerThreads(filters)`
- Input: existing list/search filters + channel filter context.
- Source: `useConversationsList(baseFilters)` (all channels for same filter context).
- Transform:
  1. exclude rows with `person_id == null` (unlinked excluded in customer mode)
  2. group by `person_id`
  3. aggregate:
     - unread sum
     - latest preview/timestamp across all grouped conversations
     - latest conversation per channel for send routing
  4. sort customer rows by `latestMessageAt DESC`, fallback stable by `personId`

## `useCustomerMessages(personId)`
- Thin alias over `usePersonUnifiedTimeline(personId)` for feature clarity.
- Returns mixed messages across email/sms/whatsapp sorted chronologically.

## `buildConversationIdByChannel(conversations, messages)`
- Compute latest active `conversation_id` per channel.
- Preference order:
  1. latest message-backed conversation in channel
  2. fallback to latest `inbox_conversations.last_message_at` in channel

## Ordering and dedupe rules

- Fetch ordered by `sent_at ASC`.
- Apply final client stable sort key:
  1. `sent_at` (or `created_at` when null)
  2. `created_at`
  3. `id`
- Dedupe by `message.id` as defensive guard.

