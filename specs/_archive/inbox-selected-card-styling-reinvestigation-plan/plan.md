# Inbox Selected Card Styling — Implementation Plan

## 1. Root-cause summary

- **Observed:** The first selected conversation card looks better/more consistent than other selected cards; focus reset (focus:outline-none) did not change the UI.
- **Cause:** The **container** styling is already identical for all selected cards (green bg + amber left border). The perceived difference is **content/state**: the first card is often **unread** (or urgent), so it shows the **gold dot** next to the name and the **Unread** badge. Other selected cards are often **read**, so they show neither — same container, fewer accents, so they feel plainer.
- **Not caused by:** Different container classes, index/first logic, or focus. Only by when `showGoldDot` and the Unread badge are true (unread/urgent).

---

## 2. Exact code areas to update

**File:** `src/modules/inbox/components/InboxConversationList.tsx`

**Single change:** Inside the `conversations.map()` callback, the variable `showGoldDot` is computed at **line 289**.

**Current (line 289):**
```ts
const showGoldDot = urgent || (conversation.unread_count > 0);
```

**Target:** Include selected state so the gold dot also appears for any selected card (as a selection indicator), while keeping unread/urgent semantics for the dot when combined with badges:
```ts
const showGoldDot = isSelected || urgent || (conversation.unread_count > 0);
```

**No other edits:** Do not change the Unread badge condition (`conversation.unread_count > 0`), Urgent/Unlinked badges, container `className`, `statusDot`, or any other logic in this file.

---

## 3. Minimal safe change plan

1. **One-line edit:** In `InboxConversationList.tsx`, line 289, change the right-hand side of `showGoldDot` from  
   `urgent || (conversation.unread_count > 0)`  
   to  
   `isSelected || urgent || (conversation.unread_count > 0)`.
2. **Do not change:** Container classes, Unread/Urgent/Unlinked badge conditions, avatar `statusDot`, or list structure.
3. **Result:** Every selected card will show the amber dot next to the name (matching the “first card” look). Unread conversations still show the Unread badge; urgent still show Urgent badge. Read selected conversations will show only the dot (selection indicator), not the Unread badge.

---

## 4. Divider / top-border: change now or defer?

**Recommendation: defer.**

- **Current:** The list wrapper uses `divide-y divide-slate-100`, so the **first** card has no top border; every other card has a light gray line above. That can make the first card’s top edge feel slightly different.
- **Options:** (a) Add a top border to the list container (e.g. `border-t border-slate-100`) so the first card has a line above it too; (b) leave as is.
- **Decision:** Implement only the **showGoldDot** change first. If the team later wants the first card’s top edge to match the others, add the container top border in a follow-up. This keeps the change minimal and avoids layout/visual side effects in the same pass.

---

## 5. Recommended final approach

- **Do now:** Set `showGoldDot = isSelected || urgent || (conversation.unread_count > 0)` so every selected card gets the same amber dot as the first (unread) selected card. Unread badge remains `unread_count > 0` only; no false “unread” for read items.
- **Defer:** Divider/top-border normalization for the first card; revisit only if needed after the dot change is in use.

---

## 6. Regression checklist

| Check | Expected |
|-------|----------|
| **Selected unread conversation** | Shows green bg + amber left border + gold dot + Unread badge. Same as before; dot still appears. |
| **Selected read conversation** | Shows green bg + amber left border + **gold dot** (new). No Unread badge. |
| **Urgent conversation** | Urgent badge and gold dot (and avatar dot if applicable) unchanged. Selected urgent still shows dot + Urgent badge. |
| **Unread badge behavior** | Unread badge still only when `unread_count > 0`. No “Unread” on read conversations. |
| **Linked/unlinked badge behavior** | Unlinked badge and avatar status dot unchanged; still driven by `showUnlinked` / `statusDot`. |
| **First card vs middle card** | When selected, first and middle (and any position) card both show the same gold dot and container styling; no position-based difference for the dot. |
