# Tasks: Inbox selected card styling consistency

## Task 1 — Show gold dot for all selected cards

- [x] **File:** `src/modules/inbox/components/InboxConversationList.tsx`
- [x] **Location:** Line 289, inside the `conversations.map()` callback.
- [x] **Change:** Set  
  `showGoldDot = isSelected || urgent || (conversation.unread_count > 0)`  
  (add `isSelected ||` before `urgent`).
- [x] **Do not change:** Unread/Urgent/Unlinked badge conditions, container `className`, `statusDot`, or list structure.

## Task 2 — Regression check

- [ ] Selected unread: green bg + amber border + gold dot + Unread badge.
- [ ] Selected read: green bg + amber border + gold dot; no Unread badge.
- [ ] Urgent: dot and Urgent badge unchanged.
- [ ] Unread badge: only when `unread_count > 0`.
- [ ] Linked/unlinked badge and avatar dot: unchanged.
- [ ] First vs middle selected card: same dot and container styling.
