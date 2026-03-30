# Data Model: Message-Level Reply UX

## No schema changes

This feature does not add or change database tables, columns, or RLS. All state is UI-only.

---

## UI state

### replyTo (ReplyToInfo)

Already defined in `ConversationThread.tsx`:

```ts
export interface ReplyToInfo {
  messageId: string;
  preview: string;
  channel: 'email' | 'sms' | 'whatsapp';
}
```

- **messageId:** `InboxMessage.id` of the message being replied to (for future quoting/threading; not sent to backend in this scope).
- **preview:** Short snippet of the message body (e.g. first 40–80 chars, plain text, truncated with "…").
- **channel:** Message’s channel; used to lock the channel selector and select the correct conversation when sending.

### Where it lives

- **Owner:** `AllMessagesTimeline` (when All tab unified timeline is shown).
- **Passed to:** `ConversationThread` as controlled props: `replyTo`, `onReplyToClear`, and a new `onReplyToMessage(message)` callback.

### Deriving preview from InboxMessage

- Source: `message.body_text ?? ''`.
- Optionally strip HTML tags for email (e.g. replace `/<\/?[^>]+>/g` with `''`, then trim).
- Trim and take `.slice(0, 60)` (or 40–80); if length > 60, append `"…"`.

---

## Channel lock (derived)

- While `replyTo != null`: selected channel in ConversationThread MUST equal `replyTo.channel` and the channel dropdown MUST be locked (disabled or hidden; show label only).
- When `replyTo` is cleared: selected channel is restored from `effectiveDefault` (defaultChannel ?? mostRecentInboundChannel(messages) ?? 'email').

No new persisted data; no API contracts changed.
