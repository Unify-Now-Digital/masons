# Refresh Contracts

## Inbound flow contract (webhook/sync -> DB)

When DB receives new message/conversation updates:
1. Realtime handler enqueues changed conversation IDs.
2. Debounced flush triggers `invalidateInboxData`.
3. Required invalidations:
   - `inboxKeys.conversations.all`
   - `['inbox', 'messages']`
4. Result:
   - Conversations mode list/thread updates
   - Customers mode list/timeline updates

## Outbound flow contract (UI send -> DB)

When send mutation succeeds:
1. Keep existing send transport behavior unchanged.
2. Trigger `invalidateInboxData` (or equivalent shared fan-out).
3. Required invalidations:
   - `inboxKeys.conversations.all`
   - `['inbox', 'messages']`
4. Result:
   - Sent message appears immediately in both modes.

## Fallback refresh contract

- Every 15-30s while Inbox is active:
  - Trigger `invalidateInboxData`.
- Guard conditions:
  - do not overlap pending invalidations
  - optionally skip when tab hidden for efficiency

