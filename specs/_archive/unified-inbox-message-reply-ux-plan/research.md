# Research: Unified Inbox Message-Level Reply UX

## Current implementation

### 1. ConversationThread (All tab unified mode)

- **File:** `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationThread.tsx`
- **Props already present:**
  - `replyTo?: ReplyToInfo | null` — `{ messageId, preview, channel }`
  - `onReplyToClear?: () => void`
  - `conversationIdByChannel`, `defaultChannel` for unified mode
- **Behavior today:**
  - When `replyTo` is set, the “Replying to…” chip is shown with preview and clear button.
  - Channel dropdown is **not** locked when `replyTo` is set; user can still change channel.
  - No “Reply” action on individual message bubbles; only `onMessageClick` (opens thread in channel tab).
  - Composer is not scrolled into view when replyTo is set.

### 2. AllMessagesTimeline

- **File:** `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\AllMessagesTimeline.tsx`
- **Current props passed to ConversationThread:** `messages`, `readOnly={false}`, `onMessageClick`, `conversationIdByChannel`, `defaultChannel`, `onSendSuccess`, `scrollContainerRef`.
- **Missing:** `replyTo` state is not owned here; no `onReplyToMessage` or equivalent. So there is no way to set replyTo from a message click in the All timeline.

### 3. Message bubble rendering (ConversationThread)

- Message bubbles are rendered in a `.map()` over `messages`.
- When `readOnly && onMessageClick`, the whole bubble is clickable and calls `onMessageClick(message)` (navigates to channel tab).
- No separate “Reply” control on the bubble. To add Reply without overloading click: add a **Reply** button/link that calls a new callback (e.g. `onReplyToMessage?.(message)`) and uses `e.stopPropagation()` so the bubble click (open thread) is not fired.

### 4. Channel selector lock

- When `replyTo` is set, `effectiveDefault` in ConversationThread is already `replyTo?.channel ?? defaultChannel ?? …`, so the selected channel follows replyTo. The dropdown remains editable. To **lock**: when `replyTo` is set, either disable the Select or hide it and show the locked channel label; do not allow `setSelectedChannel` while replyTo is set.
- On clear: parent clears `replyTo`; ConversationThread’s `effectiveDefault` no longer includes replyTo.channel, so the next sync (or a one-time “restore previous”) can reset selectedChannel to defaultChannel / mostRecentInbound. Existing `useEffect` that syncs `selectedChannel` from `effectiveDefault` will run when replyTo is cleared (effectiveDefault changes), so “restore previous” is achieved by clearing replyTo and letting effectiveDefault be defaultChannel ?? mostRecentInbound.

### 5. Scroll composer into view

- ConversationThread’s composer is inside the same Card (border-t pt-4 section). Options:
  - Add a `composerRef` (or ref to the composer wrapper div) and pass it to the parent so parent can call `composerRef.current?.scrollIntoView()`. Parent would call this when setting replyTo.
  - Or: ConversationThread receives `replyTo` from parent and in a `useEffect` when `replyTo` becomes non-null, call `composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`. Prefer this so scroll is self-contained in ConversationThread.

### 6. Preview text for replyTo

- `InboxMessage` has `body_text`. For preview: take `(message.body_text ?? '').trim()`, strip HTML if present, then slice to e.g. 40–80 chars and add "…" if truncated. No schema change.

### 7. Where replyTo state lives

- **Option A:** AllMessagesTimeline holds `replyTo` and `setReplyTo`; passes `replyTo` and `onReplyToClear={() => setReplyTo(null)}` and `onReplyToMessage={(msg) => { setReplyTo({...}); }}` to ConversationThread. ConversationThread stays presentational for replyTo (controlled).
- **Option B:** ConversationThread holds replyTo internally when in unified mode. Then we don’t need to pass replyTo from AllMessagesTimeline, but we lose the ability to “clear on send” from parent (we already clear in handleSendReply via onReplyToClear). So controlled from parent is simpler and matches existing chip/clear contract.

**Decision:** AllMessagesTimeline owns `replyTo` state; passes `replyTo`, `onReplyToClear`, and a new callback `onReplyToMessage(message)` to ConversationThread.

---

## File paths (absolute)

| Artifact | Path |
|----------|------|
| Feature spec | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-message-reply-ux.md` |
| ConversationThread | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationThread.tsx` |
| AllMessagesTimeline | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\AllMessagesTimeline.tsx` |
| Inbox types | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\types\inbox.types.ts` |

---

## Constraints

- No schema or API changes.
- No send logic changes.
- No Gmail In-Reply-To or SMS/WhatsApp quoting in this scope.
- Single-channel tabs (ConversationView) must remain unchanged; Reply action and replyTo only in All tab (ConversationThread used with conversationIdByChannel).
