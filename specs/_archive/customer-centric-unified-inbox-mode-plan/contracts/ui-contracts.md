# UI Contract: Customer-Centric Unified Mode

## Mode model
- Add `viewMode: 'conversations' | 'customers'` in `UnifiedInboxPage`.
- Default stays existing behavior (`conversations`) to avoid regressions.

## Sidebar contract
- In `conversations` mode:
  - render existing `InboxConversationList` behavior unchanged.
- In `customers` mode:
  - render one row per linked person.
  - row includes combined unread, latest preview/timestamp, channel indicators.
  - selecting row sets `selectedPersonId`.

## Center panel contract
- In `conversations` mode: existing `ConversationView` with single-channel conversation.
- In `customers` mode: `CustomerConversationView` renders mixed timeline for `selectedPersonId`.
- Every message displays channel badge.
- Email messages render full content (existing HTML-capable rendering path).

## Right panel contract
- `PersonOrdersPanel` behavior unchanged.
- It always receives active person context in both modes.

## Existing tabs contract
- `All / Unread / Urgent / Unlinked` keep current semantics.
- No behavior changes in existing channel-specific views.

