# Research: Unified Inbox Visual Redesign

## Input

- **Feature spec:** `specs/unified-inbox-visual-redesign.md`
- **Constraint:** Visual-only; no data flow, queries, scroll guard, auto-read, or realtime logic changes.

## Technical Context

### Codebase

- **UnifiedInboxPage** (`src/modules/inbox/pages/UnifiedInboxPage.tsx`): Page layout, four-column grid (People | Conversations + Conversation | Orders), tabs (All / Email / SMS / WhatsApp), conversation list cards, selection state, auto-read effect, realtime subscription.
- **PeopleSidebar** (`src/modules/inbox/components/PeopleSidebar.tsx`): Collapsible people list; collapsed = icon-only column.
- **Conversation list:** Rendered inline in UnifiedInboxPage (Card per conversation, active row styling).
- **ConversationView** (`src/modules/inbox/components/ConversationView.tsx`): Wraps ConversationHeader + ConversationThread; provides conversation/person data and link modal.
- **ConversationHeader** (`src/modules/inbox/components/ConversationHeader.tsx`): Already has avatar + displayName + secondaryLine + Badge + action button; sticky top, border-b.
- **ConversationThread** (`src/modules/inbox/components/ConversationThread.tsx`): Card with CardHeader "Conversation", scrollable message list (ref=scrollContainerRef), then composer block (replyTo, channel select, SuggestedReplyChip, Textarea, Send).
- **PersonOrdersPanel** (`src/modules/inbox/components/PersonOrdersPanel.tsx`): Card with CardHeader "Orders (n)", order list, order detail sidebar.

### Scroll and overflow (must preserve)

- **UnifiedInboxPage:** Main grid uses `min-h-0 min-w-0 overflow-hidden` on column wrappers so flex/grid children can shrink and scroll correctly.
- **Conversation list column:** `flex-1 min-h-0 overflow-auto` on the scrollable list container.
- **ConversationView:** Root `h-full flex flex-col min-h-0 min-w-0 overflow-hidden`.
- **ConversationThread:** Card `min-h-0`, CardContent `min-h-0 overflow-hidden`; message list div has `flex-1 min-w-0 overflow-y-auto overflow-x-hidden` and receives `scrollContainerRef` (used for scroll-to-bottom / auto-read).
- **PeopleSidebar / PersonOrdersPanel / AllMessagesTimeline:** Various `min-h-0` and `overflow-auto` for internal scroll; no change to scroll guard in ConversationThread.

## Hard Decisions (from user)

| Decision | Value |
|----------|--------|
| Orders panel header | `bg-slate-900 text-white` |
| Page background | `bg-muted/30` |
| Panel surfaces | `bg-background border border-border/60 rounded-xl shadow-sm` |
| Tabs | Pill style `rounded-full` |
| Active row highlight | `bg-muted/60` + left border accent `border-primary` |
| Logic | No changes to queries, scroll guard, auto-read, realtime |

## Out of scope

- New API calls, React Query key changes, or state machine changes.
- Changing scroll container ref assignment or scroll-to-bottom / auto-read logic.
- Adding or removing columns.
