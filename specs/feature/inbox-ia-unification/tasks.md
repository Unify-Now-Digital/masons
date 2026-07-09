# Tasks: Inbox IA Unification

**Input**: Design documents from `specs/feature/inbox-ia-unification/`
**Prerequisites**: plan.md, spec.md, research.md (inventory V1–V14 / S1–S6, decisions D1–D8), data-model.md, contracts/view-state-contract.md, quickstart.md

**Tests**: No automated test suite was requested; verification is the per-task `tsc` gate plus the quickstart manual matrix at the two checkpoints. Sears Melvin is the only test org; all validation read-only.

**Organization**: Sequenced so the **state migration (Phases 1–2) is landable and testable before any UI change** (Phases 3–5), per the planning directive. Tasks touching the triage predicate (D2) or order-creation (D7/FR-008) are flagged **⚠ EXTRA REVIEW**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable. Almost everything here edits `src/modules/inbox/pages/UnifiedInboxPage.tsx` (one hot 1,458-line file), so tasks are deliberately **serial** — same-file tasks must not run in parallel.
- Every task ends with the same gate: **`npx tsc --noEmit` clean, `npm run lint` clean, then one commit for that task alone.** `vite build` does not typecheck — never substitute it.

## Conventions used below

The **gate bijection** (research.md D6) — apply mechanically, site by site:

| Old gate | New gate |
|---|---|
| `viewMode === 'conversations'` | `view !== 'customers'` |
| `viewMode !== 'conversations'` | `view === 'customers'` |
| `viewMode === 'customers'` | `view === 'customers'` |
| `viewMode !== 'customers'` | `view !== 'customers'` |
| `segment === 'enquiries'` | `board` |

`view` has three values (`'all' | 'triage' | 'customers'`) from T001 onward. `'triage'` intentionally behaves exactly like `'all'` until T009 adds the filter — that is the documented interim semantics that makes the state migration landable first.

---

## Phase 1: Foundational — the view-state hook

- [X] **T001** [US3] Create `src/modules/inbox/hooks/useInboxView.ts` implementing `contracts/view-state-contract.md`:
  - Export `type InboxViewId = 'all' | 'triage' | 'customers'` and `useInboxView(): { view, setView, board, setBoard, normalizeLegacyParams }`.
  - `view` resolution order: valid `?view=` param → localStorage `inbox.desktop.view.v2` (if valid) → one-time migration of `inbox.desktop.viewMode.v1` (`'customers'`→`'customers'`, `'conversations'`→`'all'`; write v2, **leave v1 in place**) → literal `'customers'` (D3/D4).
  - `board` = `searchParams.get('board') === '1'`; never persisted.
  - `setView(next)`: set/delete `?view=` with `setSearchParams(params, { replace: true })` (delete when `next` equals the resolved default is NOT wanted — always set it explicitly, simpler and unambiguous) **and** write v2 key. `setBoard(next)`: set `board=1` / delete param, `replace: true`. Copy the idiom of the existing channel setter at `UnifiedInboxPage.tsx:275-283`.
  - `normalizeLegacyParams()`: pure function implementing the D5 matrix (`?segment=enquiries`→`view=triage` unless `view` present; strip `segment` and invalid `view`; **must pass through `conversation`, `channel`, `gmail`, `error` untouched**). Exported but **not invoked anywhere yet** (activated in T006).
  - All localStorage access in try/catch, matching `UnifiedInboxPage.tsx:79-87`.
  - Verify: gate. New file only; no page edits in this task.

---

## Phase 2: US3 — state migration (landable checkpoint BEFORE any UI change)

**Goal**: page runs entirely on `view`/`board`; URL uses new params; legacy links/preferences map correctly; **rendered UI looks unchanged** (old tabs still present, now writing new state).

- [X] **T002** [US3] In `UnifiedInboxPage.tsx`, swap the state source with a compat alias (no gate edits yet):
  - Delete the `viewMode` `useState` + its localStorage init (`:78-87`) and the V1 persist effect (`:200-207`).
  - Call `useInboxView()`; add `const viewMode: 'conversations' | 'customers' = view === 'customers' ? 'customers' : 'conversations';` so every downstream site compiles unchanged.
  - Rewire the Conversations/Customers tab `onClick`s (`:1218`, `:1230`) from `setViewMode('conversations'|'customers')` to `setView('all')` / `setView('customers')`.
  - Behavior note: storage moves to the v2 key and `?view=` appears in the URL; everything else identical.
  - Verify: gate + quick manual: tabs switch, choice survives reload, v1-only localStorage migrates to v2 on load.
- [X] **T003** [US3] Rewire logic sites V2–V11 from the alias to `view` per the bijection, one `git diff`-reviewable pass (line anchors re-verified 2026-07-09; re-locate by behavior if drifted):
  - V2 `:209-213` clear `emptyChannelStartContext` — gate becomes `view === 'customers'`.
  - V3 `:215-219` reset `suppressCustomersAutoSelectRef` — `view !== 'customers'`.
  - V4 `:222-228` `activePersonId` ternary — `view === 'customers'`.
  - V5 `:578-591` conversations auto-select — early return `if (view === 'customers') return;` and swap `viewMode` → `view` in the dep array.
  - V6 `:593-623` customers row auto-select — `if (view !== 'customers') return;` + deps.
  - V7 `:627-650` customers auto-mark-read — `if (view !== 'customers') return;` + deps.
  - V8 `:675-685` mark-read/unread target memos — `view === 'customers'` + deps.
  - V9 `:687-696` `anyToggleTargetUnread` — `view === 'customers'` + deps.
  - V10 `:858-899` `handleToggleReadUnread` — `'customers'` branches → `view === 'customers'`; the `:896` clear-multi-select gate → `view !== 'customers'`.
  - V11 `:1030-1036`, `:1057-1062` new-conversation onSuccess — `view !== 'customers'`.
  - **Checklist discipline**: tick each of V2–V11 in the commit message; none may remain on the alias.
  - Verify: gate + exercise quickstart §5 auto-select/mark-read/new-conversation items.
- [X] **T004** [US3] Rewire render sites V12–V14 and delete the compat alias:
  - V12 `:1209-1243` tab `aria-selected`/styling conditions — `view !== 'customers'` / `view === 'customers'` (tabs themselves unchanged until T008).
  - V13 `:1244` list branch — `view !== 'customers' ? <InboxConversationList/> : <CustomerThreadList/>` (keep the `'stuck'→'all'` coercion at `:1283`).
  - V14 `:1390` right pane — `view !== 'customers' || segment === 'enquiries'` (segment half changes in T005).
  - Delete the `viewMode` alias; grep the file for `viewMode` — zero hits allowed (except the storage-key comment if any).
  - Verify: gate + all three panes behave as before in both tab states.
- [X] **T005** [US3] Migrate `segment` → `board` across S1–S6 (exact equivalence — **D7 widening is NOT part of this task**):
  - S1 `:256-266` delete the `segment` derivation + `setSegment`; Enquiries/All-Linked tab `onClick`s (`:1166`, `:1180`) become `setBoard(true)` / `setBoard(false)`; `aria-selected` reads `board`.
  - S2 `:298` `useEnquiryPipeline` enabled → `{ enabled: board }`.
  - S4 `:1185` board branch → `board ? <EnquiryPipelineBoard/> : (…tabs + lists…)`.
  - S5 `:1390` right pane → `view !== 'customers' || board`.
  - S6 `:1441` `EnquiryCreateOrderPanel` gate → `board` (equivalence only; widened in T010).
  - Also update the stale comments at `:252-255` and `:268-270` that describe the segment pattern.
  - Grep the file for `segment` — zero hits allowed.
  - Verify: gate + Enquiries tab still shows the kanban (now via `?board=1`), All/Linked returns to lists.
- [ ] **T006** [US3] Activate legacy-URL normalization: invoke `normalizeLegacyParams()` from a one-shot mount effect (guard with a ref) in `UnifiedInboxPage.tsx`, after the `?conversation=` one-shot read at `:105-106` (that read uses `window.location` directly, so effect order cannot clobber it — confirm, don't assume).
  - Verify: gate + contract normalization matrix rows: `?segment=enquiries` → lands as `?view=triage` (interim: unfiltered list — expected until T009), `?segment=enquiries&conversation=X` preserves X, `?segment=enquiries&view=all` → `?view=all`, `?view=bogus` → stripped + default, `/dashboard/enquiry-triage` alias works with `src/app/router.tsx` **untouched**.
- [ ] **T007** [US3] **CHECKPOINT A — state migration landable.** Run quickstart §0 (gates), §2 rows 1–2 (view switching via the old tabs), §4 (full back-compat matrix incl. localStorage cases), §5 (regression pass; skip triage-specific and board-*toggle* items — board still rides the old Enquiries tab). Record results in the PR description. This is the merge-to-`staging` point for the migration alone if desired.

---

## Phase 3: US1 — unified view switch + board toggle UI

- [ ] **T008** [US1] [US4] In `UnifiedInboxPage.tsx`, replace the two stacked tab rows with the unified switch:
  - Delete the segment tablist (`:1155-1184`) and the Conversations/Customers tab row (`:1209-1243`).
  - Add one `role="tablist"` (`aria-label="Inbox view"`): **All** (`setView('all')`), **To triage** (`setView('triage')`), **By customer** (`setView('customers')`), with `aria-selected={view === …}`; reuse the existing pill button styling verbatim (`bg-gardens-grn-dk` active / `bg-white` inactive classes).
  - Add a **Board** toggle button (icon or labelled, `aria-pressed={board}`) in the same row, calling `setBoard(!board)`; board on still replaces the list area with `EnquiryPipelineBoard` for any `view`.
  - Preserve the two left-panel collapse buttons (`:1188-1196`, `:1234-1242`) — consolidate into the new row's trailing position.
  - `Unlinked` must now appear exactly once in the panel (filter pill only — FR-006; the segment-level "All / Linked" label is gone with the tablist).
  - Verify: gate + quickstart §2 full matrix (fresh default = By customer, three tabs, board toggle on/off round-trip, pills persist across views).

---

## Phase 4: US2 — the triage view

- [ ] **T009** ⚠ **EXTRA REVIEW (D2 — triage predicate)** [US2] In `UnifiedInboxPage.tsx`, make `view === 'triage'` filter the list:
  - In the `displayConversations` memo chain (after the `listFilter` block ending `:574`), when `view === 'triage'`, keep only conversations where `bucketAndAgingByConversationId.get(c.id)?.aging` satisfies `aging != null && (aging.ball.side === 'us' || aging.level !== 'fresh')` — exactly D2; **`enquiry_stage` must not appear in the predicate**.
  - Add `view` to that memo's deps. Pills/channel/search continue to compose by intersection (they already ran upstream); the red-only "N stuck" pill keeps working inside triage as a subset filter.
  - Empty state: when triage yields zero rows, `InboxConversationList` shows its existing empty state — confirm it renders sanely (no error, no fallback to All) and the copy isn't misleading; adjust the empty-state text only if it hardcodes "no conversations".
  - Verify: gate + quickstart §3 ground-truth check against Sears Melvin: triage is a **non-empty strict subset** of All; a replied-to fresh conversation is absent; stuck ⊂ triage. If triage ≈ All, stop — predicate or data assumption is wrong (SC-003).

---

## Phase 5: US4 — capability preservation (both flagged)

- [ ] **T010** ⚠ **EXTRA REVIEW (D7 — order creation)** [US4] Widen the `EnquiryCreateOrderPanel` gate in `UnifiedInboxPage.tsx` (post-T005 site, was `:1441`) from `board` to `board || view === 'triage'` (still requires selected conversation with no `order_id`). This is the **only deliberate non-equivalent gate change** in the feature — one-line diff, its own commit, called out in the PR.
  - Verify: gate + panel appears for an order-less selected conversation in To triage and with board on; absent in All/By customer (unchanged).
- [ ] **T011** ⚠ **EXTRA REVIEW (FR-008 — new write-path surface)** [US4] Add a per-row "Mark in progress" affordance so `enquiry_stage` progression is reachable with the board off. **Verified gap (2026-07-09): the action currently exists only on board cards** (`EnquiryPipelineCard.tsx:75-81`) — this is an addition, not a preservation:
  - `src/modules/inbox/components/InboxConversationList.tsx`: add optional prop `onMarkInProgress?: (conversationId: string) => void`; render a small action (reuse the board card's button styling/label) on rows where `conversation.enquiry_stage === 'new'`, in the row's trailing/secondary area next to the aging badge.
  - `UnifiedInboxPage.tsx`: pass the existing `handleEnquiryPipelineMarkInProgress` (`:302-307`, backed by `useUpdateEnquiryStage` — an existing RLS-scoped mutation; no new API code).
  - Scope check: this writes `enquiry_stage` on real org rows when clicked — during validation on Sears Melvin, verify the button *renders*; do not click it on real data (quickstart rule).
  - Verify: gate + button visible on `stage === 'new'` rows in All and To triage with board off; absent on progressed rows.

---

## Phase 6: Polish & final verification

- [ ] **T012** [P] Update `specs/feature/inbox-ia-unification/plan.md` Progress Tracking (tick tasks/implementation as they land) and note in `quickstart.md` any deviations discovered during checkpoints. Documentation-only; parallelizable with T013 prep but commit separately.
- [ ] **T013** **CHECKPOINT B — full feature.** Run the complete `quickstart.md` matrix top to bottom on Sears Melvin (§0–§5) plus the Churchill read-only smoke (§6). Confirm SC-001…SC-007 from spec.md, especially: no layout fork from the switch (SC-001), legacy matrix green (SC-002), triage strict subset (SC-003), rail/auto-select/mark-read unregressed (SC-004), zero org-data writes and zero migrations (SC-005), `tsc`+lint clean (SC-006), chrome reduced to source/switch/pills (SC-007). Record evidence in the PR; merge target is `staging`.

---

## Dependencies & Execution Order

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 (Checkpoint A: migration landable)
                                        └→ T008 → T009 ⚠ → T010 ⚠ → T011 ⚠ → T013 (Checkpoint B)
                                                                  T012 (docs, anytime after T007)
```

- **Strictly serial through T011**: every code task after T001 edits `UnifiedInboxPage.tsx`. Do **not** parallelize same-file tasks.
- T011 also touches `InboxConversationList.tsx` but depends on page wiring — keep serial.
- The only [P] task is T012 (docs), safe alongside T013 preparation.
- Story mapping: US3 (legacy compat) lands **first** by design — it is the state migration itself; US1 (switch UI) next; US2 (triage) next; US4 (board/capability) last. Each checkpoint is a valid stopping point.

## Parallel Example

None by design — one hot file. If two people work this feature, the only safe split is T001 (hook, new file) alongside *reading* tasks; after that, hand the page file baton task by task.

## Notes

- **Interim semantics window (T006→T009)**: legacy `?segment=enquiries` links land on To triage rendering an *unfiltered* list. Documented and acceptable — it is a superset of the final view and strictly better than a broken link; close the window promptly by landing T009 soon after Checkpoint A.
- Line anchors were re-verified on disk 2026-07-09 but shift as tasks land — **each task must re-locate its sites by the quoted code/behavior, not the raw line number**, and earlier tasks shift later anchors.
- Never write to Churchill or Sears Melvin data; the T011 button is render-verified only.
- Rollback: revert the feature commits; the v1 localStorage key was never deleted (D4), so pre-migration code resumes cleanly.
