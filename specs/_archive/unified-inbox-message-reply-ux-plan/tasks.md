# Tasks: Unified Inbox Message-Level Reply UX

**Branch:** `staging` (or feature branch created from it)  
**Spec:** `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-message-reply-ux.md`

**Guardrails:** UI only. No schema, API, or send logic changes. All tab only; single-channel tabs unchanged.

---

## Phase 0: State ownership and callback

**File:** `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\AllMessagesTimeline.tsx`

- [x] Add local state: `replyTo`, `setReplyTo` (type `ReplyToInfo | null`; import from ConversationThread or types).
- [x] Implement `handleReplyToMessage(message: InboxMessage)`:
  - Build preview from `message.body_text` (strip HTML if needed, trim, slice to ~60 chars, add "…" if truncated).
  - Call `setReplyTo({ messageId: message.id, preview, channel: message.channel })`.
- [x] Pass to ConversationThread: `replyTo`, `onReplyToClear={() => setReplyTo(null)}`, `onReplyToMessage={handleReplyToMessage}`.

**Acceptance:** AllMessagesTimeline owns replyTo and passes the new props; build passes.

---

## Phase 1: Reply action on message bubbles (ConversationThread)

**File:** `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationThread.tsx`

- [x] Add optional prop: `onReplyToMessage?: (message: InboxMessage) => void`.
- [x] In the message bubble render block: when `isUnifiedMode && !readOnly && onReplyToMessage` (unified mode with composer), add a **Reply** button or link on each bubble.
  - Use `e.stopPropagation()` on click so the bubble’s existing click (e.g. `onMessageClick`) is not fired when the user clicks Reply.
  - On click: `onReplyToMessage(message)`.
- [x] When `readOnly` is true (e.g. All tab with messages but composer was read-only in an older build), do not show Reply; when composer is shown in All tab, `readOnly` is false, so Reply appears only in the All tab unified view. Single-channel tabs use ConversationView and do not pass `onReplyToMessage`, so no Reply action there.

**Acceptance:** In All tab, each message shows a Reply control; clicking it calls the parent callback. Single-channel view unchanged.

---

## Phase 2: Lock channel selector when replyTo is set

**File:** `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationThread.tsx`

- [x] When `replyTo` is set and we are in unified mode:
  - Force `selectedChannel` to `replyTo.channel` (e.g. in the existing `useEffect` that syncs from `effectiveDefault`, or a dedicated effect when `replyTo` is set).
  - Do not allow the user to change the channel: either **disable** the channel Select or **hide** the dropdown and show a read-only label (e.g. “Replying via Email”) until replyTo is cleared.
- [x] When `replyTo` is cleared (onReplyToClear), rely on existing `effectiveDefault` logic so `selectedChannel` returns to defaultChannel ?? mostRecentInbound ?? 'email'.

**Acceptance:** While the chip is set, channel is locked; after clear, channel restores.

---

## Phase 3: Scroll composer into view on Reply

**File:** `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationThread.tsx`

- [x] Add a ref (e.g. `composerRef`) attached to the composer wrapper div (the border-t pt-4 section).
- [x] In a `useEffect`, when `replyTo` changes from null to non-null: call `composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` (or equivalent) so the composer is brought into view.

**Acceptance:** Clicking Reply scrolls the composer into view when it is below the fold.

---

## Phase 4: QA and build

- [x] All tab: Reply on a message → chip appears, channel locked, composer in view; clear chip → channel restored.
- [x] Email/SMS/WhatsApp tabs: no Reply on bubbles; no regressions.
- [x] `npm run build` and `npm run lint` pass.

---

## Progress tracking

| Phase | Status |
|-------|--------|
| Phase 0: State ownership and callback | Complete |
| Phase 1: Reply action on bubbles | Complete |
| Phase 2: Lock channel when replyTo set | Complete |
| Phase 3: Scroll composer into view | Complete |
| Phase 4: QA and build | Complete |
