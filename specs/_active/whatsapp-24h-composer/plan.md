# Implementation Plan: WhatsApp 24-Hour Session Window (Composer)

**Branch**: `feature/whatsapp-24h-composer` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification + `/speckit.clarify` (Session 2026-04-08) + scope note: **single-file change** — `ConversationThread.tsx` only.

## Summary

Derive **WhatsApp session open/closed** from already-loaded `messages` (FR-010): only rows with `conversation_id === activeConversationId`, `channel === 'whatsapp'`, `direction === 'inbound'`, compared via `sent_at` to “now”. When **closed** and the user is composing for WhatsApp: show an **amber banner** above the composer, force **template** reply mode, and **hide** the Freeform/Template toggle. When **open**, preserve current behaviour (toggle + freeform). Email/SMS unchanged. **No** new files, hooks, or backend work.

## Technical Context

**Language/Version**: TypeScript, React 18 (Vite app)  
**Primary Dependencies**: Existing `InboxMessage` types, Tailwind-style classes in-file  
**Storage**: N/A (in-memory from props)  
**Testing**: Manual / existing E2E patterns; no new test files required by this plan  
**Target Platform**: Web (desktop + responsive inbox)  
**Project Type**: React feature module (`src/modules/inbox/components/`)  
**Performance Goals**: O(n) scan over `messages` per render; n typical for one conversation is small  
**Constraints**: **Only** `src/modules/inbox/components/ConversationThread.tsx` modified; no new components (banner as inline JSX); no new hooks  
**Scale/Scope**: One derived boolean + effects + conditional UI in a single component

## Constitution Check

*GATE: Passed — no routing, no new RLS, no Edge Functions, no schema.*

- **Dual router**: No changes to `src/app/` or `src/pages/`.
- **Module boundaries**: Single file under `src/modules/inbox/components/`.
- **RLS / Supabase**: No new data access.
- **Secrets**: None.
- **Additive-first**: Behaviour additive/conditional; existing Email/SMS paths untouched when `activeChannel !== 'whatsapp'`.

## Project Structure

### Documentation (this feature)

```text
specs/_active/whatsapp-24h-composer/
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-conversation-thread-whatsapp-session.md
└── spec.md
```

### Source Code (change set)

```text
src/modules/inbox/components/
└── ConversationThread.tsx   # ONLY file modified
```

**Structure Decision**: All logic and UI live in `ConversationThread.tsx` per product constraint.

## Implementation Outline (ConversationThread.tsx)

1. **Scoped message list for WhatsApp session**  
   From `messages`, filter: `m.conversation_id === activeConversationId`, `m.channel === 'whatsapp'`, `m.direction === 'inbound'`. If `activeConversationId` is null, treat as **no** qualifying inbound rows (session closed when on WhatsApp with no thread).

2. **`lastInboundWhatsAppForSession` (useMemo)**  
   Latest inbound by maximum `sent_at` (parse `Date`, fallback `created_at` if `sent_at` missing — see research.md).

3. **`isWhatsAppSessionClosed` (useMemo)**  
   **Closed** when `activeChannel === 'whatsapp'` **and** at least one of:
   - `!activeConversationId` (no WhatsApp thread to send on yet), or
   - no inbound messages scoped to the current WhatsApp conversation (`conversation_id === activeConversationId`, `channel === 'whatsapp'`, `direction === 'inbound'`), or
   - the latest such inbound message’s timestamp is **at or before** “now minus 24 hours” (inclusive 24-hour boundary: `Date.now() - timestamp >= 24h` in ms).  
   **Otherwise** (WhatsApp channel, have conversation id, and last scoped inbound is **within** the last 24 hours): session is **open** (`isWhatsAppSessionClosed === false`).  
   For any non-WhatsApp `activeChannel`, `isWhatsAppSessionClosed` is always **false** (no banner / no lock).

4. **`useEffect`**  
   When `isWhatsAppSessionClosed` is true and WhatsApp is the active channel: `setReplyMode('template')`, `setTemplatesOpen(true)` (so template list can load). When it becomes false: do **not** force freeform (user may stay on template); ensure existing `isTemplateAllowed` effect still resets non-WA to freeform.

5. **Reconcile with existing empty-thread effect** (lines ~456–461)  
   Today: WhatsApp + `activeConversationId` + `messages.length === 0` → template. New logic: session closed covers “no inbound WA” and “stale inbound”; empty total messages may still have outbound only — **scoped** inbound empty ⇒ closed. Merge behaviour: the new `isWhatsAppSessionClosed` should subsume the empty-thread case for WA when there is no inbound in scope (not merely `messages.length === 0`).

6. **Banner**  
   Inline block **above** the composer wrapper (border-t section), visible when `isWhatsAppSessionClosed && isTemplateAllowed`, amber/yellow styling, copy per spec.

7. **Toggle visibility**  
   Render Freeform/Template buttons only when `isTemplateAllowed && !isWhatsAppSessionClosed`.

8. **`lastInboundMessage` for `useSuggestedReply`**  
   Replace or parallel with **scoped** last inbound (same filter as FR-010) so suggestions match the conversation used for session (avoids using SMS/email inbound as “last” on unified timeline).

9. **Send / textarea**  
   When closed, reply path is already template when `replyMode === 'template'`; ensure textarea remains disabled in template mode as today; no freeform send when closed.

## Complexity Tracking

None — no constitution violations.

## Phase 0 & Phase 1 Outputs

- **research.md**: 24h window definition, timestamp field, interaction with existing effects.
- **data-model.md**: Derived state only (no DB entities).
- **contracts/**: UI behaviour contract for composer.
- **quickstart.md**: Manual verification steps.

---

## Post-Design Constitution Re-check

Still passes: no new surfaces, single-file additive UI.
