# Tasks: Inbox Sidebar Multi-Tabs (PersonOrdersPanel)

**Input**: `specs/inbox-sidebar-multi-tabs/plan.md` (+ research.md, data-model.md,
contracts/components.md, quickstart.md; spec at `specs/inbox-sidebar-multi-tabs/spec.md`)
**Branch**: `feature/inbox-sidebar-multi-tabs`

**Organization**: tasks group under the plan's 4-commit sequence (= user stories P1→P4).
Each task belongs to exactly one commit group; no task spans commits. Groups are strictly
sequential (each ends in a gate that blocks the next), and every task inside a group that
touches `PersonOrdersPanel.tsx` is sequential (same file) — **no [P] tasks exist in this
feature**; the only different-file tasks (the new components) are still ordered before their
same-group wiring edit.

**Tests**: none requested; verification is the quickstart script + per-commit gates.

**Line-number caveat**: all `:NNN` references are `staging` @ `f7449dd` coordinates (the
audit baseline). Group 1's edits shift later line numbers; groups 2–4 locate their targets by
literal text, not line number.

**Edit discipline (Giorgi's protocol, binding at implement time)**:
- Per-edit approval; show diffs before applying.
- Every Edit below is a single-occurrence replacement — **expected match count = 1 for every
  old_string; no replace_all anywhere in this feature**. Verify uniqueness by grep before
  each apply; a 0-or-2+ match is a stop-and-report, not an improvise.
- Forbidden files (binding note 3): `src/shared/components/ui/tabs.tsx`,
  `UnifiedInboxPage.tsx`, `CustomerConversationView.tsx`, and anything outside:
  `src/modules/inbox/components/PersonOrdersPanel.tsx`, `InboxContactTab.tsx`,
  `InboxFinancesTab.tsx`, `InboxHistoryTab.tsx` (the last three: new files).
- No speculative additions (binding note 2): no useMemo/useCallback/React.memo anywhere in
  this feature; Finances receives its orders as an inline spread; presentational children
  call no data hooks.

---

## Phase 0: On-branch baseline (BEFORE any source edit)

- [X] **T001** Measure fresh gates on `feature/inbox-sidebar-multi-tabs` before touching any
  source file, and REPORT the numbers before Group 1 begins:
  `npx tsc -p tsconfig.app.json --noEmit` (predicted: exactly 54 errors) and
  `npm run lint` (predicted: exactly 10 errors / 19 warnings).
  If either measurement deviates from prediction → stop and report; the measured numbers
  become the branch baseline only after Giorgi acknowledges the deviation. These baselines
  are what every subsequent gate task diffs against.

**Checkpoint**: baseline reported → Group 1 may begin.

---

## Commit Group 1 — Tab shell + Orders relocation + inline placeholders (US1, P1) 🎯 MVP

**Goal**: PersonOrdersPanel renders a 4-tab strip; Orders tab = current body verbatim;
Contact/Finances/History are inline empty-state placeholder panels (final empty-state markup,
so this commit is shippable alone). All panels forceMounted, class-hidden.
**File**: `src/modules/inbox/components/PersonOrdersPanel.tsx` ONLY.
**Independent test**: quickstart SC-001 steps 1–6 + SC-002 (placeholders count as the
not-yet-built tabs).

- [X] **T002** [US1] Edit 1/4 — imports. In `PersonOrdersPanel.tsx`:
  (a) extend the lucide import `import { Package, X } from 'lucide-react';` (:4) to
  `import { Clock, Package, PoundSterling, User, X } from 'lucide-react';`
  (b) immediately after it, add
  `import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';`
  Two str_replace operations, each expected match count 1. (`useState` is already imported
  at :1 — do not touch that line.)

- [X] **T003** [US1] Edit 2/4 — module-scope constants + tab state. In `PersonOrdersPanel.tsx`:
  (a) after the `SECTION_LABEL` const (:36), add:
  ```ts
  type SidebarTab = 'orders' | 'contact' | 'finances' | 'history';
  // Same scroll-container classes as the pre-tabs body; mt-0 resets the primitive's mt-2.
  // No display utility here — keeps data-[state=inactive]:hidden (and Radix's hidden attr)
  // effective on forceMounted panels (AC-002).
  const PANEL_BODY_CLASSES =
    'flex-1 min-h-0 overflow-auto scrollbar-hide px-3 py-3 space-y-3 mt-0 data-[state=inactive]:hidden';
  ```
  (b) next to the drawer state (`const [orderDrawerOpen, …]` block at :81-82), add
  `const [activeTab, setActiveTab] = useState<SidebarTab>('orders');`
  — above both returns, after all existing hooks it neighbors; existing hook order untouched
  (C1). Two str_replace operations, each expected match count 1.

- [X] **T004** [US1] Edit 3/4 — open the tab structure. Replace the body-opening div (:259)
  `<div className="flex-1 min-h-0 overflow-auto scrollbar-hide px-3 py-3 space-y-3">`
  (expected match count 1 — grep-verify; the early return's inner divs use different
  classes) with: `Tabs` root (`value={activeTab}`,
  `onValueChange={(v) => setActiveTab(v as SidebarTab)}`,
  `className="flex-1 min-h-0 flex flex-col"`) → `TabsList` (gardens-styled strip: full-width
  row under the header, compact `h-8`-scale triggers, each trigger = icon (`h-3.5 w-3.5`) +
  label — Orders/`Package`, Contact/`User`, Finances/`PoundSterling`, History/`Clock`; active
  state via `data-[state=active]:` gardens classes (e.g. `bg-gardens-grn-lt/80
  text-gardens-tx` active vs `text-gardens-txs` inactive), overriding the primitive's
  `bg-muted`/`bg-background` — FR-010; strip sits below the existing header so it never
  enters the page-level collapse-button overlay zone — C6) → then
  `<TabsContent value="orders" forceMount className={PANEL_BODY_CLASSES}>`.
  The current body's children (:260-327 — the isLoading/error/empty ternary through
  `{unassignedSection}`) are NOT modified — only re-indented under the new wrapper.

- [X] **T005** [US1] Edit 4/4 — close Orders panel, add placeholder panels, close Tabs.
  Replace the body-closing sequence (the `</div>` at :328 followed by the blank line and
  `<CreateOrderDrawer` — include the drawer line in old_string for uniqueness; expected
  match count 1) with: `</TabsContent>` + three placeholder panels, then `</Tabs>`, then the
  untouched `<CreateOrderDrawer` line. Each placeholder:
  `<TabsContent value="contact" forceMount className={PANEL_BODY_CLASSES}>` containing the
  final empty-state markup (centered: icon `h-5 w-5 text-gardens-txs` + one
  `text-sm text-gardens-txs` line — tone of :270-274): Contact/`User`/"No linked contact for
  this conversation"; Finances/`PoundSterling`/"No orders to summarise yet";
  History/`Clock`/"No jobs for this selection yet". Drawers remain siblings of `</Tabs>`
  inside the root div — C5; do not touch their JSX.

- [X] **T006** [US1] Structural verification (blocking):
  (a) `git diff` shows the early-return block (`if (!personId && !effectiveJob) {` through
  its closing `}`, pre-edit :227-237) is **byte-identical** — zero diff hunks touch it;
  (b) hook order above both returns unchanged: every existing hook call line (:47-105 region
  + :151-165 refs/effects) appears in the diff only as context or pure re-indentation —
  the ONLY new hook is T003's `useState`;
  (c) grep confirms exactly **4** `forceMount` occurrences and **4** `TabsContent`
  opening tags in the file, and **0** occurrences of `forceMount` elsewhere in `src/modules/inbox/`;
  (d) drawers: `<CreateOrderDrawer` and `<CreateInvoiceDrawer` both appear AFTER `</Tabs>`
  and before the root `</div>`.
  Any failure → stop and report; do not proceed to T007.

- [X] **T007** [US1] GATE (blocks Group 2): run
  `npx tsc -p tsconfig.app.json --noEmit` (predicted **54**) and `npm run lint` (predicted
  **10 / 19**). Deviation from T001's accepted baseline → stop-and-report before any commit.
  Then dev-server smoke per quickstart SC-001 steps 1–6 and SC-002 steps 2–3 (tab switch: no
  query refires, drawer survives; early return shows no strip).

- [X] **T008** [US1] Commit group 1 (after Giorgi's go):
  `Add tab shell to inbox PersonOrdersPanel (Orders moved verbatim, placeholders for new tabs)`
  — single file: `src/modules/inbox/components/PersonOrdersPanel.tsx`.

**Checkpoint**: US1 shippable — tabbed panel with full Orders behaviour.

---

## Commit Group 2 — Contact tab (US2, P2)

**Goal**: real Contact tab body fed by the panel's existing `useCustomer` data.
**Files**: `src/modules/inbox/components/InboxContactTab.tsx` (NEW),
`PersonOrdersPanel.tsx` (wiring edit).
**Independent test**: quickstart SC-003.

- [X] **T009** [US2] Create `src/modules/inbox/components/InboxContactTab.tsx` per
  `contracts/components.md`: props `{ hasLinkedPerson: boolean; person: Customer | undefined }`
  (`Customer` type-imported from `@/modules/customers/hooks/useCustomers`). Render states:
  `!hasLinkedPerson` → empty state (reuse the exact placeholder markup from T005 —
  `User` icon + "No linked contact for this conversation"); `hasLinkedPerson && !person` →
  2–3 `Skeleton` rows (`@/shared/components/ui/skeleton`, `bg-gardens-bdr/80` like :262-264);
  `person` → card (`rounded-xl border border-gardens-bdr bg-white/90 p-3.5 space-y-1.5` —
  summary-card surface) of definition rows (label `text-[11px] text-gardens-txs` left, value
  `text-[11px] font-medium text-gardens-tx` right — the `InboxOrderSummaryCard` row idiom):
  Name (`[first_name, last_name].filter(Boolean).join(' ')` or em dash), Email
  (`<a href={'mailto:' + person.email}>` when present, else em dash), Phone (`tel:` same
  pattern), Address, City, Country (em dash when null), Status (`is_customer` ? 'Customer' :
  'Contact'), Customer since (`formatDateDMY(person.created_at)`). No data hooks, no
  `parseFloat`, single component export (props interface may be exported type-only).

- [X] **T010** [US2] Wire it: in `PersonOrdersPanel.tsx`, (a) add
  `import { InboxContactTab } from '@/modules/inbox/components/InboxContactTab';` beside the
  other inbox-component imports (match count 1); (b) replace the contact placeholder panel's
  inner markup (unique by its "No linked contact for this conversation" literal, match count
  1) with `<InboxContactTab hasLinkedPerson={effectivePersonId != null} person={person} />`.
  `TabsContent` wrapper, `forceMount`, and `PANEL_BODY_CLASSES` unchanged.

- [X] **T011** [US2] GATE (blocks Group 3): tsc predicted **54**, lint predicted **10 / 19**
  (new file exports one component; type-only interface export is
  `react-refresh/only-export-components`-silent). Deviation → stop-and-report. Smoke:
  quickstart SC-003 (linked person rows correct incl. mailto/tel; unlinked → empty state, no
  customers query fired; S5 resolution updates the tab).

- [X] **T012** [US2] Commit group 2 (after go): `Add Contact tab to inbox sidebar` —
  `InboxContactTab.tsx` (A), `PersonOrdersPanel.tsx` (M).

**Checkpoint**: US1+US2 independently functional.

---

## Commit Group 3 — Finances tab (US3, P3)

**Goal**: order-level money read-out from the panel's existing order arrays.
**Files**: `src/modules/inbox/components/InboxFinancesTab.tsx` (NEW),
`PersonOrdersPanel.tsx` (wiring edit).
**Independent test**: quickstart SC-004.

- [X] **T013** [US3] Create `src/modules/inbox/components/InboxFinancesTab.tsx` per
  contracts: props `{ orders: Order[]; isLoading: boolean }` (`Order` type-imported from
  `@/modules/orders/types/orders.types`). `isLoading` → Skeleton rows; `orders.length === 0`
  → empty state (T005's finances placeholder markup verbatim). Otherwise: per order a card
  (summary-card surface) headed `getOrderDisplayId(order)` (mono, like :35-37 of
  InboxOrderListRow) + `formatOrderTypeLabel(order.order_type)` chip, with rows Base value /
  Permit cost / Additional options / **Order total**, each value
  `formatGbpDecimal(getOrderBaseValue(order))` etc. — the four helpers from
  `@/modules/orders/utils/orderCalculations` + `formatGbpDecimal` from
  `@/shared/lib/formatters` are the ONLY arithmetic/format sources; zero-valued non-total
  rows render em dash, the Total row always renders. Footer row **Grand total** =
  `formatGbpDecimal(orders.reduce((sum, order) => sum + getOrderTotal(order), 0))` (the one
  permitted summation). Hard bans: `parseFloat`, field arithmetic, pence anything, invoice
  anything, memoization, data hooks.

- [X] **T014** [US3] Wire it: in `PersonOrdersPanel.tsx`, (a) add the import (match count 1);
  (b) replace the finances placeholder inner markup (unique by "No orders to summarise yet",
  match count 1) with
  `<InboxFinancesTab orders={[...jobOrders, ...unassignedOrders]} isLoading={isLoading} />`
  — **inline spread, NO useMemo** (binding note 2).

- [X] **T015** [US3] GATE (blocks Group 4): tsc predicted **54**, lint predicted **10 / 19**.
  Deviation → stop-and-report. Smoke: quickstart SC-004 (per-order totals match the summary
  card; grand total = sum; no invoice requests/wording).

- [X] **T016** [US3] Commit group 3 (after go): `Add Finances tab to inbox sidebar
  (order-level money)` — `InboxFinancesTab.tsx` (A), `PersonOrdersPanel.tsx` (M).

**Checkpoint**: US1–US3 independently functional.

---

## Commit Group 4 — History tab (US4, P4)

**Goal**: newest-first job list from the existing probe result.
**Files**: `src/modules/inbox/components/InboxHistoryTab.tsx` (NEW),
`PersonOrdersPanel.tsx` (wiring edit).
**Independent test**: quickstart SC-005.

- [X] **T017** [US4] Create `src/modules/inbox/components/InboxHistoryTab.tsx` per contracts:
  type-only export
  `interface SidebarHistoryJob { id: string; stage: JobStage; exit_reason: string | null; paid_at: string | null; created_at: string; }`
  (structural subset — `ConversationJobSummary` is deliberately not barrel-exported;
  `JobStage` type-imported from `@/modules/jobsPipeline`). Props
  `{ jobs: SidebarHistoryJob[] | undefined }`. **Binding note 1 — do not collapse the two
  falsy-ish states**: `jobs === undefined` (probe disabled / not yet resolved — load-bearing
  distinction in this panel) → Skeleton rows; `jobs.length === 0` → empty state (T005's
  history placeholder markup verbatim). Otherwise render rows in input order (already
  newest-first — no re-sort): per job a card row with "Created
  `formatDateDMY(job.created_at)`", a stage chip — `formatStageLabel(job.stage)` in the
  existing chip classes `text-[11px] font-medium text-gardens-txs px-2 py-0.5 rounded-md
  bg-gardens-page` (no new badge vocabulary), "Paid `formatDateDMY(job.paid_at)`" only when
  `paid_at` non-null, and when `exit_reason` non-null a muted `text-[11px] text-gardens-txs`
  line showing it. Copy ban (SC-005): no "timeline"/"activity"/"moved"/event-log phrasing
  anywhere in this file's strings. No data hooks, no re-sorting, no memoization.

- [X] **T018** [US4] Wire it: in `PersonOrdersPanel.tsx`, (a) add the import (match count 1);
  (b) replace the history placeholder inner markup (unique by "No jobs for this selection
  yet", match count 1) with `<InboxHistoryTab jobs={jobsQuery.data} />`. If tsc rejects the
  structural assignment (`ConversationJobSummary[] | undefined` →
  `SidebarHistoryJob[] | undefined`), stop and report the exact error — do NOT widen types
  or add casts unilaterally.

- [X] **T019** [US4] GATE (final): tsc predicted **54**, lint predicted **10 / 19**.
  Deviation → stop-and-report. Smoke: quickstart SC-005 (ordering, stage labels vs pipeline
  board, paid_at, exit_reason, copy check, undefined-vs-empty rendering).

- [X] **T020** [US4] Commit group 4 (after go): `Add History tab to inbox sidebar (job list
  from probe data)` — `InboxHistoryTab.tsx` (A), `PersonOrdersPanel.tsx` (M).

**Checkpoint**: all four stories functional.

---

## Phase 5: Close-out

- [X] **T021** Full quickstart pass (`specs/inbox-sidebar-multi-tabs/quickstart.md`) end to
  end, including the three regression spot-checks (auto-collapse, flash-scroll, search-filter
  vanish), and report results against SC-001…SC-006. Any regression → stop; fixes get their
  own approved diffs.

---

## Dependencies & Execution Order

Strictly linear: `T001 → (T002 → T003 → T004 → T005 → T006 → T007 → T008) → (T009 → T010 →
T011 → T012) → (T013 → T014 → T015 → T016) → (T017 → T018 → T019 → T020) → T021`.

- No [P] tasks: every group shares `PersonOrdersPanel.tsx`, groups are commit-ordered, and
  each gate (T007/T011/T015/T019) blocks the next group. New-component tasks (T009, T013,
  T017) precede their same-group wiring edit.
- Rollback property: reverting any group's commit restores a fully working prior state
  (placeholder panels in group 1 make later groups' absence non-breaking).

## Notes

- Line refs are pre-edit (`staging` @ `f7449dd`); groups 2–4 target literals, not lines.
- Every old_string in this feature: expected match count **1**; grep-verify before apply;
  no replace_all.
- Per-edit approval + diff display at implement time (Giorgi's protocol).
- Forbidden-file list and no-speculative-additions rule are binding on every task above.

---

## Post-T020 (unplanned, live-request)

Three additional source commits landed after T020, each under the same per-edit approval +
gate protocol (all gates held at the itemized 54-error tsc baseline and 10/19 lint):

- `1e08522` — strip polish: inactive triggers icon-only; labels stay in the DOM (sr-only,
  restored on the active trigger via group-data variants); title tooltips; flex-1 dropped,
  min-w-0/truncate retained.
- `c99fc76` — header removal + collapse-control consolidation: the "Order context (N)"
  header row removed (count relocated to the Orders trigger); the page-level floating
  collapse button removed; the strip's right-edge PanelRightClose button is the single
  collapse control (keeps onCloseOrder semantics — collapsing now also clears the order
  selection, an accepted behavior change). **Forbidden-file deviation, authorized by
  Giorgi**: this commit edits `UnifiedInboxPage.tsx` (button block + unused import), the one
  exception to this file's binding forbidden-file list.
- `c55a055` — contact editing via the customers module's shared `EditCustomerDrawer`
  (barrel import): Edit button on the Contact tab (`onEdit` prop), drawer at panel root,
  `editDrawerOpen` state. No new queries, hooks, or query keys authored.
