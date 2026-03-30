# Quickstart: Validate Inbox Reactivity Fix

## Core scenarios

1. **Inbound update in Conversations mode**
   - Keep inbox open.
   - Receive inbound message (webhook/sync path).
   - Message/thread appears without reload.

2. **Inbound update in Customers mode**
   - Switch to Customers mode.
   - Receive inbound message for linked person.
   - Customer row + mixed timeline refresh without reload.

3. **Outbound send in Conversations mode**
   - Send message from conversation thread.
   - Message appears immediately; metadata updates.

4. **Outbound send in Customers mode**
   - Send from mixed timeline.
   - Message appears immediately in mixed timeline and underlying conversation.

5. **Realtime failover**
   - Simulate missed realtime event (or disconnect).
   - Confirm fallback refresh catches update within interval.

6. **Mode switching**
   - Switch Conversations <-> Customers after new messages.
   - No stale data; selections remain valid.

