# Send Routing Contract: Unified Customer Thread

## Channel resolution
- Available channels are always shown: `email`, `sms`, `whatsapp`.
- Channels with no valid destination conversation are disabled.
- Default selected channel:
  1. latest inbound message channel for selected person
  2. else first available by priority `email -> sms -> whatsapp`

## Conversation target resolution
- Resolve target `conversation_id` by selected channel using latest active conversation map.
- If none exists, send is blocked (disabled button + helper text).

## Send API reuse (unchanged)
- Use existing `useSendReply` mutation only.
- Underlying per-channel behavior unchanged:
  - Email: reply into latest email thread conversation.
  - SMS: send into latest sms conversation.
  - WhatsApp: send into latest whatsapp conversation.

## Persistence/auditability
- Outbound entries must persist as normal `inbox_messages` rows with actual `conversation_id`.
- Unified timeline is a read/interaction projection; no alternate storage.

## Post-send cache updates
- Invalidate:
  - conversation list caches
  - target conversation message cache
  - selected person unified timeline cache

