# Unified Inbox — Channel-Based Message Bubble Color Coding

## Overview

Add clear, **subtle channel-based color coding** to message bubbles in the Unified Inbox so users can instantly see whether a message is Email, SMS, or WhatsApp — especially in mixed-channel timelines — without introducing visual noise.

**Context:**
- Feature applies to Unified Inbox message threads rendered by `ConversationThread`.
- Views in scope:
  - All tab unified mixed-channel timeline (person timeline + AllMessagesTimeline).
  - Single-channel threads (Email / SMS / WhatsApp) where `ConversationThread` is used (e.g. `ConversationView`).
- Color coding must work in both light and dark mode and stay consistent with existing inbound/outbound styling (alignment, bubble fills, typography).

**Goal:**
- Introduce subtle, accessible, channel-specific visual indicators on each message bubble:
  - Email → blue
  - SMS → green
  - WhatsApp → emerald/teal
- Preserve existing inbound vs outbound distinction and selection/hover states.
- Implement styling once in `ConversationThread` as the single source of truth, shared across All tab and single-channel tabs.

---

## Current State Analysis

### Message Rendering (ConversationThread)

**Component:** `ConversationThread`  
**File:** `src/modules/inbox/components/ConversationThread.tsx`

**Current Structure:**
- Props:
  - `messages: InboxMessage[]`
  - `readOnly?: boolean`
  - `conversationId?`, `channel?`
  - `conversationIdByChannel?`, `defaultChannel?` for All tab unified mode
  - `replyTo?`, `onReplyToClear?`, `onReplyToMessage?`, `onSendSuccess?`
  - `scrollContainerRef?` for auto-scroll
- Each `InboxMessage` is rendered as a **bubble**:
  - Inbound vs outbound is represented by:
    - Horizontal alignment (`justify-start` vs `justify-end`)
    - Background color (`bg-slate-100 text-slate-900` for inbound; `bg-blue-500 text-white` for outbound)
  - Email messages with likely HTML use an `iframe` to render sanitized HTML, with a `View raw / View formatted` toggle.
  - Timestamp rendered as small, muted text under the bubble.
- **Channel display:**
  - Channel is available as `message.channel` but **not visually encoded** in the bubble aside from context in headers or surrounding UI.

**Observations:**
- In the All tab unified timeline (mixed channels), Email, SMS, and WhatsApp messages **look very similar**, making it harder to scan by channel at a glance.
- Single-channel tabs are visually consistent, but still could benefit from a subtle channel cue for user confidence.
- Inbound/outbound styling is already clear and must not be compromised.

### Unified Timeline (AllMessagesTimeline)

**Component:** `AllMessagesTimeline`  
**File:** `src/modules/inbox/components/AllMessagesTimeline.tsx`

**Current Structure:**
- Builds a unified `messages: InboxMessage[]` for a person across Email/SMS/WhatsApp via `usePersonUnifiedTimeline`.
- Renders:
  - `ConversationHeader` (All channels)
  - `ConversationThread` in unified mode:
    - `conversationIdByChannel`, `defaultChannel`
    - `replyTo`, `onReplyToMessage`, `onReplyToClear`, `onSendSuccess`
- Delegates all message bubble rendering/styling to `ConversationThread`.

**Observations:**
- All tab is the **primary beneficiary** of clear channel cues, because it is a mixed-channel view.
- The right place to implement channel-based visuals is `ConversationThread` so both All tab and single-channel views stay consistent.

### Relationship Analysis

**Current Relationship:**
- `InboxMessage.channel` drives:
  - Which sending API is used (`useSendReply` routes by channel).
  - Which tab a conversation belongs to (Email / SMS / WhatsApp).
- `ConversationThread` currently uses `channel` for:
  - HTML vs plain rendering decisions.
  - Directional styling (`isEmail` logic on text wrapping).

**Gaps/Issues:**
- Channel is **not** visually encoded as a distinct color indicator on each bubble.
- Mixed timelines require the user to read more context (headers, chip labels) to know channel.

### Data Access Patterns

**How messages are currently accessed:**
- `useMessagesByConversation(conversationId)` and `usePersonUnifiedTimeline(personId)` fetch `InboxMessage[]` with `channel`, `direction`, `body_text`, `subject`, `sent_at`, etc.
- `ConversationThread` gets `messages` as props and does all per-message rendering.

**How they are displayed:**
- All tabs and channel tabs share `ConversationThread`, so any styling change here affects both.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **None.** Color coding is purely a **presentation/UI concern** and uses existing `InboxMessage.channel`.

**Non-Destructive Constraints:**
- No schema or RLS changes are required or desired for this feature.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Continue to use existing hooks:
  - `usePersonUnifiedTimeline` for All tab.
  - `useMessagesByConversation` for single-channel threads.
- No additional fields or joins are required to support channel-based styling.

**Recommended Display Patterns:**
- Derive channel styling inside `ConversationThread` via a small helper such as:
  - `getChannelClasses(channel, direction)` or `getChannelStyles({ channel, isInbound })`.
- Helper returns **Tailwind class strings** (no inline styles) that can be combined with existing inbound/outbound classes.

---

## Implementation Approach

### Phase 1: Define channel style helper

- Add a small, self-contained helper in `ConversationThread.tsx`:
  - Input: `channel: 'email' | 'sms' | 'whatsapp'`, `direction: 'inbound' | 'outbound'`.
  - Output:
    - Tailwind classes for:
      - Left border color (e.g. `border-l-2 border-l-sky-500`, `border-l-2 border-l-green-500`, `border-l-2 border-l-emerald-500` with alpha-safe variants for dark mode).
      - Optional background tint (e.g. `bg-sky-50` / `bg-sky-900/40`, `bg-green-50` / `bg-green-900/40`, `bg-emerald-50` / `bg-emerald-900/40`).
  - Ensure:
    - Inbound/outbound core colors remain recognizable.
    - Channel classes **augment** rather than fully replace current background colors (or, if updated, preserve contrast and direction clarity).

### Phase 2: Apply helper to message bubbles

- In `ConversationThread` message rendering:
  - Call the helper for each `message` to compute channel classes.
  - Apply:
    - A thin left border (`border-l-2` or `border-l-[3px]`) using channel color.
    - Optional subtle background tint on top of existing inbound/outbound palette (or tuned variant).
  - Respect:
    - Existing `isInbound` vs outbound logic (alignment and base colors).
    - Existing hover and selection styles by **adding** channel classes, not overriding state-specific classes.

### Phase 3: Light/dark mode tuning and accessibility

- Verify colors in both themes:
  - Use Tailwind’s palette tokens that are known to be accessible for text/background combinations.
  - Ensure border/tint has sufficient contrast against bubble background.
- Adjust if needed:
  - Consider using only border color in dark mode if tints reduce contrast.
  - Keep saturation low to avoid visual noise, especially in single-channel views.

### Safety Considerations

- No schema or network changes: risk is limited to visual regressions.
- Regression areas to check:
  - HTML email bubbles (iframe wrapper still readable with new border/tint).
  - Reply-to UX (chip, channel lock, Reply button).
  - Read-only vs editable modes.
- Testing:
  - All tab unified timeline with mixed channels.
  - Single-channel tabs (Email, SMS, WhatsApp).
  - Light and dark mode toggles.

---

## What NOT to Do

- Do **not**:
  - Change database schema, message tables, or APIs.
  - Alter send logic, reply behavior, read/unread logic, or auto-read effects.
  - Introduce bright, high-saturation fills or heavy gradients.
  - Overwrite or remove:
    - Inbound vs outbound differentiation.
    - Selection/hover states.
    - Reply-to highlighting and channel locking.
  - Add per-view special cases; styling logic must live centrally in `ConversationThread`.

---

## Open Questions / Considerations

- Exact Tailwind color tokens for:
  - Email blue (e.g. `sky` vs `blue` scale) that remains distinct from existing outbound blue fills.
  - SMS green vs WhatsApp emerald/teal — ensure both are distinguishable and harmonious.
- Whether to:
  - Use both border and background tint, or rely mainly on border to keep single-channel views extra subtle.
  - Add a small, optional channel icon or badge in the future if users need more explicit cues (out of scope for this spec).

