# Implementation Plan: Fix Customers Mode Scroll and Unread UX

## Metadata
- **Feature spec:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-customers-mode-scroll-unread-ux.md`
- **Implementation plan:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-customers-mode-scroll-unread-ux-implementation-plan.md`
- **Plan artifacts dir:** `C:/Users/owner/Desktop/unify-memorial-mason-main/specs/fix-customers-mode-scroll-unread-ux-plan`
- **Branch:** `feature/fix-customers-mode-scroll-unread-ux`
- **Technical context:** customers-mode-only UX fixes; no behavior change in conversations mode.

---

## Execution Flow

### Step 1: Scope lock
- Restrict changes to customers-mode rendering/derived data/read trigger paths.
- Keep refresh/reactivity/send routing logic untouched except where read trigger integration is required.

### Step 2: Auto-scroll strategy
- Add near-bottom tracking in customers-mode timeline path.
- Trigger auto-scroll only when new messages arrive and user is near bottom.

### Step 3: Unread model simplification
- Convert customers UI unread presentation from numeric to boolean badge (`Unread`).
- Keep backend unread counts unchanged.

### Step 4: Mark-as-read-on-open flow
- On opening a customer thread, mark all grouped conversation IDs as read if any unread exists.
- Ensure immediate UI feedback via existing invalidation/optimistic flow.

### Step 5: Edge-case safeguards
- Prevent jumpy scroll during historical reading.
- Handle rapid arrivals, empty thread, already-read customers, and customer switching.

### Step 6: Progress tracking
- Generate and complete phase artifacts below.

---

## Progress Tracking
- [x] Phase 0: Research complete
- [x] Phase 1: Design artifacts complete
- [x] Phase 2: Tasks complete
- [x] Ready for `/implement`

