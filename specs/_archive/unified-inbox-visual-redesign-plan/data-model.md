# Data Model: Unified Inbox Visual Redesign

## Scope

Visual-only redesign. No database or API changes. No new entities or relationships.

## UI structure (reference only)

- **UnifiedInboxPage:** Layout container; four-column grid; tabs; conversation list (from existing `conversations` query); ConversationView; PersonOrdersPanel.
- **ConversationView:** Composes ConversationHeader (props from conversation + person) and ConversationThread (messages, composer).
- **ConversationThread:** Message list (scroll container) + composer dock (replyTo, channel, suggestion chip, textarea, send).
- **PersonOrdersPanel:** Orders list + optional order detail sidebar (existing order hooks).

All data comes from existing hooks and props; no new queries or state shape.
