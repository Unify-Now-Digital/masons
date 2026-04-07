# Data Model: WhatsApp 24-Hour Composer Session

No database or API schema changes. All concepts are **derived in the client** from existing `InboxMessage` rows.

## Derived values (ConversationThread)

| Name | Description |
|------|-------------|
| **Scoped WhatsApp inbound messages** | Filter of `messages` where `conversation_id === activeConversationId`, `channel === 'whatsapp'`, `direction === 'inbound'`. |
| **Last inbound WhatsApp (session)** | Row with max `sent_at` (tie-break `created_at` if needed) among scoped inbound messages; `null` if none. |
| **isWhatsAppSessionClosed** | `true` when `activeChannel === 'whatsapp'` and (no `activeConversationId` OR no last inbound OR last inbound older than 24 hours from now). `false` otherwise. |

## State transitions (UI)

| Condition | Banner | Toggle | Default `replyMode` |
|-----------|--------|--------|---------------------|
| WhatsApp, session **open** | Hidden | Shown | User choice (freeform or template) |
| WhatsApp, session **closed** | Shown | Hidden | Forced to template (effect) |
| Not WhatsApp | Hidden | Hidden (no WA template UI) | Freeform (existing effect) |

## Inputs (existing types)

- **`InboxMessage`**: `conversation_id`, `channel`, `direction`, `sent_at`, `created_at` — unchanged.
