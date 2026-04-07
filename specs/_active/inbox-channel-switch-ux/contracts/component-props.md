# Component Props (proposed)

Exact names may vary during implementation; behavior must match [ui-contracts.md](./ui-contracts.md).

## `NewConversationModal`

Existing props:

- `open`, `onOpenChange`, `onStart`

**Add (all optional for backward compatibility):**

| Prop | Type | Purpose |
|------|------|---------|
| `initialChannel` | `'email' \| 'whatsapp'` | Pre-select channel when opening from empty state |
| `initialPersonId` | `string \| null` | Pre-select customer |
| `lockChannel` | `boolean` | When true, hide or disable channel switcher |

## `ConversationView`

| Prop | Type | Purpose |
|------|------|---------|
| `emptyChannelContext` | `{ personId: string; channel: 'email' \| 'sms' \| 'whatsapp' } \| null` | Drives empty state when `conversationId` is null |
| `onOpenNewConversation` | `(ctx: { channel: 'email' \| 'whatsapp'; personId: string }) => void` | Opens parent-owned modal |
| `onDismissEmptyContext` | `() => void` | Optional: clear context when user cancels |

## `CustomerConversationView`

| Prop | Type | Purpose |
|------|------|---------|
| `onRequestNewConversation` | `(args: { channel: 'email' \| 'whatsapp'; personId: string }) => void` | Same as Conversations—parent opens modal |

Parent (`UnifiedInboxPage`) owns:

- `newConversationModalOpen`
- Modal prefill props
- `useCreateConversation` success handler clearing context

## `ConversationThread`

| Prop | Type | Purpose |
|------|------|---------|
| `onRequestStartConversation` | `() => void` | Unified mode: fired when user clicks Start conversation (Email/WhatsApp) |
| `pendingChannelWithoutConversation` | `'email' \| 'sms' \| 'whatsapp' \| null` | Optional: simplify banner text—can be derived from `!activeConversationId && selectedChannel` |

Prefer **minimal new props**: parent can pass a single `onRequestStartConversation` that closes over channel + person id from `CustomerConversationView`.
