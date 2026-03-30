# Unread and Read-Open Contract (Customers Mode)

## Badge behavior
- Replace numeric unread rendering with boolean badge:
  - show `Unread` when `hasUnread === true`
  - show nothing otherwise
- Applies only to customers mode list UI.

## Mark-as-read on open
- On selected customer thread open:
  - if row `hasUnread`, mark all `conversationIds` as read via existing mutation.
- Guard repeated calls using local session ref keyed by person + unread generation.

## UI immediacy
- Expect immediate badge clearing via existing optimistic cache update + invalidation flow.

