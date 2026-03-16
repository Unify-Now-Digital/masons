# Tasks: Inbox selected card amber left accent

## Task 1 — Replace border accent with inset box-shadow

- [x] **File:** `src/modules/inbox/components/InboxConversationList.tsx`
- [x] **Where:** The conversation card `<button>` `className` (lines 304–311).
- [x] **Change selected branch:** Replace `border-l-amber-600/80` with inset box-shadow.
  - From: `isSelected ? 'bg-emerald-50/90 border-l-amber-600/80'`
  - To: `isSelected ? 'bg-emerald-50/90 shadow-[inset_3px_0_0_0_rgba(217,119,6,0.8)]'`
- [x] **Keep:** Base `border-l-2 border-transparent` and unselected `border-l-transparent` so layout stays stable.
- [x] **Do not change:** Gold dot, unread/urgent/unlinked badges, divide-y, list container, or any other logic.

## Task 2 — Regression check

- [ ] First selected card: amber accent (shadow) visible; green bg; gold dot.
- [ ] Middle selected card: same accent visible.
- [ ] Scrolling: accent visible when selected card is in view.
- [ ] Unread/urgent states and badges unchanged.
- [ ] Dividers still visible; no layout shift on selection.
