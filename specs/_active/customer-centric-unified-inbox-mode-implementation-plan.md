# Implementation Plan: Customer-Centric Unified Inbox Mode

## Metadata
- **Feature spec:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/customer-centric-unified-inbox-mode.md`
- **Implementation plan:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/customer-centric-unified-inbox-mode-implementation-plan.md`
- **Plan artifacts dir:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/customer-centric-unified-inbox-mode-plan`
- **Branch:** `feature/customer-centric-unified-inbox-mode`
- **Technical context (from /plan request):**
  - additive-only unified mode
  - no breakage to existing tabs and channel views
  - frontend aggregation only (no new DB tables)
  - reuse `inbox_conversations` and `inbox_messages`
  - preserve existing send APIs and persistence logic

---

## Execution Flow

### Step 1: Input + Constraints Validation
- Confirmed feature source is `customer-centric-unified-inbox-mode.md`.
- Confirmed hard constraints are additive-only and no schema/table changes.
- Confirmed existing send stack must remain `useSendReply` + channel APIs.

### Step 2: Current-State Architecture Mapping
- Mapped active page: `src/modules/inbox/pages/UnifiedInboxPage.tsx`.
- Mapped list UI: `src/modules/inbox/components/InboxConversationList.tsx`.
- Mapped thread UI: `src/modules/inbox/components/ConversationView.tsx` and `ConversationThread.tsx`.
- Mapped person timeline foundation: `usePersonUnifiedTimeline` + `fetchMessagesByConversationIds`.

### Step 3: Implementation Strategy Decision
- Chosen strategy: **frontend aggregation layer** in hooks/selectors.
- Reuse existing conversation/message tables and existing realtime/query invalidation patterns.
- No new DB objects for initial delivery.

### Step 4: Phase Definition
- Defined six implementation phases with strict dependencies:
  1. Data aggregation layer
  2. Sidebar customer threads list
  3. Unified conversation view
  4. Reply channel selector + send routing
  5. Unread aggregation + read actions
  6. Edge-case hardening + polish

### Step 5: Artifact Generation (Phase 0 / Research)
- Generated `research.md` with architecture findings and tradeoffs.

### Step 6: Artifact Generation (Phase 1 / Design)
- Generated `data-model.md`, `contracts/`, `quickstart.md`.

### Step 7: Artifact Generation (Phase 2 / Task Breakdown)
- Generated `tasks.md` with implementation-ready file-level tasks.

### Step 8: Gate Check
- All required artifacts exist.
- No error state in plan artifacts.
- Plan remains additive and non-breaking by design.

### Step 9: Progress Tracking Update
- Marked all planning phases complete below.

---

## Progress Tracking
- [x] Phase 0: Research complete
- [x] Phase 1: Design artifacts complete
- [x] Phase 2: Tasks complete
- [x] Gate checks passed
- [x] Ready for `/implement`

