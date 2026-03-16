# Inbox Selected Card — Amber Left Accent (Implementation Plan)

## 1. Root cause summary

- **In code:** Every selected card gets the same classes: base `border-l-2 border-transparent` and selected `border-l-amber-600/80`. There is no index-based or first-child logic.
- **In the UI:** The amber left border is only clearly visible on the first conversation; it disappears or is much less visible on other selected cards.
- **Cause:** Layout and rendering. The list uses `divide-y divide-slate-100` (top border on non-first children) and the scroll container has `px-0.5 overflow-auto scrollbar-hide`. The first card has no top divider, so its left border runs from the top and is unobstructed. On other cards, the divider meets the left edge; combined with tight padding and scroll behavior, the same left border is visually lost or clipped. So the **root cause** is that the border-based accent is sensitive to list position and parent layout; the fix is to draw the accent in a way that is not affected by that (inset box-shadow).

---

## 2. Exact code area to modify

**File:** `src/modules/inbox/components/InboxConversationList.tsx`  
**Location:** The conversation card `<button>` `className` (lines 304–311). Only this `cn()` argument list and the ternary for selected/unselected should change.

**Current snippet:**

```tsx
className={cn(
  'w-full text-left py-2 px-2 rounded-lg transition-colors flex items-start gap-2',
  'border-l-2 border-transparent',
  'focus:outline-none focus:ring-0',
  isSelected
    ? 'bg-emerald-50/90 border-l-amber-600/80'
    : 'bg-white hover:bg-slate-50/80 border-l-transparent'
)}
```

No other areas in this file (gold dot, badges, divide-y, list container) are to be changed.

---

## 3. Replace border accent with inset box-shadow

**Goal:** Ensure every selected card clearly shows the amber left accent by drawing it inside the card with an inset box-shadow, so visibility does not depend on list position or divider/padding.

**Changes:**

1. **Base (always):**  
   - Keep: `'border-l-2 border-transparent'` so the button still reserves the same left “space” and layout stays stable (no shift when selecting).  
   - Alternatively, remove `border-l-2 border-transparent` from the base and from the unselected branch so the card has no left border at all; then the selected state only adds the shadow. Either way, avoid adding extra width when selected.

2. **Selected branch:**  
   - Remove: `border-l-amber-600/80`.  
   - Add: `shadow-[inset_3px_0_0_0_rgba(217,119,6,0.8)]` (3px inset strip on the left; amber-600 ≈ rgb(217,119,6), 0.8 opacity).  
   - Keep: `bg-emerald-50/90`.

3. **Unselected branch:**  
   - Keep: `bg-white hover:bg-slate-50/80 border-l-transparent`.  
   - Ensure no shadow is applied when unselected (do not add a default shadow to the base; only the selected branch adds the inset shadow).

**Resulting selected branch:**  
`'bg-emerald-50/90 shadow-[inset_3px_0_0_0_rgba(217,119,6,0.8)]'`

**Resulting base:**  
If we keep the transparent border for layout stability: leave base as-is. If we remove the border entirely: remove `'border-l-2 border-transparent'` from the base and from the unselected branch (unselected would then be `'bg-white hover:bg-slate-50/80'` only). Recommendation: **keep** `border-l-2 border-transparent` on the base so the button’s layout (and any spacing) is unchanged; only the **color** of the accent switches from border to shadow when selected.

---

## 4. Remove border-l color logic but keep layout stable

- **Keep:** Base class `'border-l-2 border-transparent'` so the button always has a 2px left border (transparent when unselected). That preserves width and avoids layout shift.
- **Selected:** Do **not** add `border-l-amber-600/80`; use only the inset box-shadow for the visible accent.
- **Unselected:** Keep `border-l-transparent` in the unselected branch so the left border remains transparent and the shadow is not used.

So the only removal is the **amber border color** on the selected branch; the transparent 2px left border can stay on all cards for stability.

---

## 5. Optional fallback (padding-based border solution)

If inset box-shadow is not acceptable (e.g. design preference for a real border), use this fallback:

- Keep the current border approach: selected = `border-l-2 border-l-amber-600/80`.
- When selected, add left padding so the border has clear space from the scroll edge: e.g. add `pl-3` to the selected branch so the 2px border sits in from the container edge.  
- Example selected branch: `'bg-emerald-50/90 border-l-amber-600/80 pl-3'`.  
- Unselected would need matching `pl-3` only if we want to avoid any horizontal shift when selecting; otherwise unselected stays `px-2` from the base and selected gets `pl-3 pr-2` (or override padding in the selected branch). This fallback may not fix visibility in all browsers; the primary recommendation remains the inset box-shadow.

---

## 6. Regression checklist

After implementation, verify:

| Check | Expected |
|-------|----------|
| **First selected card** | Amber left accent (inset shadow) clearly visible; green background; gold dot. |
| **Middle selected card** | Same amber left accent visible; same green background; gold dot. |
| **Scrolling list** | Accent remains visible when the selected card is scrolled into view; no clipping of the shadow. |
| **Unread state** | Unread badge and gold dot still show when `unread_count > 0`; accent unchanged. |
| **Urgent state** | Urgent badge and gold dot unchanged; accent unchanged. |
| **Divider visibility** | divide-y between cards still visible; no overlap or hiding of dividers. |
| **Unselected cards** | No amber accent; no extra shadow; white/hover background and transparent left border only. |
| **Layout** | No horizontal jump or width change when selecting a card (transparent border or shadow only). |

---

## 7. Constraints (do not change)

- Keep selected background: `bg-emerald-50/90`.
- Do not change gold dot logic: `showGoldDot = isSelected || urgent || (conversation.unread_count > 0)`.
- Do not change unread badge: `conversation.unread_count > 0` only.
- Do not change urgent badge or linked/unlinked badges.
- Do not change list structure: `divide-y divide-slate-100` and scroll container unchanged.
- Avoid layout shifts: keep base border or use shadow-only so card width does not change on selection.
