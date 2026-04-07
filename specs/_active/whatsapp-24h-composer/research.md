# Research: WhatsApp 24-Hour Composer Session

## 1. Rolling 24-hour window from last customer inbound

**Decision**: Use **24 × 60 × 60 × 1000** milliseconds from `Date.now()` compared to the parsed timestamp of the **latest** qualifying inbound message (`sent_at`).

**Rationale**: Matches Meta/WhatsApp Business “customer care” window description; spec FR-002/FR-003.

**Alternatives considered**: Calendar-day boundaries (rejected — not matching API behaviour).

## 2. Timestamp field

**Decision**: Primary **`sent_at`** on `InboxMessage`; if parsing fails or value absent, fallback to **`created_at`**.

**Rationale**: `sent_at` reflects message time; `created_at` is a stable fallback for edge rows.

**Alternatives considered**: `created_at` only (rejected — weaker semantic match for “when customer messaged”).

## 3. Scoping inbound messages (FR-010)

**Decision**: Consider only messages where:

- `m.conversation_id === activeConversationId`
- `m.channel === 'whatsapp'`
- `m.direction === 'inbound'`

**Rationale**: Unified customer timelines can include email/SMS/other conversation ids; session state must not treat those as opening the WhatsApp window.

## 4. No `activeConversationId` (no WhatsApp thread row yet)

**Decision**: Treat session as **closed** for freeform (`isWhatsAppSessionClosed === true` when `activeChannel === 'whatsapp'` and `!activeConversationId`), consistent with template-only / start-conversation flows already in the composer.

**Rationale**: There is no WhatsApp conversation to attach a session to; freeform send is not valid without a conversation id in current flow.

## 5. Interaction with existing `replyMode` effects

**Decision**:

- Keep **`useEffect` on `isTemplateAllowed`** that forces freeform when leaving WhatsApp (unchanged).
- Add **`useEffect` on `isWhatsAppSessionClosed`**: when `true`, `setReplyMode('template')` and open template fetch path (`setTemplatesOpen(true)`).
- **Narrow or remove** the old “empty `messages.length`” auto-template effect if it becomes redundant: the closed-session effect covers “no inbound WA” even when `messages.length > 0` (outbound-only thread). **Implementation note**: evaluate in PR — prefer single source of truth (`isWhatsAppSessionClosed`) to avoid double-setting.

**Alternatives considered**: Only expanding empty-thread check (rejected — fails when thread has outbound but no inbound within 24h).

## 6. Suggested reply `lastInboundMessage`

**Decision**: Drive `useSuggestedReply` from the **same scoped** last inbound WhatsApp message for the active conversation (or `null` if none).

**Rationale**: Current code uses last inbound **any channel** in full array; on mixed timelines that can be wrong. Aligning with FR-010 fixes UX and avoids irrelevant suggestions.
