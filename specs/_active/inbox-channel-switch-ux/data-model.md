# UI State Model: Inbox Channel Switching UX

No database entities change. This document describes **frontend state** only.

## State: `emptyChannelStartContext` (suggested name)

| Field | Type | Description |
|-------|------|-------------|
| `personId` | `string` | Customer/person to attach the new conversation to (from current conversation before channel switch). |
| `channel` | `'email' \| 'sms' \| 'whatsapp'` | Target channel user selected via Reply via / channel switch. |

**Lifecycle**

- **Set**: When in Conversations tab, user switches to a channel (`handleReplyChannelChange`) and no `inbox_conversations` row exists for `(person_id, channel)`.
- **Clear**: User picks a conversation from the list; successful `NewConversationStart`; user switches to a channel that has an existing thread.

## State: Modal prefill (optional)

| Field | Type | Description |
|-------|------|-------------|
| `defaultChannel` | `'email' \| 'whatsapp'` | Modal channel (SMS not in modal). |
| `defaultPersonId` | `string \| null` | Pre-select customer row. |
| `channelLocked` | `boolean` | Hide channel toggles when opening from fixed empty-state channel. |

## State: `ConversationThread` (existing + behavior)

| Concept | Description |
|---------|-------------|
| `selectedChannel` | User-selected reply channel in unified mode. |
| `activeConversationId` | From `conversationIdByChannel[selectedChannel]` or single `conversationId`. |
| `replyMode` | `'freeform' \| 'template'` — for WhatsApp, default to `template` when thread is new per research heuristic. |

## Validation rules (email)

- **New email conversation** (modal): `subject` trimmed length > 0 required before submit.

## Relationships

- `emptyChannelStartContext.personId` → same as `persons.id` used by `createConversation` payload `person_id`.
- After insert, new `inbox_conversations.id` becomes `selectedConversationId` (Conversations) or updates `conversationIdByChannel` (Customers) via React Query invalidation.
