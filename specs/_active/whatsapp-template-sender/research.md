# Research: WhatsApp Template Sender

**Phase 0 — Architecture findings from codebase analysis**  
**Date**: 2026-03-31

---

## 1) Existing WhatsApp Reply Area

**Decision**: Extend `ConversationThread` as the single composer surface for template mode.

**Rationale**: `ConversationThread.tsx` already owns reply text, channel selection, send button, and `useSendReply` integration. Adding mode switch and template inputs there avoids duplicate composer logic.

**Alternatives considered**:
- New standalone template composer component mounted elsewhere: rejected (higher UI state duplication risk).

---

## 2) Current `inbox-twilio-send` Contract

**Decision**: Keep current freeform request/behavior intact; add template fields as optional additive path.

**Rationale**: Current edge function requires `conversation_id` + non-empty `body_text`. Existing production send flow depends on this contract, so template support must not break freeform callers.

**Alternatives considered**:
- Replace `body_text` contract entirely: rejected (breaking change).

---

## 3) Template Payload Shape

**Decision**: Support two request modes:
- Freeform mode: `{ conversation_id, body_text }`
- Template mode: `{ conversation_id, contentSid, contentVariables }`

**Rationale**: Twilio template sending uses `ContentSid` and `ContentVariables`; this is distinct from freeform `Body`.

**Alternatives considered**:
- Force both `Body` and content fields together: rejected (ambiguous source of truth).

---

## 4) Template List Retrieval

**Decision**: Fetch approved templates live from Twilio Content API each time template selector opens.

**Rationale**: Matches clarification decision, ensures fresh approved-template set, avoids stale cache pitfalls.

**Alternatives considered**:
- Persistent local cache only: rejected (can desync from Twilio approval state).

---

## 5) Template Message Storage in Timeline

**Decision**: Save fully rendered template text in `inbox_messages.body_text` (same as freeform).

**Rationale**: Existing timeline render logic already uses `body_text`; storing rendered text keeps UI behavior uniform without schema changes.

**Alternatives considered**:
- Store only template metadata and render later: rejected (requires new render logic/schema changes).

---

## 6) Variable Prefill Sources

**Decision**:
- Customer name: derive from linked person/order context already used by Inbox views.
- Staff variable `{{2}}`: use authenticated user's email for now.

**Rationale**: These sources already exist in current context and match clarified requirement.

**Alternatives considered**:
- Introduce a dedicated staff profile name source: deferred, out of scope.

---

## 7) Scope & Safety Constraints

**Decision**: No new DB tables/migrations; only modify four specified files; do not alter email/SMS send paths.

**Rationale**: Explicit scope guard from spec clarifications and user constraints.

**Alternatives considered**:
- Broader refactor across send stack: rejected (out of scope).
