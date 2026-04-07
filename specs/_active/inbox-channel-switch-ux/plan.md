# Implementation Plan: Inbox Channel Switching UX

**Branch**: `feature/inbox-channel-switch-ux` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification + locked clarifications (modal reuse, Customers two-step start, SMS deferred, email subject required, WhatsApp default template mode)

---

## Summary

Fix channel switching so it never no-ops: **Conversations** tab always updates the selected channel, shows an actionable empty state when no thread exists for that channel, and opens the existing **NewConversationModal** for Email/WhatsApp (SMS shows “not supported”). **Customers** tab keeps the unified timeline visible, allows selecting any enabled channel even without a per-channel thread, and shows **Start conversation** (opening the same modal via `useCreateConversation`) before enabling send; after creation, WhatsApp replies default to **template** mode.

**Scope**: Frontend only. No schema changes. No new top-level components—only minor UI (buttons, copy, optional modal props).

---

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite  
**Primary Dependencies**: TanStack React Query, shadcn/ui, Tailwind, React Router  
**Storage**: Existing Supabase tables only (no migrations)  
**Testing**: Manual verification via [quickstart.md](./quickstart.md)  
**Target Platform**: Web — Inbox module (`UnifiedInboxPage` and children)  
**Constraints**: Frontend-only; reuse `NewConversationModal`, `useCreateConversation`, `ConversationThread` template mode; no new DB columns or edge functions  
**Scale/Scope**: Four primary files + optional small prop additions to wire modal prefill

---

## Constitution Check

Aligned with `.specify/memory/constitution.md` (v0.1.0).

| Principle | Status | Notes |
|-----------|--------|-------|
| Dual Router Constraint | ✅ Pass | No changes under `src/app/` or `src/pages/` routing |
| Feature modules own UI + data | ✅ Pass | Edits under `src/modules/inbox/` only; existing `@/modules/customers` hook usage unchanged |
| Supabase / RLS | ✅ Pass | No new tables, migrations, or policy changes |
| Secrets server-side | ✅ Pass | Frontend-only; no new edge functions or keys on client |
| Additive-first, minimise regressions | ✅ Pass | Optional props, conditional UI; existing send paths preserved |

---

## Project Structure

### Documentation (this feature)

```text
specs/_active/inbox-channel-switch-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── ui-contracts.md
    └── component-props.md
```

### Source Code Layout (touch points)

```text
src/modules/inbox/pages/UnifiedInboxPage.tsx           MODIFIED — handleReplyChannelChange, empty-context state, modal wiring
src/modules/inbox/components/ConversationView.tsx    MODIFIED — empty state when no selection but channel/person context
src/modules/inbox/components/CustomerConversationView.tsx  MODIFIED — pass start-conversation handlers; fix channel list
src/modules/inbox/components/ConversationThread.tsx  MODIFIED — unified: start CTA, SMS copy, default template mode
src/modules/inbox/components/NewConversationModal.tsx MODIFIED — required email subject; optional initial channel/person/lock
```

---

## Phase 0: Research Findings

See [research.md](./research.md). Resolved decisions:

- **Conversations no-op**: `handleReplyChannelChange` returns when `latest` is missing; list filter is not updated in that path.
- **Customers blocked send**: `activeConversationId` is null when `conversationIdByChannel[channel]` is null; `availableChannels` currently excludes channels without an id, preventing channel selection.
- **Modal**: Email subject labeled optional; validation allows null subject.

---

## Phase 1: Design

### 1. `UnifiedInboxPage` — `handleReplyChannelChange`

- Always call `setChannelFilter(target)`.
- If a `latest` conversation exists for `current.person_id` + `target`: `setSelectedConversationId(latest.id)` and **clear** any “empty channel” context.
- If none: `setSelectedConversationId(null)` and set **page-level state** (e.g. `emptyChannelStartContext: { personId, channel } | null`) sourced from `current.person_id` and `target`, so the middle column can render empty UI + `Start new conversation` / SMS notice.
- Selecting a row from the list clears `emptyChannelStartContext`.
- Wire **NewConversationModal** open from empty state with **initial channel + person** (new optional modal props).

### 2. `ConversationView` — Conversations tab empty state

- Extend props: e.g. `emptyChannelContext` + `onRequestNewConversation` + `onClearEmptyContext` (exact names in [component-props.md](./contracts/component-props.md)).
- When `conversationId` is null **and** `emptyChannelContext` is set:
  - **Email / WhatsApp**: show copy + button → open modal with prefilled channel + `person_id`.
  - **SMS**: show copy that **starting a new SMS conversation is not supported** (no modal).
- When `conversationId` is null and no context: keep existing “Select a conversation…” (e.g. initial load).

### 3. `CustomerConversationView` + `ConversationThread` — Customers tab

- **Channel selector**: Base `availableChannels` on **person handles** (`enabledReplyChannels`) for linked customers, not on `conversationIdByChannel` presence—so user can pick Email/SMS/WhatsApp even when that channel has no row yet. Keep `disabledChannels` derived from missing contact info (no email → email disabled, etc.).
- When `!activeConversationId` for the selected channel:
  - Replace “disabled send + warning only” with **Start conversation** (Email/WhatsApp) opening the shared modal with `person_id` + channel; **SMS** shows unsupported message.
- After successful `useCreateConversation`, invalidate queries (existing patterns) so `conversationIdByChannel` updates; composer enables.
- **WhatsApp**: When the active conversation for the selected channel has **no outbound/inbound yet** (or `messages` for that channel empty—see research), set **template** mode by default (`replyMode === 'template'`, optionally trigger template fetch). Prefer a narrow `useEffect` keyed on `activeConversationId` + channel + message count to avoid fighting user toggles after first send.

### 4. `NewConversationModal`

- **Email**: Subject **required** — update label, `validationError`, and `canSubmit`; pass non-empty trimmed `subject` in `onStart`.
- **Optional props** (backward compatible): `defaultChannel`, `defaultPersonId`, `channelLocked` (hide channel toggle when opening from empty-state with fixed channel).

### 5. `handleNewConversationStart` (UnifiedInboxPage)

- On success, clear `emptyChannelStartContext`, set selection + `channelFilter` as today.

---

## Phase 2: Implementation Order (suggested)

1. `NewConversationModal` — required subject + optional prefill props (unblocks other work).
2. `UnifiedInboxPage` — `handleReplyChannelChange` + empty context state + modal open from `ConversationView`.
3. `ConversationView` — empty state branches.
4. `ConversationThread` — Customers unified: channel list fix + start CTA + SMS copy + WhatsApp default template when appropriate.
5. `CustomerConversationView` — pass callbacks and modal control (lift modal to page or pass `onOpenNewConversation` from page—prefer **single modal instance** on `UnifiedInboxPage` with props driven by source: conversations empty vs customers start).

**Note**: If modal is only mounted on `UnifiedInboxPage`, add props/callbacks from `CustomerConversationView` → `UnifiedInboxPage` **or** duplicate modal in Customers path—**prefer single modal** on the page with `open`/`context` state to satisfy “reuse modal” and avoid double dialogs.

---

## Agent Context Update

`.specify/scripts/` is not present in this repo; **skipped** (no `update-agent-context.ps1`). If Speckit is added later, re-run agent context update for Inbox channel UX.

---

## Constitution Check (post-design)

| Gate | Status |
|------|--------|
| All clarifications addressed | Pass — see FR-003–014 in spec |
| No unjustified backend scope | Pass |

---

## Deliverables

| Artifact | Path |
|----------|------|
| Plan | `specs/_active/inbox-channel-switch-ux/plan.md` |
| Research | `specs/_active/inbox-channel-switch-ux/research.md` |
| Data model (UI state) | `specs/_active/inbox-channel-switch-ux/data-model.md` |
| Contracts | `specs/_active/inbox-channel-switch-ux/contracts/` |
| Quickstart | `specs/_active/inbox-channel-switch-ux/quickstart.md` |

---

## Extension Hooks

None — `.specify/extensions.yml` not present.
