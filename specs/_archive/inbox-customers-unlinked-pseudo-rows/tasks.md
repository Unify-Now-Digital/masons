# Tasks — Inbox Customers unlinked pseudo-rows

## Phase A — Types & keys

- [X] A1: Add `CustomerThreadRow` discriminated union in `inbox.types.ts`.
- [X] A2: Add `CustomersSelection` type (or document string token format) for page state.
- [X] A3: Extend `inboxKeys.messages` with `unlinkedTimeline(channel, handle)` in `useInboxConversations.ts`.

## Phase B — API & timeline

- [X] B1: Extend `ConversationFilters` + `fetchConversations` with `primary_handle_exact` (and reuse `unlinked_only` + `channel`).
- [X] B2: Implement `useUnlinkedHandleTimeline` in `useInboxMessages.ts` using narrow fetch + `fetchMessagesByConversationIds`.

## Phase C — Left list

- [X] C1: Refactor `useCustomerThreads.ts`: linked map + unlinked map + merge + sort + corrected **Unlinked** filter semantics.
- [X] C2: Update `CustomerThreadList.tsx`: render union, **Unlinked** badge, stable keys, selection callbacks.

## Phase D — Page & middle pane

- [X] D1: `UnifiedInboxPage.tsx`: discriminated selection; `activePersonId` null for unlinked; read/unread + auto-read; pass props to list + `CustomerConversationView`.
- [X] D2: `CustomerConversationView.tsx`: props for linked vs unlinked; header labels; wire timeline + summary hooks.
- [X] D3: `PersonOrdersPanel.tsx`: confirm null `personId` UX.

## Phase E — AI summary backend

- [X] E1: New migration: `user_id`, `unlinked_timeline` scope, columns, unique index, RLS policies.
- [X] E2: Update `inbox-ai-thread-summary/index.ts`: parse scope, load messages, upsert summary row with `user_id`.

## Phase F — AI summary client

- [X] F1: Extend `useThreadSummary.ts` scope union + `fetchThreadSummary` body + query key.

## Phase G — QA

- [X] G1: Manual checklist from `quickstart.md`.
- [X] G2: Regression: linked-only flows, Conversations tab, Gmail reply paths unchanged.
