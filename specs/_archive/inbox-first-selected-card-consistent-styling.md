# Inbox First Selected Conversation Card — Consistent Styling

## Overview

**Problem:** When the first conversation in the Inbox list is selected, its card shows an extra orange outline/accent in addition to the light green selected background. Other selected conversation cards do not show that extra outline. Selected cards should render consistently.

**Goal:** Identify the root cause and fix so all selected conversation cards use the same selected styling, while preserving keyboard accessibility and avoiding an unintended extra outline only on the first item.

---

## Current State Analysis

### Components involved

- **Inbox conversation list:** `src/modules/inbox/components/InboxConversationList.tsx` — renders the list of conversation cards. There is no separate `ConversationCard.tsx` or `ConversationItem.tsx`; each card is a `<button>` rendered inside the `.map()` in this file (lines 279–361).
- **Selection and scroll:** `UnifiedInboxPage.tsx` auto-selects the first conversation on load (`setSelectedConversationId(displayConversations[0].id)`). `InboxConversationList` runs a `useEffect` that calls `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` on the selected card’s DOM node when `selectedConversationId` or `conversations` change. No `ref` or explicit `.focus()` is called on the card button.

### Conversation card markup and styling (current)

**File:** `src/modules/inbox/components/InboxConversationList.tsx` (lines 299–311)

Each card is a native `<button>`:

```tsx
<button
  key={conversation.id}
  data-conversation-id={conversation.id}
  type="button"
  className={cn(
    'w-full text-left py-2 px-2 rounded-lg transition-colors flex items-start gap-2',
    'border-l-2 border-transparent',
    isSelected
      ? 'bg-emerald-50/90 border-l-amber-600/80'
      : 'bg-white hover:bg-slate-50/80 border-l-transparent'
  )}
  onClick={() => onSelectConversation(conversation.id)}
>
```

- **Selected state:** `isSelected` (when `selectedConversationId === conversation.id`) applies `bg-emerald-50/90` and `border-l-amber-600/80`. All selected cards get this.
- **No `index === 0` or `first:`** — There is no conditional based on list index or Tailwind `first:` in this component. The first card is not styled differently by application code.
- **No explicit focus styles** — The button has no `focus:`, `focus-visible:`, or `outline` classes. It therefore uses the **browser default focus ring** when it has DOM focus.

### Why the first selected card looks different

- The card is a **focusable** `<button>`. When it has **keyboard/document focus**, the browser draws its default focus outline (often a 2px orange or blue ring).
- **When the first card is selected:** On initial load, the first conversation is auto-selected and the list effect runs `scrollIntoView` on that card’s button. Depending on browser and tab order, the first focusable element in the list (the first card’s button) can **receive focus** or retain focus in a way that other selected cards do not when the user has clicked elsewhere (e.g. in the thread). So the first selected card often shows:
  - Selected styling: green background + amber left border (intended)
  - **Plus** the browser’s default focus ring (unintended “extra” outline).
- **When another card is selected:** If the user clicked that card, focus may move to the thread or another element, so that card’s button may not have focus and thus does not show the default ring — only the selected styling.

So the difference is **not** a different class or `index === 0` in our code; it is that the **first selected card’s button often has DOM focus** and thus gets the **default browser focus outline**, while other selected cards often do not have focus.

---

## Root Cause

**Exact cause:** The conversation card `<button>` has **no explicit focus styles**. When it has focus, the **browser default focus ring** (e.g. orange outline) is shown in addition to the selected state (green background + amber left border). The first card is more likely to have focus (initial load / scroll-into-view / tab order), so it appears to have an “extra” outline; other selected cards, when they don’t have focus, do not.

**Class/condition:** There is no extra class or `index === 0` condition. The extra outline comes from the **absence** of focus styling (e.g. `focus:outline-none` or `focus:ring-0`) on the button, so the native focus ring is visible whenever that button is focused.

---

## Recommended Fix

**File to modify:** `src/modules/inbox/components/InboxConversationList.tsx` (same `<button>` that renders each conversation card).

**Change:** Add explicit focus styles so the button does not show the default focus ring. Rely on the existing **selected** state (green background + amber left border) as the only visual indicator for “this card is selected,” which is sufficient for both mouse and keyboard users.

**Suggested classes to add to the button’s `className`:**

- `focus:outline-none` — removes the default outline when the button has focus.
- `focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-inset` (or similar) — **optional**: if you want a visible focus indicator for keyboard users only, use a consistent ring that matches the app (e.g. emerald) and only for `focus-visible`, so mouse users don’t see an extra ring.

**Minimal fix (no extra ring at all):** Add only `focus:outline-none focus:ring-0` so there is no focus ring. The selected state (background + left border) already indicates the active card; keyboard users can still tab through cards and see selection change.

**Exact change (minimal):** In the `className` of the conversation card `<button>`, append:

`'focus:outline-none focus:ring-0'`

so that when the first (or any) card has focus, it does not show an extra outline and matches other selected cards visually.

---

## What NOT to Do

- Do not add logic based on `index === 0` or `first:` to change styling.
- Do not remove or change the selected state styling (`bg-emerald-50/90 border-l-amber-600/80`).
- Do not change scroll-into-view or selection logic; only adjust the button’s focus styling.

---

## Open Questions / Considerations

- If product prefers a visible keyboard focus indicator, use `focus-visible:ring-2 focus-visible:ring-emerald-500/30` (and keep `focus:outline-none`) so the ring appears only for keyboard focus and matches the app’s emerald theme, avoiding the orange default.
