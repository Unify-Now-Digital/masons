# Tasks: Inquiries Pipeline Board

**Input**: Design documents from `/specs/007-inquiries-pipeline/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/get-inquiries-pipeline.md`, `quickstart.md`

**Tests**: No explicit TDD/automated-test requirement was requested in the spec; verification tasks are included via linting and quickstart acceptance checks.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`) for story-phase tasks only
- Every task includes an explicit file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new feature module and routing/navigation entry points.

- [x] T001 Create inquiries module folder structure and public export in `src/modules/inquiries/index.ts`
- [x] T002 [P] Create baseline inquiries page shell in `src/modules/inquiries/pages/InquiriesPage.tsx`
- [x] T003 [P] Create inquiries type definitions for RPC row and filters in `src/modules/inquiries/types/inquiries.ts`
- [x] T004 Register lazy-loaded inquiries route in `src/app/router.tsx`
- [x] T005 Add sidebar navigation item between Inbox and Orders in `src/components/layout/Sidebar.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement backend contract and shared data-access primitives required by all stories.

**⚠️ CRITICAL**: User story work starts after this phase is complete.

- [x] T006 Run discovery SQL for quote statuses, order statuses, and people display columns; outcomes recorded in `specs/007-inquiries-pipeline/spec.md` (Pre-Implementation Data Verification section)
- [x] T007 Create migration with SECURITY DEFINER RPC `get_inquiries_pipeline(...)` including the membership guard via `user_is_member_of_org()` from the very first commit in `supabase/migrations/<timestamp>_get_inquiries_pipeline.sql`
- [x] T008 Implement input validation (`channels`, date bounds) in `supabase/migrations/<timestamp>_get_inquiries_pipeline.sql` (membership guard is already present from T007)
- [x] T009 Implement deterministic stage precedence (`order_created` > `quoted` > `new`) with `quoted` keyed on linked quote `status = 'accepted'` in `supabase/migrations/<timestamp>_get_inquiries_pipeline.sql`
- [x] T010 Implement deterministic stage precedence (`order_created` > `quoted` > `new`) with `quoted` keyed on linked quote `status = 'accepted'` in `supabase/migrations/<timestamp>_get_inquiries_pipeline.sql`
- [x] T011 Implement flat RPC response columns for enquiry/person/quote/order contract in `supabase/migrations/<timestamp>_get_inquiries_pipeline.sql`
- [x] T012 Create query key factory and RPC API wrapper in `src/modules/inquiries/api/inquiriesKeys.ts`
- [x] T013 [P] Implement RPC call function (`getInquiriesPipeline`) in `src/modules/inquiries/api/getInquiriesPipeline.ts`
- [x] T014 Implement data hook using `useOrganization()` and one-call-per-filter-change behavior in `src/modules/inquiries/hooks/useInquiriesPipeline.ts`

**Checkpoint**: Database RPC and feature data plumbing are ready; user stories can now be delivered independently.

---

## Phase 3: User Story 1 - Monitor inquiry progression (Priority: P1) 🎯 MVP

**Goal**: Show organization enquiries as a three-lane pipeline with correct computed stage and channel-specific cards.

**Independent Test**: Open Inquiries page and confirm all returned rows appear exactly once in lane `new|quoted|order_created`, including `order_id` rows always in `order_created`.

### Implementation for User Story 1

- [x] T015 [P] [US1] Build Kanban lane components keyed by stage in `src/modules/inquiries/components/InquiriesBoard.tsx`
- [x] T016 [P] [US1] Build enquiry card component with channel-specific field rendering rules in `src/modules/inquiries/components/InquiryCard.tsx`
- [x] T017 [US1] Wire board grouping and default sort by `created_at` in `src/modules/inquiries/pages/InquiriesPage.tsx`
- [x] T018 [US1] Add loading skeleton and empty-state components in `src/modules/inquiries/components/InquiriesBoardState.tsx`
- [x] T019 [US1] Add retryable error-state UI and retry wiring in `src/modules/inquiries/pages/InquiriesPage.tsx`

**Checkpoint**: User Story 1 is independently functional as MVP board view.

---

## Phase 4: User Story 2 - Filter pipeline to relevant data (Priority: P2)

**Goal**: Let users filter by channels and date range with one RPC call per filter change.

**Independent Test**: Change channels/date range and verify returned cards match filters, defaults are all channels + last 30 days, and each change triggers one RPC refresh.

### Implementation for User Story 2

- [x] T020 [P] [US2] Build channel multi-select filter UI (`contact|quote|appointment|call|shortlist`) in `src/modules/inquiries/components/ChannelFilter.tsx`
- [x] T021 [P] [US2] Build date range filter UI (presets + custom) in `src/modules/inquiries/components/DateRangeFilter.tsx`
- [x] T022 [US2] Compose filter bar and default filter state in `src/modules/inquiries/components/InquiriesFilters.tsx`
- [x] T023 [US2] Connect filter state to query params passed to `useInquiriesPipeline` in `src/modules/inquiries/pages/InquiriesPage.tsx`
- [x] T024 [US2] Enforce one-request-per-filter-change behavior and remove any waterfall calls in `src/modules/inquiries/hooks/useInquiriesPipeline.ts`

**Checkpoint**: User Story 2 is independently functional with correct filter behavior.

---

## Phase 5: User Story 3 - Inspect inquiry details quickly (Priority: P3)

**Goal**: Provide a detail panel with required sections and conditional linked data/config/photos.

**Independent Test**: Click cards across channels and verify header/person/inquiry sections always render, optional configuration/photos/linked quote/linked order sections render only when data exists.

### Implementation for User Story 3

- [x] T025 [P] [US3] Create detail panel shell and section layout in `src/modules/inquiries/components/InquiryDetailPanel.tsx`
- [x] T026 [P] [US3] Implement header and person sections (including person detail link) in `src/modules/inquiries/components/InquiryDetailHeader.tsx`
- [x] T027 [P] [US3] Implement inquiry and configuration sections from raw fields/details jsonb in `src/modules/inquiries/components/InquiryDetailContent.tsx`
- [x] T028 [P] [US3] Implement photos thumbnail grid and linked quote/order sections in `src/modules/inquiries/components/InquiryDetailRelated.tsx`
- [x] T029 [US3] Wire card click, selected-row state, and panel open/close behavior in `src/modules/inquiries/pages/InquiriesPage.tsx`

**Checkpoint**: User Story 3 is independently functional for contextual inquiry inspection.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish verification, consistency, and documentation updates spanning multiple stories.

- [x] T030 [P] Align inquiries module exports and import boundaries in `src/modules/inquiries/index.ts`
- [x] T031 Validate RPC contract/spec/plan consistency and update documentation notes in `specs/007-inquiries-pipeline/contracts/get-inquiries-pipeline.md`
- [x] T032 Run lint and address new warnings/errors in `src/modules/inquiries/`
- [x] T033 Execute quickstart verification checklist and record completion notes in `specs/007-inquiries-pipeline/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phases 3-5 (User Stories)**: Depend on Phase 2; run in priority order for incremental delivery.
- **Phase 6 (Polish)**: Depends on completion of targeted user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on US2/US3.
- **US2 (P2)**: Starts after Phase 2; builds on shared page/hook structure from US1 but remains independently testable.
- **US3 (P3)**: Starts after Phase 2; can be built independently of US2, but integrates on `InquiriesPage.tsx`.

### Within Each User Story

- Build reusable components marked `[P]` first.
- Integrate story behavior in `InquiriesPage.tsx` after component completion.
- Validate the story’s independent test before moving on.

### Parallel Opportunities

- Phase 1: T002 and T003 can run in parallel.
- Phase 2: T013 can run parallel to late SQL tasks once RPC columns are stable.
- US1: T015 and T016 in parallel.
- US2: T020 and T021 in parallel.
- US3: T025, T026, T027, and T028 in parallel.
- Polish: T030 and T031 in parallel.

---

## Parallel Example: User Story 3

```bash
Task: "T025 [US3] Create detail panel shell in src/modules/inquiries/components/InquiryDetailPanel.tsx"
Task: "T026 [US3] Implement header/person sections in src/modules/inquiries/components/InquiryDetailHeader.tsx"
Task: "T027 [US3] Implement inquiry/config sections in src/modules/inquiries/components/InquiryDetailContent.tsx"
Task: "T028 [US3] Implement photos/related sections in src/modules/inquiries/components/InquiryDetailRelated.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1-2.
2. Deliver Phase 3 (US1) and validate lane logic + loading/error/empty states.
3. Demo/review MVP before adding filters/detail expansion.

### Incremental Delivery

1. Add US1 board.
2. Add US2 filtering.
3. Add US3 detail panel.
4. Run Phase 6 polish and final verification.

### Parallel Team Strategy

1. Pair on Phase 2 SQL + API foundation.
2. Split UI by story after Phase 2:
   - Dev A: US1 board/cards
   - Dev B: US2 filters
   - Dev C: US3 detail panel

---

## Notes

- Task IDs are dependency-ordered and executable.
- `[P]` is used only where file-level parallelism is practical.
- Story labels are applied only to user story phases.
- Out-of-scope items (drag/drop, manual stage edits, send-quote, search, bulk actions, editing) are intentionally excluded.
