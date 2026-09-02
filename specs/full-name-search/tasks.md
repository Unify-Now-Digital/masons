# Tasks: Full-Name Search Across Inbox and People Surfaces

**Input**: `specs/full-name-search/spec.md` + `plan.md` (both at `56533af`)
**Prerequisites**: plan.md, spec.md. Research/data-model/contracts are folded into plan.md (`docs/ux/inbox.md` B1–B7 is the research artifact); no separate files exist.
**Tests**: none requested in the spec. Verification is browser-verify with named records + Giorgi's gates (plan, Technical Context). No unit-test tasks.
**Organization**: one phase per commit, C1a → C4 (plan, "Phase 2 approach"). Commits map onto stories: C1a+C1b = US1 (P1), C2 = US2 (P2), C3 = US3 (P3), C4 = docs. Line refs pinned at `1ab595a` — re-verify on drift before each apply.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel-eligible (different files, no dependency)
- Roles: **(G)** = Giorgi only (rulings, git, gates, Dashboard SQL, browser verify). **(CC)** = CC drafts/proposes with grep evidence and predictions, shows diff, applies only after approval.

## Spec ↔ plan disagreements (recorded, not resolved here)

- **D1**: spec FR-002 shows a 2-arg signature `(p_organization_id, p_q)`; plan §1 carries the approved 6-param signature (ruled 2026-09-02). The spec text was not updated after the ruling. Not picked here — whether to amend the spec is a C4 ruling (T026).
- **D2**: plan's FR→commit map row for C4 reads "Docs + spec path corrections", but the spec/B5 path corrections landed pre-/tasks (`56533af`) and the plan's own C4 file list is docs-only. Tasks below treat C4 as docs-only per the file list; the stale row label is a C4 ruling (T026).

---

## Phase 1: C1a — Migration file only (US1 · FR-002, FR-010, FR-011)

**Goal**: tracked migration holding exactly the RPC definition that will be applied.

- [ ] T001 **(G) Flag 4 ruling — due at this diff's approval, not before**: Option A assert-membership + raise (`plpgsql`, `get_inquiries_pipeline` precedent) vs Option B silent filter (`language sql stable`, FR-002 as written). Evidence table: plan §2. The ruling fixes the migration's language and body; T004 cannot approve without it.
- [ ] T002 (CC) [US1] Draft `supabase/migrations/<timestamp>_search_inbox_conversations_rpc.sql`: signature per plan §1 (6 params with defaults, `returns setof public.inbox_conversations`); `SECURITY INVOKER`; `set search_path = ''`; LEFT join `public.people` on `person_id` (FR-005); match = today's three ILIKEs OR null-safe single-space-joined name ILIKE (concat_ws-style); filters mirror `fetchConversations:26-45` semantics; sort `last_message_at desc nulls last, created_at desc` (FR-006); `revoke all from public` + `grant execute to authenticated`. From precedent `20260423112000` copy ONLY the search_path pin and revoke/grant pair (FR-011 — not its DEFINER mode, not its unchecked org trust). Term reaches SQL only as `p_q` (FR-007). Present both Flag-4 body variants side by side so T001 selects at diff time — do not pre-pick.
- [ ] T003 (CC) [US1] Predictions with the diff: 1 new file, 0 code files touched; tsc/lint 0 delta; all 54 baseline items stable.
- [ ] T004 (G) Approve diff (carries the T001 ruling) → CC applies the file.
- [ ] T005 (G) `reviewer` pass on the C1a diff.
- [ ] T006 (G) `npm run gate` green → commit C1a → **push to remote BEFORE Dashboard apply** (FR-010).
- [ ] T007 (G) Apply in Dashboard SQL editor, statement by statement (no BEGIN/COMMIT gates).
- [ ] T008 (G) Read-back: `pg_proc.prosrc` vs tracked file **byte-identical** (SC-008; F-026 non-recurrence). CC may run the read-only comparison via Supabase MCP and show output; Giorgi's read is the gate.

**Checkpoint**: RPC live and identical to the tracked file. C1b may start.

---

## Phase 2: C1b — `fetchConversations` branch + wiring (US1 · FR-001, FR-003, FR-004, FR-005, FR-006, FR-007)

**Independent Test (US1)**: staging search for a linked customer's full name absent from every conversation column → thread appears; named record stated at verify time.

- [ ] T009 (CC) [US1] Draft the branch inside `fetchConversations` (`inboxConversations.api.ts:16-66`): term present after trim (same test as today's `:52`) → `supabase.rpc('search_inbox_conversations', …)` passing `p_status = filters?.status ?? 'open'` (api layer owns the default — plan §1 ownership ruling), `p_channel`, `p_unread_only`, `p_unlinked_only`; cast to `InboxConversation[]` exactly as today (FR-004, 21-column shape). Term absent/whitespace → today's PostgREST builder **byte-identical** (FR-003 branch (b); SC-002). `ConversationFilters` untouched; `person_id` / `primary_handle_exact` never reach the RPC (never co-occur with search — plan call-site table).
- [ ] T010 (CC) [US1] Predictions with the diff: 1 file; baseline item `inboxConversations.api.ts(94,5)` line-shifts by net added lines (edit region `:16-66` sits above it) — grep the baseline for this file first, re-anchor **in the same commit**; `useInboxConversations.ts(158,34)`/`(193,34)` stable; 0 new tsc items; lint 0 delta (8/19 holds).
- [ ] T011 (G) Approve → CC applies + re-anchors the baseline item, same commit.
- [ ] T012 (G) Browser verify (staging/local; name each record): SC-001 full-name → thread (the "Noella Lindsey" class); SC-002 no-term list identical; SC-003 unlinked row still matches by handle with a term active; SC-004 `Lindsey, Noella` correct, no failed request (F-027 closed); SC-006 mark-read/unread during active search.
- [ ] T013 (G) `reviewer` pass → gate → commit C1b.

**Checkpoint**: US1 delivered — inbox full-name search live end to end.

---

## Phase 3: C2 — Four client-side full-name predicates (US2 · FR-009)

**Independent Test (US2)**: on each surface, "First Last" of a known person matches; single-word/email/phone queries unchanged.

Each edit: additionally match the case-insensitive single-space-joined full name; null-safe on missing name components (US2 scenario 3); file-local, **no shared predicate, no cross-module import** (FR-009, plan Constitution note).

- [ ] T014 [P] (CC) [US2] `src/modules/inbox/components/PeopleSidebar.tsx:29-39`
- [ ] T015 [P] (CC) [US2] `src/modules/inbox/components/LinkConversationModal.tsx:60-70`
- [ ] T016 [P] (CC) [US2] `src/modules/customers/pages/CustomersPage.tsx:57-68` (predicate runs on transformed `firstName`/`lastName`)
- [ ] T017 [P] (CC) [US2] `src/shared/components/UniversalSearch.tsx:42-51` (fix the pre-filter; CommandItem `value` at `:128` already holds the joined name and needs no change)
- [ ] T018 (CC) [US2] Predictions with the diff: 4 files, each holds 0 baseline items; 0 new tsc; lint 0 delta.
- [ ] T019 (G) Approve → apply → browser verify SC-007 on all four surfaces + a null-name-component person does not throw → `reviewer` → gate → commit C2 (one commit for the four files).

---

## Phase 4: C3 — baseFilters debounce (US3 · FR-008)

**Independent Test (US3)**: network tab shows ≈1 conversations fetch after a typing pause, not one per keystroke; input stays immediate.

- [ ] T020 (CC) [US3] `src/modules/inbox/pages/UnifiedInboxPage.tsx` only: `SEARCH_DEBOUNCE_MS = 300` (ruled) beside `REALTIME_DEBOUNCE_MS` (`:53`); `debouncedSearchQuery` via cleanup-safe `setTimeout` effect on `searchQuery` (`:96`); `baseFilters` memo (`:243-249`) consumes the debounced value; controlled input keeps `searchQuery` (US3 scenario 2). **No JSX** — `CustomerThreadList:161-257` / `InboxConversationList:195-309` are shell-cycle territory (audit B7). Clearing the input also waits 300 ms — accepted, not special-cased.
- [ ] T021 (CC) [US3] Predictions with the diff: 1 file, holds 0 baseline items; 0 new tsc; lint 0 delta.
- [ ] T022 (G) Approve → apply → browser verify SC-005 → `reviewer` → gate → commit C3.

---

## Phase 5: C4 — Docs only (no FRs)

Files: `docs/{findings,backlog,handoff}.md` (plan C4 file list; see D2 — the spec/B5 path corrections already landed at `56533af`, nothing spec-side remains).

- [ ] T023 (CC) `docs/findings.md`: mark F-027 closed by C1 (bound RPC parameter), as a resolved side effect per FR-007 — not a separate feature.
- [ ] T024 (CC) `docs/backlog.md`: strike the entries this branch closes (grep at C4 time; expected: the Block-3 search-fix line(s)); state match counts before edit.
- [ ] T025 (CC) `docs/handoff.md`: edit in place as a diff — branch outcome, per-commit tripwire tallies, the T001 Flag-4 ruling recorded.
- [ ] T026 (G) Rule D1 and D2: amend spec FR-002 to the 6-param signature (or leave with plan as ruling record), and fix/ignore the stale "Docs + spec path corrections" C4 row label in plan.md. If amendments are wanted they ride in this commit; grep for stale path references after any change.
- [ ] T027 (G) `reviewer` → gate (0 delta expected — docs only; all 54 baseline items stable) → commit C4.

---

## Dependencies & Execution Order

- **Strictly sequential phases**: C1a → C1b → C2 → C3 → C4 (plan Sequencing). The C1a/C1b split exists because FR-010 (push before Dashboard apply) and browser-verify-before-commit are circular in one commit — do not merge them.
- T001 (Flag-4 ruling) gates T004 approval; T002–T003 may proceed with both variants drafted.
- T007–T008 (apply + byte-identical read-back) gate all of Phase 2.
- Within C2, T014–T017 are [P] (four independent files) but land as one commit.
- Every apply is preceded by its predictions task; a failed prediction counts against the session tripwire.

## Out of scope — checkable "did NOT touch" list (AC-003 walls)

- No pagination (unpaginated 1,005-row fetch stays; backlog).
- No `pg_trgm`, no index — extension stays uninstalled (audit B6).
- No shell/top-bar JSX; nothing in `CustomerThreadList:161-257` / `InboxConversationList:195-309`.
- Nothing under `specs/inbox-sidebar-multi-tabs/` (tsc baseline lives there).
- No flat-view-specific work — `?view=flat` inherits C1 via the shared fetch path.
- `ConversationFilters` type unchanged; no shared name-match predicate introduced.
