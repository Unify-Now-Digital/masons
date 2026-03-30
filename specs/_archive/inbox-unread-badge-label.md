# Inbox Unread Badge — Static "Unread" Label

## Overview

Replace the numeric unread badge on Inbox conversation cards (e.g. "1 unread", "2 unread") with a single static label "Unread" whenever the conversation has unread messages. Purely visual; no change to data, queries, or read/unread logic.

**Context:**
- Inbox conversation list is rendered in `InboxConversationList.tsx`; there is no separate `ConversationCard.tsx` or `ConversationItem.tsx` — each card is a list item inside that component.
- Unread state is driven by `conversation.unread_count` from the API; the badge is shown when `unread_count > 0`.

**Goal:**
- Show a simple "Unread" badge instead of "{n} unread" on conversation cards when there are unread messages.
- Keep component, variant, styling, position, and spacing unchanged; only change the badge text.

---

## Current State Analysis

### Component and location

**File:** `src/modules/inbox/components/InboxConversationList.tsx`

**Current rendering (lines 349–354):**
```tsx
{conversation.unread_count > 0 && (
  <InboxStatusBadge variant="action">
    {conversation.unread_count} unread
  </InboxStatusBadge>
)}
```

- The badge uses **`InboxStatusBadge`** with **`variant="action"`** (not the generic shadcn `Badge`).
- Text is dynamic: `{conversation.unread_count} unread` (e.g. "1 unread", "2 unread", "3 unread").
- Visibility condition: `conversation.unread_count > 0`.
- It sits in a flex row with other badges (e.g. "Urgent", "Unlinked") in the conversation card metadata area.

### Logic rules (unchanged)

- **Show badge when:** `conversation.unread_count > 0`
- **Do not show badge when:** `conversation.unread_count === 0` (or null/undefined treated as 0)

---

## Required Change

**Single edit in** `src/modules/inbox/components/InboxConversationList.tsx`:

Replace the badge **text content** from the dynamic count to the static label.

**From:**
```tsx
{conversation.unread_count > 0 && (
  <InboxStatusBadge variant="action">
    {conversation.unread_count} unread
  </InboxStatusBadge>
)}
```

**To:**
```tsx
{conversation.unread_count > 0 && (
  <InboxStatusBadge variant="action">
    Unread
  </InboxStatusBadge>
)}
```

- **Do not change:** the condition (`unread_count > 0`), the component (`InboxStatusBadge`), the variant (`"action"`), wrapper structure, or surrounding layout.
- **Do not modify:** unread_count logic elsewhere, database, Supabase queries, message read logic, or conversation loading.

---

## What NOT to Do

- Do not change `unread_count` computation, API, or backend.
- Do not add or remove the badge based on any other condition.
- Do not change styling, variant, or position of the badge.
- Do not touch other badges (Urgent, Unlinked) or list structure.

---

## Open Questions / Considerations

- None; change is scoped to one string in one file.
