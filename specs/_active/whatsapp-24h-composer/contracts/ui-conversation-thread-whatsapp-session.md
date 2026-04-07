# UI Contract: ConversationThread — WhatsApp Session

**Scope**: `src/modules/inbox/components/ConversationThread.tsx` — composer region when `activeChannel === 'whatsapp'`.

## Session closed (UI MUST)

1. Show a **banner** directly **above** the reply composer (above “Replying to…” if present), **amber/yellow** background, readable contrast, with substance:
   - *“WhatsApp session expired. You can only send template messages until the customer replies.”*
2. **Hide** the Freeform / Template **toggle** (no way to switch to freeform).
3. Keep composer in **template** mode (`replyMode === 'template'`) while closed; template selector and variables behave as today.
4. **No** change to Email or SMS composer chrome.

## Session open (UI MUST)

1. **No** expiry banner.
2. **Show** Freeform / Template toggle (existing behaviour).
3. User may use freeform or template send paths as today.

## Eligibility (logic MUST)

- Session **open** iff: `activeConversationId` is set, there exists at least one inbound WhatsApp message for that conversation id in `messages`, and the latest such message’s time is **strictly within** the last 24 hours (per `research.md`).
- Session **closed** otherwise when `activeChannel === 'whatsapp'`.

## Non-goals (this contract)

- Backend validation of 24h window (out of scope).
- New shared components or hooks files.
