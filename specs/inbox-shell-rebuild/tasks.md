# Tasks: Inbox Right-Panel Shell Rebuild + Top-Bar Control Reduction

**Input**: `specs/inbox-shell-rebuild/spec.md` + `plan.md` (both at `6aa61da`); `docs/ux/inbox.md` + the spec header's line-drift table
**Prerequisites**: plan.md (commit split C1→C2→C3a→C3b→C4, FR→commit map, C3a per-symbol removal map, per-file baseline verification — decomposed here, not re-planned)
**Tests**: none requested; the gate suite + per-commit browser verify are the test surface (Giorgi runs gates).
**Written directly** — `/tasks`' `check-prerequisites.sh` does not exist (docs/backlog.md).

**Tripwire**: enters implementation at **2/3** (plan). Task-writing investigation added 0 misses (FR-012 and FR-015 areas tallied clean; one malformed grep re-run, no prediction consumed). One more surprise ⇒ propose stopping.

**Spec/plan disagreements found while decomposing: none.** Two evidence notes recorded below where the code adds nuance the documents don't carry (T-N1, T-N2).

## Format: `[ID] [P?] [Story] (Role) Description`

- **(G)** = Giorgi: rulings, approvals, git, gates, DB, browser verify. **(CC)** = drafts with predictions + grep evidence, applies only after approval.
- **[P]** = parallelizable (different files, no dependency).
- Commits map to plan: C1=US1, C2=US2, C3a+C3b=US3, C4=US4. Every commit: gate green → browser verify (named record) → (G) commits. CC never runs git.

## Evidence notes (from task-writing investigation, 2026-09-03)

- **T-N1 (FR-012)**: the channel `<select>` (CustomerThreadList:235–245) is already near-minimal — `h-6 text-[11px] pl-2 pr-5`, options All/Email/SMS/WhatsApp/Web (`CHANNEL_OPTIONS` :28, type :18). "Shrinks" can only mean narrower width/shorter labels or a different control form — that IS the open ruling (T401), not a styling afterthought.
- **T-N2 (FR-015)**: most `border` classes on the five surfaces are functional control chrome (buttons :219/:227, checkbox, select, search input) and must NOT be removed. The actual "dividing lines": PersonOrdersPanel:260 header `border-b` (dies with the tab bar in C1 anyway), CustomerThreadList `divide-y divide-gardens-bdr` row separators, and 5 card borders across InboxContactTab (2), InboxFinancesTab (2), InboxHistoryTab (1). FR-015 is an enumerated-surface pass, not a sweep.

---

## Phase 0: Open rulings (blocking; ruled at diff-approval per C4c/C8/C9b/C9c precedent)

- [ ] T001 [US1] (G) Rule at C1 approval: card header affordance + chevron, sticky headers y/n, any transition (FR-005 floor: instant show/hide; no ruling may weaken FR-003).
- [ ] T002 [US2] (G) Rule at C2 approval: name of the new per-order options component (plan placeholder `InboxOrderOptionsList.tsx`).
- [ ] T003 [US3] (G) Rule before C3b draft: channel control's exact form (T-N1 — narrower select with shorter labels vs icon/chip form). Blocks T401→T402.
- [ ] T004 [US4] (G) Rule at C4 approval: FR-015 specific class choices over the T-N2 enumerated surfaces.

---

## Phase 1: C1 — shell swap (US1, P1) 🎯 MVP

**Goal**: Tabs → one scrolling column of four force-mounted collapsible cards in `PersonOrdersPanel.tsx` (only file).
**Independent Test**: spec US1 — named SM record; cards toggle with zero network; drawer input survives.

- [ ] T101 [US1] (CC) Draft the PersonOrdersPanel diff: replace Tabs shell :255–391 with Collapsible column (shadcn `collapsible.tsx` re-exports); `forceMount` + static `data-[state=closed]:hidden` class (no display utility) replacing `PANEL_BODY_CLASSES` :47–48; column container takes `flex-1 min-h-0 overflow-auto`, card bodies lose per-panel scroll; per-card open state replaces `activeTab`/`SidebarTab` :95/:43, all default open (R-002); AC-002 contract comment :44–46 rewritten for the card contract; drawers :393–415, queries :62–100, refs, resolution state untouched; FR-008 amended behavior (no auto-expand — row-click flash :355–363 unchanged, now scrolling the column). Required with the diff: expected tsc/lint delta (0/0), grep evidence — 4× `TabsContent`, 4× `forceMount`, 1× `PANEL_BODY_CLASSES` definition + 4 uses — and blast radius (1 file).
- [ ] T102 [US1] (G) Approve T101 + rule T001; (CC) apply only after explicit go (conditional approvals block).
- [ ] T103 [US1] (G) Gate: tsc item-diff 54/54 (0 NEW), lint ≤8/≤19, tests green. Per-file baseline re-check: `grep -c PersonOrdersPanel` on the baseline = 0 (plan Area 4 predicts 0; a shift = tripwire surprise → stop).
- [ ] T104 [US1] (G, or CC via Playwright MCP) Browser verify on staging, named SM record: SC-001 (Orders+Finance visible together), SC-002 (card toggle = zero network, drawer input survives), SC-003 (conversation switch, no host remount), row-click flash/scroll works in the column; FR-013 subset: GHL switch, `?conversation` deep link + resolver, `?view=flat`, `?channel`, both collapse keys, auto-open on zero orders. Name the record in the verify note.
- [ ] T105 [US1] (G) Commit C1 (stage `src/modules/inbox/components/PersonOrdersPanel.tsx` by explicit path).

**Checkpoint**: US1 shippable alone.

---

## Phase 2: C2 — Additional Options → Finance card (US2, P2; after C1)

**Goal**: itemized options block moves; Finance card gains the per-order child (FR-006 option (a)).
**Independent Test**: spec US2 — same named record, order with options: lines in Finance card, absent from Orders card; zero-option order shows no empty section.

- [ ] T201 [US2] (CC) Verify-before-draft: grep `additionalOptions` usage inside OrderContextSummary — confirm the :89–100 data block serves only the :130–143 render (prediction: yes) so both move; confirm no other consumer of the itemized JSX. State expected match counts.
- [ ] T202 [US2] (CC) Draft: new per-order child component (name per T002) owning `useAdditionalOptionsByOrder(order.id)` (same key `['orders','additionalOptions',orderId]` — no new API surface); render it per order inside `InboxFinancesTab` adjacent to the existing options total (`getOrderAdditionalOptionsTotal`, :48/:56); remove :130–143 (+ :89–100 if T201 confirms) from `OrderContextSummary.tsx`. Move, not copy. Predictions: tsc/lint 0/0, 3 files (1 new).
- [ ] T203 [US2] (G) Approve; (CC) apply.
- [ ] T204 [US2] (G) Gate + baseline re-check for the three files (predict 0 items each; new file trivially 0).
- [ ] T205 [US2] (G/CC) Browser verify SC-008 both halves on the named record + zero-option order edge case.
- [ ] T206 [US2] (G) Commit C2.

---

## Phase 3: C3a — bulk-selection removal (US3, P2; independently shippable, no C1 dependency)

**Goal**: pure removal per the plan Area-1 per-symbol map; no flat-view contact.
**Independent Test**: spec US3 scenarios 2–4 + flat view unchanged.

- [ ] T301 [US3] (CC) Draft removals — `UnifiedInboxPage.tsx`: `selectedCustomerRowKeys` :105 + prune effect :656–662 + `selectedCustomerConversationIds` :519–520 + `toggleCustomerRowSelection` :929–937 + `handleToggleSelectAllCustomerRows` :939–964 + `handleDeleteCustomersRows` :966–978 + `handleConfirmBulkDelete` :980–1001 + `bulkDeleteDialogOpen`/`bulkDeleteConversationIds` :106–107 + dialog JSX :1080–1086 + import :12 + `customersMarkReadTargetIds`/`customersMarkUnreadTargetIds` :671–684 + customers branches of `handleToggleReadUnread` :855–896 and `anyToggleTargetUnread` :685–691 + CustomerThreadList props :1229–1241. `CustomerThreadList.tsx`: select-all :163–175, header text :176–186, per-row checkbox :291 block, Delete :197–206, R/U toggle :207–225, `FILTER_BUTTONS` Awaiting/Unlinked/Unread entries :20–26, orphaned props/types. Delete `BulkDeleteConversationsDialog.tsx` (sole importer verified). Keep: `selectedItems`, `markedReadIds`, `userForcedUnreadIds`, `handleDelete`, flat wiring. Dead-constant grep: `MAX_BULK_DELETE_CONVERSATIONS`, `MAX_BULK_SELECTION` — delete if orphaned. Predictions per symbol from the plan map, line-counted.
- [ ] T302 [US3] (G) Approve; (CC) apply.
- [ ] T303 [US3] (G) Gate + baseline re-check (UnifiedInboxPage, CustomerThreadList: predict 0).
- [ ] T304 [US3] (G/CC) Browser verify, named record: bulk UI count 0 (SC-004 partial); pills = All/Customers (+Hidden when muted) with Unmute reachable; unlinked row tag visible; **flat view**: its own Delete (confirm dialog) and Read/Unread still work, pills unchanged; FR-013 subset: deep link, `?view=flat`, `?channel`, search+debounce.
- [ ] T305 [US3] (G) Commit C3a (staged paths incl. the deletion).

---

## Phase 4: C3b — icon controls (US3, P2; after C3a; T003 ruling required)

**Goal**: "+" and Unread relocate as icon-only page-level controls; channel control per ruling.

- [ ] T401 [US3] (G) T003 ruling lands (channel control form) — blocks T402.
- [ ] T402 [US3] (CC) Draft: icon-only "+" (accessible name "New conversation") at page level beside the collapse button :1155–1160, wired to the existing `setNewConversationModalOpen` handler (:1186 pattern); remove CustomerThreadList's New button :189–196 + `onNewClick` prop; icon-only Unread toggle beside "+" bound to `listFilter === 'unread'` with `aria-pressed` (single surface — no Unread pill exists after C3a); channel control per T401 ruling (T-N1 evidence: current form already `h-6 text-[11px]`, options :28). Predictions: 2 files, tsc/lint 0/0, prop-boundary change only.
- [ ] T403 [US3] (G) Approve; (CC) apply.
- [ ] T404 [US3] (G) Gate + baseline re-check.
- [ ] T405 [US3] (G/CC) Browser verify, named record: SC-004 full (≤4 control groups), "+" opens the modal with prefill paths intact (composer + empty-channel entry points still work), Unread icon filters and reads back `unread_only` in the fetch; FR-013 subset: GHL switch, collapse keys.
- [ ] T406 [US3] (G) Commit C3b.

**Checkpoint**: US3 complete.

---

## Phase 5: C4 — visual pass (US4, P3; pill half independent, divider half after C1; T004 ruling at approval)

- [ ] T501 [P] [US4] (CC) Draft `InboxFilterPill.tsx` retoken: selected `bg-[#243D2E] text-white` (:24) → `background: var(--g-acc-lt)` + `1px solid var(--g-acc)` border + text `var(--g-acc-dk)` (unselected text `var(--g-tx)`), per the Finance chip pattern (InvoiceWorkspace.tsx:650/:671); add `aria-pressed={selected}`. Note in the diff: restyle reaches the flat view's `InboxFilterPillRow` (InboxConversationList:281) by design (T-2 ruling — shared component, no flat-specific work, no prop).
- [ ] T502 [US4] (CC) Draft the contrast/divider pass over the T-N2 enumerated surfaces ONLY: CustomerThreadList `divide-y` row separators, the 5 tab-component card borders, plus contrast on the rebuilt card headers (C1 surfaces). Functional control chrome untouched. gardens-*/`--g-*` tokens only, no new raw hex. T004 ruling at approval.
- [ ] T503 [US4] (G) Approve both + rule T004; (CC) apply.
- [ ] T504 [US4] (G) Gate + baseline re-check (InboxFilterPill + touched surfaces: predict 0).
- [ ] T505 [US4] (G/CC) Browser verify: SC-006 (`grep -c '#243D2E' src/modules/inbox` = 0; `aria-pressed` on every pill), both views' pills render sanely, selected-state contrast readable on the named record.
- [ ] T506 [US4] (G) Commit C4.

---

## Phase 6: Close-out (after all desired commits)

- [ ] T601 (CC draft, G applies) `docs/handoff.md` diff-edit (not rewrite): shell cycle status, per-commit tripwire tally, any overrides.
- [ ] T602 [P] (CC draft) `docs/backlog.md`: mark the Product-track "Inbox UX cleanup" item shipped (strike-through per house pattern), leaving the sidebar-polish spin-out and the mark-unread restore line standing; confirm the Arin-call flag line is present (added 2026-09-03).
- [ ] T603 [P] (CC draft) Add a drift note to the `docs/ux/inbox.md` header: audit line numbers predate the shell rebuild; structure sections A/C describe the pre-rebuild tab shell.
- [ ] T604 (G) Decide merge to staging + push; branch deletion after merge.
- [ ] T605 (G) Next Arin call: present the two visible changes — mark-unread removal ("ruled, not broke", spec FR-010) and the bulk-delete removal — alongside the shell rebuild demo.

---

## Dependencies & Execution Order

- **T001–T004** are rulings, each blocking only its phase's approval step (T003 blocks T402 at draft time).
- **C1 (Phase 1)** → C2, and C4's divider half. **C3a (Phase 3)** is independent of C1/C2 and may run first if priorities shift (disjoint files). **C3b** after C3a. **C4** last.
- Within every phase: draft → approve (+ruling) → apply → gate (+per-file baseline re-check) → browser verify (named record) → commit. No step skips; conditional approvals block until explicit go.
- Parallel: T501 may be drafted any time; T602/T603 parallel within Phase 6. Nothing else overlaps safely (UnifiedInboxPage.tsx and CustomerThreadList.tsx are shared by C3a/C3b — sequential by design).

## Implementation Strategy

MVP = Phase 1 alone (US1 is the Arin-visible complaint). Incremental: each commit is a shippable increment; stop-and-validate at every checkpoint. Tripwire discipline throughout: predictions before every apply, tally after; at 3 total, propose stopping (Giorgi may override; log it in `docs/handoff.md`).
