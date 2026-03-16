# Inbox Selected Card — Amber Left Border Inconsistency

## Overview

**Current status:** The gold dot was updated successfully and now shows for every selected conversation. The **amber left border** still appears only for the first conversation; other selected conversations do not show it. The goal is for every selected conversation to show both the gold dot and the amber left border.

**Context:** A previous investigation concluded that selected cards share the same container classes, but the actual UI shows the amber left border is not visually consistent. This spec re-investigates the real rendered border behavior.

---

## 1. How the left border is implemented

**File:** `src/modules/inbox/components/InboxConversationList.tsx`  
**Element:** The conversation card `<button>` (lines 300–312).

**Class application:**

| Layer | Classes | When |
|-------|---------|------|
| Base (always) | `border-l-2 border-transparent` | Every card |
| Selected | `bg-emerald-50/90 border-l-amber-600/80` | When `isSelected` |
| Unselected | `bg-white hover:bg-slate-50/80 border-l-transparent` | When not selected |

- **Border width:** Set once in the base: `border-l-2` (2px left border). Same for all cards.
- **Border color:** Unselected uses `border-l-transparent`; selected uses `border-l-amber-600/80` (Tailwind: amber-600 at 80% opacity). So the selected state sets **color only**; width is already set by the base.

**Conclusion:** In code, every selected card receives the same classes: `border-l-2 border-transparent` + `border-l-amber-600/80`. There is no conditional that applies the amber border only to the first item.

---

## 2. Base / unselected classes overriding the selected border?

The `className` is built with a single ternary: `isSelected ? '... border-l-amber-600/80' : '... border-l-transparent'`. Only one branch applies per card, so unselected classes do not override the selected branch for a selected card. No base or unselected class is applied in a way that would remove or hide the amber border on non-first selected cards.

---

## 3. Parent layout, divide-y, wrappers, and masking

**List structure:**

```
div.listContainerRef  className="flex-1 min-h-0 overflow-auto scrollbar-hide px-0.5"
  div                 className="divide-y divide-slate-100"
    button (card 1)
    button (card 2)
    ...
```

- **divide-y divide-slate-100:** Tailwind adds a **top** border to every direct child **except the first** (`> * + *`). So the first card has no top border; every other card has a 1px top border (slate-100). This does not remove or replace the left border on any card. It can, however, change how the left edge is perceived: the first card’s left border runs from the very top of the list; other cards have a horizontal divider above them, so the left border meets that divider. In some browsers or at certain zoom levels, the junction of divider + left border can make the border look less visible or clipped.
- **px-0.5:** The scroll container has 2px horizontal padding. The buttons are `w-full`, so they fill the content area. The left border of every button sits at the same position relative to the scroll container (2px from the visible left edge). So in principle no card is given more or less “room” for the border. That said, with only 2px padding, the left border is very close to the container edge; in an `overflow-auto` area with `scrollbar-hide`, some browsers can render or clip the content in a way that makes the first row’s left edge visible while middle rows’ left edges are less visible (e.g. sub-pixel or clipping behavior).
- **overflow-auto:** Content can scroll. There is no explicit `overflow-x: hidden` or clip on the list container that would target only non-first items. So the most plausible layout-related cause is the combination of (1) very tight horizontal space (`px-0.5`) and (2) the first item having no top divider, making its left border the only one that runs from the top of the list and is therefore more noticeable.

---

## 4. Whether selected state is the same for first vs other cards

`isSelected` is computed as `selectedConversationId === conversation.id`. It does not depend on index or position. So the **selected state** and the **container classes** (including `border-l-amber-600/80`) are the same for the first selected card and any other selected card. The inconsistency is not due to different class application in React.

---

## 5. Root cause (summary)

- **In code:** Every selected card gets the same left border styling (`border-l-2` + `border-l-amber-600/80`). Selected state is the same for first and middle cards.
- **In the UI:** The amber left border is only clearly visible on the first conversation. So the cause is **rendering/layout**, not a missing or wrong class.
- **Most likely explanation:** The first card has no `divide-y` top border above it, so its left border runs from the top of the list and is unobstructed. Other cards have a slate-100 top border; the way that meets the left border, combined with minimal horizontal padding (`px-0.5`) and possible scroll/overflow behavior, makes the left border on non-first cards appear missing or much less visible. So the **exact root cause** is: **layout and divider behavior (and possibly scroll/overflow) make the left border visually clear only on the first list item; the same CSS is applied to all selected cards.**

**Exact classes responsible:** The visible accent is `border-l-amber-600/80` on the `<button>`. The same class is applied to every selected card. The elements that affect visibility are the **parent** `div` with `divide-y divide-slate-100` and the **scroll container** with `px-0.5 overflow-auto scrollbar-hide`.

---

## 6. Recommended fix

**Goal:** Every selected conversation should **visibly** show the amber left border, without changing unread/urgent/link badge semantics.

**Options:**

1. **Give the left border clear space (minimal change)**  
   When selected, add a bit of left padding so the border is not flush against the scroll edge and is less likely to be visually lost or clipped: e.g. add `pl-3` (or `pl-2`) to the selected branch so the button content shifts right and the 2px border sits in clear space. Keep `border-l-2 border-l-amber-600/80`.  
   - Pros: Small change, same border model.  
   - Cons: Slight layout shift when selecting; if the issue is divider/rendering, padding alone might not fix it everywhere.

2. **Use inset box-shadow for the accent (recommended)**  
   Replace the left border with an **inset box-shadow** when selected, so the accent is drawn inside the button and is not affected by container edges or dividers:  
   - Remove from selected: `border-l-amber-600/80` (keep `border-l-2 border-transparent` or drop left border when selected).  
   - Add when selected: `shadow-[inset_3px_0_0_0_rgba(217,119,6,0.8)]` (or a Tailwind arbitrary value that matches amber-600/80).  
   - Result: A 3px amber strip on the left inside the button, visible regardless of list position.  
   - Pros: Consistent visibility on first and middle cards; no dependency on border vs divide-y.  
   - Cons: Slightly different from a “true” border (e.g. no layout shift; visually equivalent for a thin accent).

3. **Inner accent element**  
   When selected, render a small div inside the button (e.g. `absolute left-0 top-0 bottom-0 w-0.5 bg-amber-600/80 rounded-l`) so the strip is a separate layer.  
   - Pros: Full control over position and visibility.  
   - Cons: More DOM and layout logic; need to ensure the button has `position: relative` and correct overflow.

**Recommendation:** Prefer **option 2 (inset box-shadow)** so every selected card shows a clear amber left accent without relying on the border being visible next to the divider and scroll edge. Preserve existing unread/urgent/link badge behavior and container padding; only change how the selected left accent is drawn.

---

## 7. What not to change

- Unread badge: only when `unread_count > 0`.
- Urgent badge and gold dot logic (including `isSelected || urgent || (conversation.unread_count > 0)`).
- Linked/unlinked badge and avatar status dot.
- divide-y / list structure (unless part of a broader layout fix).
- Selected background: keep `bg-emerald-50/90`.
