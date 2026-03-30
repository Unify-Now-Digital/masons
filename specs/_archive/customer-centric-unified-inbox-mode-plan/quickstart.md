# Quickstart: Implement Customer-Centric Unified Inbox Mode

## Scope
- Additive-only unified customer mode
- No DB schema changes
- No regression to existing conversation mode tabs/views

## Implementation order
1. Create data selectors/hooks (`useCustomerThreads`, `useCustomerMessages`).
2. Add mode toggle to `UnifiedInboxPage`.
3. Build `CustomerThreadList` and wire left panel in customer mode.
4. Build `CustomerConversationView` for mixed timeline.
5. Add `ChannelSelector` with disabled unavailable channels.
6. Wire send routing using existing `useSendReply`.
7. Add unread aggregation and unified read actions.
8. Verify non-regression in current tabs/channels.

## Manual test checklist
- Existing mode unchanged: All/Unread/Urgent/Unlinked and channel filters.
- Customer mode:
  - one row per linked person
  - combined unread count is correct
  - timeline mixes channels in chronological order
  - each message shows channel badge
  - reply default channel = latest inbound
  - disabled channels cannot send
- Send flow:
  - email replies into latest email thread
  - sms/whatsapp route to latest active conversation
  - outbound appears in underlying conversation thread and unified thread

## Performance checks
- Large customer list remains responsive.
- No excessive re-renders when typing search.
- Timeline sort stable and duplicate-free.

