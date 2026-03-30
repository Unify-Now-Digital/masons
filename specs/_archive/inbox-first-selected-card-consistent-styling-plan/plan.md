# Inbox Selected Conversation Card — Consistent Styling (Implementation Plan)

## 1. Root cause summary

- **Observed:** The first selected conversation card in the Inbox list shows an extra orange/browser outline; other selected cards do not.
- **Cause:** Conversation cards are native `<button>` elements with **no explicit focus styles**. When a card has DOM focus, the **browser default focus ring** is shown in addition to the intended selected styling (green background + amber left border). The first card is more likely to have focus (initial load, auto-select first, scroll-into-view, or tab order), so it shows the extra outline; other selected cards often do not have focus, so they show only the intended styling.
- **Not caused by:** There is no `index === 0` or Tailwind `first:` logic; no separate ConversationCard component; no different class for the first item. The difference is purely focus + missing focus styles.

---

## 2. Exact file and code area to update

**File:** `src/modules/inbox/components/InboxConversationList.tsx`

**Location:** The conversation card `<button>` inside the `conversations.map()` callback (lines 300–311). The `className` passed to `cn()` is the only place to change.

**Current snippet:**

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

**Change:** Add focus utility classes to the same `className` array so the button never shows the browser default focus ring.

---

## 3. Minimal safe change plan

1. **Single edit:** In `InboxConversationList.tsx`, inside the `className={cn(...)}` for the conversation card `<button>`, add one additional string:  
   `'focus:outline-none focus:ring-0'`
2. **Do not change:** Selected state classes (`bg-emerald-50/90 border-l-amber-600/80`), unselected/hover classes, `onClick`, `data-conversation-id`, or any logic (scroll-into-view, selection, filters).
3. **Result:** Whenever a card has focus (first or any), it will not show the default outline; all selected cards will look the same (green background + amber left border only).

---

## 4. Focus styling: two options

| Option | Classes | Effect |
|--------|---------|--------|
| **A — No focus ring** | `focus:outline-none focus:ring-0` | No outline when focused. Selected state (green + amber) is the only indicator. Keyboard users still see which card is selected by the existing selected styling. |
| **B — Keyboard-only ring** | `focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-inset` | No outline on mouse click; when focus is from keyboard (e.g. Tab), a subtle emerald ring appears so focus is explicit. |

---

## 5. Recommended final approach

**Use the current first-card look as the standard:** The desired target is “light green selected background + amber/orange left border accent” with **no** extra browser outline.

- **Recommended:** **Option A** — `focus:outline-none focus:ring-0` only.
  - Aligns with “use the current first selected card appearance as the target UI” once the unintended outline is removed (i.e. the target is green + amber only).
  - Keeps one consistent selected style for all cards; no additional ring to maintain or explain.
  - Keyboard accessibility is preserved: tab order and selection still work; the selected state (background + left border) is the focus indicator.
- **Optional:** If product later wants an explicit keyboard focus ring, switch to Option B and use the same emerald ring on all cards so behavior stays consistent.

---

## 6. Regression checklist

After implementing, verify:

| Check | Expected |
|-------|----------|
| **First selected conversation** | On load (auto-select first), the first card shows only green background + amber left border; no orange/browser outline. |
| **Middle selected conversation** | Clicking a conversation in the middle of the list: that card shows the same green + amber styling; no extra outline. |
| **Keyboard tab / focus** | Tabbing through the list moves focus between cards; the focused card does not show a browser default ring; the selected card is clearly indicated by green bg + amber border. |
| **Unread / linked / channel badges** | Unread, Unlinked, Urgent badges and ChannelPill still render and position correctly on all cards; no layout or visibility regression. |

No changes to selection logic, scroll-into-view, or badge logic are required; only the button’s focus styles are updated.
