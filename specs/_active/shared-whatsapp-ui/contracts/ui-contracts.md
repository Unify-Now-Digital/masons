# UI Contracts: Shared WhatsApp UI and Sender Identity

---

## 1) WhatsApp Top-Bar Status Contract

Component: `WhatsAppConnectionStatus`

### Visibility rules

- Status indicator + label: visible to all logged-in users.
- Action controls (connect/disconnect/manage/mode actions): visible only when `isAdmin = true`.

### Admin derivation contract

- `isAdmin` is derived from authenticated `user.email` and `VITE_ADMIN_EMAIL`.
- No alternate admin source is allowed.

---

## 2) Outbound WhatsApp Bubble Sender Label Contract

Components: `ConversationThread` -> `InboxMessageBubble`

Applies only when:
- `message.channel === 'whatsapp'`
- `message.direction === 'outbound'`

Label resolution:
1. If `meta.sender_email` missing -> `You`
2. If `meta.sender_email` equals current user email -> `You`
3. Else -> show `meta.sender_email`

Out-of-scope behavior:
- Inbound message labels unchanged.
- Email/SMS outbound labels unchanged.
