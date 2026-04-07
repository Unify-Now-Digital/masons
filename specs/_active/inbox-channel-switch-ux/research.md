# Research: Inbox Channel Switching UX

## Decision: Fix `handleReplyChannelChange` with explicit empty context

**Rationale**: Today the handler returns early when no `latest` conversation exists (`if (!latest) return`), so the channel filter never updates and the UI appears broken.

**Alternatives considered**:

- Only update `channelFilter` without clearing selection — would show wrong thread while pill says another channel.
- Always navigate to a synthetic id — not possible without DB rows.

**Chosen approach**: Always update `channelFilter`; if no thread, clear `selectedConversationId` and store `{ personId, channel }` for empty-state UX and modal prefill.

---

## Decision: Customers tab — `availableChannels` must not depend on existing conversation rows

**Rationale**: `ConversationThread` builds `availableChannels` from `conversationIdByChannel` when that map is provided, which **omits** channels with `null` ids—so the ChannelSelector cannot select WhatsApp/Email until a conversation exists (chicken-and-egg).

**Alternatives considered**:

- Add a separate prop `selectableChannels` vs `activeConversationIds` — more explicit.
- Merge `enabledReplyChannels` with union of keys from map — **use `enabledReplyChannels` from parent when present** as the authoritative list for which pills show; keep `conversationIdByChannel` only for resolving `activeConversationId`.

**Chosen approach**: For Customers mode, prefer parent-provided `enabledReplyChannels` for which channels appear; use `conversationIdByChannel` only to resolve the active conversation id (may be null).

---

## Decision: WhatsApp default template mode

**Rationale**: Spec requires template mode when starting a **new** WhatsApp conversation.

**Locked rule (2026-04-08)**: Default to template when **`messages.length === 0`** for the **entire** `messages` array passed into `ConversationThread` (Customers = full cross-channel timeline; Conversations = single-thread messages). When the timeline already has any message, do not force template on channel switch.

---

## Decision: Single `NewConversationModal` instance

**Rationale**: Reuse hook and modal; avoid duplicate dialogs and duplicate `useCreateConversation` wiring.

**Chosen approach**: Keep modal on `UnifiedInboxPage`; pass `onRequestStartConversation` from Customers/Conversations children via props/callbacks to open with context.

---

## Decision: SMS unsupported copy

**Rationale**: Clarification defers SMS new conversation; only improve switching UX and show honest messaging.

**Chosen approach**: Inline helper text + no primary CTA that implies create; optional subtle link to switch channel.
