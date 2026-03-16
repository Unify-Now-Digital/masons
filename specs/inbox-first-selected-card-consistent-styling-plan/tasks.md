# Tasks: Inbox selected conversation card consistent styling

## Task 1 — Add focus styles to conversation card button

- [x] **File:** `src/modules/inbox/components/InboxConversationList.tsx`
- [x] **Where:** The `<button>` that renders each conversation card (inside `conversations.map()`), in the `className={cn(...)}` argument list.
- [x] **Change:** Append `'focus:outline-none focus:ring-0'` to the existing class list so the button never shows the browser default focus ring.
- [x] **Do not:** Change selected/unselected classes, `onClick`, `data-conversation-id`, or any other logic.

## Task 2 — Regression check

- [ ] First selected card: no extra outline; green bg + amber left border only.
- [ ] Middle selected card: same styling as first when selected.
- [ ] Keyboard tab: no browser ring; selected state is the indicator.
- [ ] Unread / Unlinked / Urgent badges and ChannelPill unchanged.
