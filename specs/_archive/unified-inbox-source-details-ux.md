# Unified Inbox — Message “Source Details” Metadata

## Overview

Add compact, channel-specific “source details” metadata to each message in Unified Inbox threads so users can quickly understand email/phone context (subject, from/to, number/handle) without opening a separate thread.

**Context:**
- Primary surface: **All tab** unified mixed-channel timeline (person timeline via `AllMessagesTimeline` → `ConversationThread`).
- Secondary surface: **Single-channel threads** in `ConversationView` (also using `ConversationThread`), where metadata should remain subtle and non-distracting.
- **Single source of truth:** `src/modules/inbox/components/ConversationThread.tsx`. Any helpers or minor types should live here.

**Goal:**
- For each bubble, show a **one-line, muted metadata row** that surfaces the most useful channel-specific details:
  - Email: subject (+ from/to).
  - SMS/WhatsApp: from/to number/handle.
- Preserve existing layout, alignment, and behaviors (reply-to, color borders, read/unread, auto-scroll).

---

## Current State Analysis

### ConversationThread message bubbles

**File:** `src/modules/inbox/components/ConversationThread.tsx`

**Current behavior:**
- Renders `InboxMessage[]` as bubbles with:
  - Inbound vs outbound by alignment (`justify-start`/`justify-end`) and background color (`bg-slate-100` vs `bg-blue-500`).
  - Channel (`message.channel`) used for:
    - Email HTML vs text rendering (iframe + View raw toggle).
    - Channel-colored **left border** via `getChannelBorderClass(...)`.
  - Timestamp as a small line under the content.
  - Reply UX (Reply button, reply-to chip, channel lock) already implemented.
- **Source details today:**
  - No dedicated subject line.
  - No explicit “From: / To:” summary; users infer from surrounding UI, not per-bubble metadata.

**Constraints:**
- Bubbles are intentionally compact; adding metadata must not significantly increase height.
- All tabs (All + Email/SMS/WhatsApp) share the same rendering.

### Data available on messages

**Type:** `InboxMessage` (`src/modules/inbox/types/inbox.types.ts`)

Key fields:
- `channel: 'email' | 'sms' | 'whatsapp'`
- `direction: 'inbound' | 'outbound'`
- `body_text: string`
- `subject: string | null` (email)
- `from_handle: string`
- `to_handle: string`

**Observations:**
- We can derive:
  - **Email subject** from `subject`.
  - **Handles/phone numbers** from `from_handle` / `to_handle`.
- No schema or API changes are needed; everything is available on `InboxMessage`.

---

## Recommended Schema Adjustments

### Database Changes

- **None.** Feature is **presentation-only** and uses existing message fields.

### Query/Data-Access Alignment

- Continue to use:
  - `usePersonUnifiedTimeline` for All tab.
  - `useMessagesByConversation` for single-channel threads.
- No new queries or joins required.

---

## Implementation Approach

### Phase 1: Helpers for subject and from/to lines

In `ConversationThread.tsx`, add small pure helpers:

- `deriveSubject(message: InboxMessage): string | null`
  - For email (`channel === 'email'`):
    - Use `message.subject?.trim()` when non-empty.
    - Return `null` when missing or blank (no subject line rendered).
  - For SMS/WhatsApp: return `null` (no subject).

- `deriveFromToLine(message: InboxMessage): string | null`
  - Compute:
    - If `message.direction === 'inbound'`:
      - `"From: <handle>"` using `from_handle`.
    - Else (outbound):
      - `"To: <handle>"` using `to_handle`.
  - For SMS/WhatsApp, the handle is the phone number or best-available identifier.
  - Return `null` if handle is missing.

- `formatHandle(handle: string): string`
  - Light normalization for display (e.g. trim, maybe basic phone spacing).
  - No heavy formatting; safe fallback is the raw handle.

### Phase 2: Render metadata row in the bubble

Within the inner bubble div (where content and timestamp are rendered):

- Insert a **single metadata row** above the body content:

  - Structure:
    - Optional subject (email only) first.
    - Optional from/to line second.
    - If both exist, they can be separated by a small dot or “·”.

  - Styling:
    - `text-[11px] text-muted-foreground leading-tight truncate`
    - Single line, truncated:
      - Use `truncate` or `line-clamp-1` to avoid tall bubbles.

- Logic:
  - Email:
    - Show subject if `deriveSubject` returns non-null.
    - Show from/to line from `deriveFromToLine`.
  - SMS/WhatsApp:
    - No subject.
    - Show from/to line using `from_handle` / `to_handle`.
  - If **both** subject and from/to are null, omit metadata completely for that message.

### Phase 3: Preserve layout and interactions

- Do **not** change:
  - Outer flex layout or alignment (`justify-start` / `justify-end`).
  - Existing padding, rounding, or reply button positioning.
  - Channel border classes (`getChannelBorderClass`) or hover opacity.
  - Reply-to chip, reply button, auto-scroll, or read/unread behavior.

- Ensure metadata row:
  - Sits inside the bubble above the main body text.
  - Does not overlap or collide with the Reply button row or timestamp row.

### Safety Considerations

- Presentation-only; risks are visual regressions:
  - Overly tall bubbles if truncation is incorrect.
  - Too-dark or too-light text; keep muted but readable.
- Tests/QA:
  - All tab with mixed channels (email + SMS + WhatsApp).
  - Single-channel Email, SMS, WhatsApp views.
  - Light and dark themes.

---

## What NOT to Do

- Do **not**:
  - Add or modify database columns (no schema changes).
  - Call new APIs solely for metadata.
  - Render full email headers or multi-line metadata blocks.
  - Change reply, read/unread, or auto-scroll logic.
  - Introduce new props on parent components unless absolutely necessary (keep everything local to `ConversationThread`).

---

## Open Questions / Considerations

- Whether to:
  - Always show metadata in single-channel tabs, or only in All tab unified mode (initial implementation can always show; can be toggled later if needed).
  - Add a small channel icon next to subject/from-to in future iterations (out of scope now).
- Exact truncation behavior:
  - Whether to prefer truncating subject first vs from/to when space is limited.
  - Whether to use tooltips for full subject/from-to (likely a future enhancement).

