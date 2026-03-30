# Research: Inbox Refresh/Reactivity Bug

## Current architecture findings

- Inbox refresh behavior is currently split across:
  - `UnifiedInboxPage` realtime invalidation
  - `useSendReply` mutation onSuccess invalidation
  - Gmail-specific polling (`useSyncGmail`)
- Customers mode introduces person-timeline query family (`personTimeline`) that is not consistently refreshed by existing fan-out.
- Customers view currently includes custom query key usage in `CustomerConversationView`, creating key-scope mismatch with shared `inboxKeys`.

## Root cause analysis

1. **Query key scope mismatch**
   - Ad-hoc customers key does not naturally receive shared invalidation.

2. **Invalidation fan-out gap**
   - Existing realtime invalidation targets conversations + per-conversation messages but misses broader message families under some flows.

3. **Missing reliable refresh backbone**
   - Inbound reactivity depends heavily on realtime + Gmail polling.
   - If realtime misses events (connection hiccup, channel issues), UI stays stale until manual reload.

## Decision

- Normalize to canonical inbox keys and use one fan-out invalidation path for all modes.
- Add low-frequency fallback invalidation to guarantee eventual consistency without page reload.

