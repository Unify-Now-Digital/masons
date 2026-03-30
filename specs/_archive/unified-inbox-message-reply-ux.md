# Unified Inbox — Message-Level Reply UX

## Overview

**Goal:** Finish message-level reply UX in the Unified Inbox so users can start a reply from a specific message in the All tab.

**Scope:**
- Add a **Reply** action to individual message bubbles in `ConversationThread`.
- Clicking Reply:
  - Sets `replyTo` state (messageId, preview, channel).
  - Locks the channel selector in unified mode to the message’s channel.
  - Scrolls the composer into view.
- No provider-level quoting yet (no Gmail In-Reply-To, no SMS/WhatsApp quoted text).
- No schema or send logic changes.

---

## Non-goals

- No Gmail In-Reply-To headers yet.
- No SMS/WhatsApp quoting text yet.

---

## Functional Requirements

### A) Reply action on message bubbles

- In **All tab** only (unified timeline with composer), each message bubble MUST expose a **Reply** action (e.g. button or link).
- Single-channel tabs (Email / SMS / WhatsApp) are **unchanged** — no per-message Reply action there; composer remains single-channel as today.

### B) Clicking Reply

1. **Set replyTo state**  
   When the user clicks Reply on a message:
   - Set `replyTo` to `{ messageId, preview, channel }`:
     - `messageId`: message id.
     - `preview`: short text from the message body (e.g. first 40–80 chars, sanitized).
     - `channel`: that message’s channel (`email` | `sms` | `whatsapp`).
2. **Lock channel selector**  
   While `replyTo` is set, the channel dropdown in unified mode MUST be locked to `replyTo.channel` (user cannot change channel until they clear the reply).
3. **Scroll composer into view**  
   After setting `replyTo`, scroll the reply composer area into view so the user can type immediately.

### C) Clearing the reply chip

- When the user clears the “Replying to…” chip:
  - Clear `replyTo`.
  - **Restore** the previous channel selection (e.g. back to defaultChannel or most recent inbound channel), i.e. channel selector is no longer locked and shows the prior effective default.

### D) Scope and unchanged behavior

- **All tab only:** Reply action and replyTo/channel-lock/scroll behavior apply only when the All tab unified timeline is shown (i.e. when `ConversationThread` is used with `conversationIdByChannel` and composer visible).
- **Single-channel tabs:** No Reply action on bubbles; no replyTo; no channel dropdown. Behavior unchanged.

---

## Acceptance Criteria

- [ ] Reply chip appears with correct channel when user clicks Reply on a message (All tab).
- [ ] Channel selector is locked to that message’s channel while the chip is set.
- [ ] Clearing the chip restores the previous channel selection (and unlocks the dropdown).
- [ ] Composer scrolls into view when Reply is clicked.
- [ ] Works in All tab only; single-channel tabs unchanged.
- [ ] No schema or send logic changes; no quoting in message body yet.

---

## Technical Context

- **ConversationThread** already supports `replyTo`, `onReplyToClear`, and a channel dropdown in unified mode (`conversationIdByChannel`).
- **AllMessagesTimeline** passes `conversationIdByChannel`, `defaultChannel`, and `onSendSuccess`; it does not yet own `replyTo` state or pass a Reply handler.
- **Implementation:** AllMessagesTimeline holds `replyTo` state and an `onReplyToMessage(message)` callback; ConversationThread receives `replyTo` and `onReplyToClear`, shows a Reply action on each bubble in unified mode, and when replyTo is set locks the channel selector and scrolls the composer into view. Clearing the chip clears `replyTo` and restores channel selection (e.g. via existing effectiveDefault logic).
