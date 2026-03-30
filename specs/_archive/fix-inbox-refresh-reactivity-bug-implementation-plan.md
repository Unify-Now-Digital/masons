# Implementation Plan: Fix Inbox Refresh/Reactivity Bug

## Metadata
- **Feature spec:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-inbox-refresh-reactivity-bug.md`
- **Implementation plan:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-inbox-refresh-reactivity-bug-implementation-plan.md`
- **Plan artifacts dir:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-inbox-refresh-reactivity-bug-plan`
- **Branch:** `feature/fix-inbox-refresh-reactivity`
- **Technical context:**
  - fix inbox refresh for conversations + customers modes
  - preserve behavior/UX and existing send routing
  - React Query remains orchestration backbone
  - minimal, additive, production-ready changes

---

## Unified Refresh Strategy

Use a **single refresh backbone** that combines:
1. **Primary:** realtime-triggered invalidation fan-out (all inbox conversations + all inbox messages query families)
2. **Outbound immediate:** mutation onSuccess invalidation fan-out (same backbone)
3. **Fallback reliability:** low-frequency periodic invalidation while inbox is mounted (and optionally only when tab visible)

This avoids duplicated mode-specific refresh code and ensures a deterministic update path for both inbound and outbound events.

---

## Execution Flow

### Step 1: Canonical query key normalization
- Ensure customers-mode queries use `inboxKeys` families.
- Remove ad-hoc/custom customer view keys that escape fan-out invalidation.

### Step 2: Invalidation fan-out definition
- Define one helper: `invalidateInboxData({ conversationIds?, personIds? })`.
- Minimum invalidation set:
  - `inboxKeys.conversations.all`
  - `['inbox', 'messages']` prefix (covers byConversation + personTimeline)
- Optional targeted invalidation can remain for performance but must not replace broad message-prefix invalidation.

### Step 3: Inbound/outbound integration
- Outbound: call fan-out from send mutation success path.
- Inbound: call fan-out from realtime flush handler.

### Step 4: Fallback refresh backbone
- Add safe interval invalidation (15-30s) in inbox page.
- Guard against overlap and unnecessary bursts.

### Step 5: Aggregation reactivity verification
- Validate `useCustomerThreads` and `useCustomerMessages` recompute from refreshed source queries.
- Verify memo dependencies and no stale key scope mismatch.

### Step 6: Progress tracking
- Mark all phases complete in tasks artifact.

---

## Progress Tracking
- [x] Phase 0: Research complete
- [x] Phase 1: Design artifacts complete
- [x] Phase 2: Tasks complete
- [x] Ready for `/implement`

