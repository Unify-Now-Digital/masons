# Inbox Selected Card Styling — Re-investigation

## Overview

**Goal:** Determine the actual styling difference between (1) the first selected conversation card and (2) other selected conversation cards, and recommend how to make every selected card use the same visual treatment as the first. The previous hypothesis (browser focus outline) was addressed with focus reset classes but did not change the UI.

**Context:**
- All selected cards should have a similar UI to the first conversation card.
- The difference is likely **not** caused by focus.
- The first card may look different because it is in another state (e.g. unread) or because of list position.

---

## Current State Analysis

### File inspected

**`src/modules/inbox/components/InboxConversationList.tsx`** — conversation cards are rendered inline as `<button>` elements inside `conversations.map()` (lines 279–361). There is no separate ConversationCard component and no `index === 0` or Tailwind `first:` logic in this file.

---

## 1. All conditional className branches affecting the card container

The card container is the `<button>` (lines 300–312). Its `className` is built with `cn()` from:

| Source | Classes | Condition |
|--------|---------|-----------|
| Base | `'w-full text-left py-2 px-2 rounded-lg transition-colors flex items-start gap-2'` | Always |
| Base | `'border-l-2 border-transparent'` | Always |
| Base | `'focus:outline-none focus:ring-0'` | Always |
| **isSelected** | `'bg-emerald-50/90 border-l-amber-600/80'` | When `selectedConversationId === conversation.id` |
| **!isSelected** | `'bg-white hover:bg-slate-50/80 border-l-transparent'` | When not selected |

**Conclusion:** The **container** has no conditional styling based on `unread_count`, linked/unlinked, or urgent. Only `isSelected` changes background and left border. So in code, every selected card gets the same container classes.

---

## 2. All conditional styling tied to unread, selected, linked/unlinked, urgent

### Container (button)

- **Selected state:** `isSelected` → green background + amber left border (see table above). No unread/urgent/linked logic on the button itself.

### Inside the card (children)

| Variable | Condition | Effect |
|----------|-----------|--------|
| **statusDot** (avatar) | `urgent ? 'urgent' : showUnlinked ? 'unlinked' : undefined` | Avatar gets red dot (urgent), violet dot (unlinked), or no dot. Not driven by unread. |
| **showGoldDot** | `urgent \|\| (conversation.unread_count > 0)` | Small amber dot next to **person name** (lines 320–325). Shown only when urgent **or** unread. |
| **Unread badge** | `conversation.unread_count > 0` | Renders `InboxStatusBadge variant="action"` ("Unread", amber). |
| **Urgent badge** | `urgent` | Renders "Urgent" (red). |
| **Unlinked badge** | `showUnlinked` | Renders "Unlinked" (violet). |

So:

- **Unread** affects: `showGoldDot` (amber dot by name) and the Unread badge.
- **Selected** affects: only the button’s background and left border.
- **Linked/unlinked** affects: avatar status dot and Unlinked badge.
- **Urgent** affects: avatar dot, `showGoldDot`, and Urgent badge.

There is no conditional that uses **both** “selected” and “unread” to change the **container** (e.g. no “selected + unread” extra border or background). The only way selected cards can look different from each other in the current code is through these **inner** elements (gold dot, badges, avatar dot).

---

## 3. Is the first-card appearance caused by unread + selected?

**Yes, in terms of content.** The **container** styling is the same for all selected cards. What can differ is:

- **First selected card (often the top / most recent, often unread):**  
  Selected (green bg + amber left border) **plus** `showGoldDot` true (amber dot next to name) **plus** Unread badge. So it has the same container as other selected cards but more **content** (dot + badge).

- **Other selected cards (often read):**  
  Same selected container (green bg + amber left border), but `showGoldDot` false and no Unread badge. So they look “plainer” — same box, fewer accents.

So the first card often looks different because **unread-state content** (gold dot + Unread badge) is **combined** with selected-state styling, while other selected cards are often read and don’t show that content. The difference is **not** from a different container class for the first card; it’s from **which content** is rendered inside (dot and badges).

**Structural nuance:** The list is wrapped in `<div className="divide-y divide-slate-100">`. With `divide-y`, the **first** child has no top border; every other card has a light gray top border. So the first card is the only one whose selected background runs flush to the top of the list with no line above it. That can make it look slightly different from other selected cards even with the same classes.

---

## 4. Exactly which classes/elements make the first card look different

- **Not the container:** All selected cards share `bg-emerald-50/90 border-l-amber-600/80`. No class is applied only to the first or only when unread on the button.
- **Content that can differ:**
  1. **Gold dot** (lines 320–325): `<span className="h-1.5 w-1.5 rounded-full bg-amber-500 ...">` — rendered only when `showGoldDot` is true (`urgent || unread_count > 0`). So when the first card is unread (or urgent) it has this dot; a read selected card does not.
  2. **Unread badge** (lines 351–355): `InboxStatusBadge variant="action"` ("Unread") — only when `unread_count > 0`. First card (often unread) has it; read selected cards do not.
  3. **Top edge:** First card has no `divide-y` top border; others have a gray line above. So the first card’s selected background meets the list top with no divider.

So the **exact** things that can make the first selected card look different from other selected cards are:

- **Presence of the amber gold dot** next to the name (when first is unread/urgent and others are read).
- **Presence of the Unread badge** (when first is unread and others are read).
- **Absence of the top divider** on the first card only (structural).

---

## Root cause (exact)

1. **Content:** The first selected card often has **unread** (or urgent) state, so it gets the **gold dot** and **Unread badge**. Other selected cards are often **read**, so they get neither. The container classes are identical; the perceived difference is the **extra content** (dot + badge) on the first card.
2. **Structure:** The **first** card is the only one without a top border from `divide-y`, so its selected background runs to the top of the list; other selected cards have a gray line above. That can add a small visual difference.

So the “first card” look = **same selected container** (green + amber left border) **plus** gold dot (when unread/urgent) **plus** Unread badge (when unread) **plus** no top divider.

---

## Recommendation: same visual treatment for every selected card

**Preserve unread semantics:** Keep showing the Unread badge only when `unread_count > 0`. Do not show “Unread” for read conversations.

**Align selected card visuals with the desired “first card” style:**

- **Option A — Selection accent for all selected cards:**  
  When **selected**, always show the **amber dot** next to the name (same as current gold dot styling). Use it as a **selection indicator** for all selected cards. When the conversation is also unread (or urgent), keep the existing Unread/Urgent badges. So:
  - **Selected + read:** dot only (selection indicator).
  - **Selected + unread:** dot + Unread badge (dot doubles as selection + unread accent).
  - **Selected + urgent:** dot + Urgent badge (and optionally Unread if unread).

  Implementation: change `showGoldDot` for the **name row** from `urgent || (conversation.unread_count > 0)` to `isSelected || urgent || (conversation.unread_count > 0)` so that every selected card gets the same amber dot. Unread/urgent semantics stay (badges unchanged).

- **Option B — Structural consistency only:**  
  Do not change dot/badge logic. Only make the **first** card’s top edge match the others by giving the list a consistent top border (e.g. add `border-t border-slate-100` to the `divide-y` container so the first card also has a top edge). Then all cards share the same divider treatment. This addresses only the structural difference, not the content (dot/badge) difference.

- **Option C — Both:**  
  Apply Option A (always show dot when selected) and Option B (consistent top border) so selected cards match the “first card” look in both content and structure.

**Recommended:** **Option A** (or C if you also want the top-edge fix). Making `showGoldDot` true when `isSelected` gives every selected card the same amber accent as the first (unread) selected card, keeps unread/urgent semantics (badges unchanged), and avoids introducing a new UI element.

---

## Exact classes / logic responsible (summary)

| What | Where | Responsible logic / classes |
|------|--------|-----------------------------|
| Container (same for all selected) | Button `className` | `isSelected ? 'bg-emerald-50/90 border-l-amber-600/80'` |
| Gold dot (only when unread/urgent today) | Lines 320–325 | `showGoldDot = urgent \|\| (conversation.unread_count > 0)` → amber dot |
| Unread badge | Lines 351–355 | `conversation.unread_count > 0` → `InboxStatusBadge variant="action"` |
| First card has no top divider | Parent div line 279 | `divide-y divide-slate-100` → first child has no top border |

To make every selected card use the same visual treatment as the first selected card (while preserving unread semantics), the minimal code change is: **set `showGoldDot = isSelected || urgent || (conversation.unread_count > 0)`** so the amber dot appears for all selected cards.
