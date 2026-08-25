# Feature Specification: Inbox Sidebar Multi-Tabs (PersonOrdersPanel)

**Feature Branch**: `feature/inbox-sidebar-multi-tabs`
**Created**: 2026-08-25
**Status**: Draft
**Input**: User description: "Rebuild the inbox right-column sidebar (PersonOrdersPanel) as a
tabbed panel. Tabs: Orders (default, existing content), Contact (new), Finances (new), History
(new). Product tab is OUT OF SCOPE — not rendered, not stubbed." (Full constraint text C1–C6,
tab content contracts, UI quality bar, non-goals, and acceptance gates reproduced in the
sections below; the pre-spec read-only audit of 2026-08-25 is the ground-truth line-number
source.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tab shell with Orders tab preserved (Priority: P1)

A mason working the inbox selects a customer thread. The right-column sidebar now shows a
compact tab strip (Orders / Contact / Finances / History) with **Orders active by default**,
and the Orders tab renders exactly what the sidebar renders today: order summary card, New
order / Create invoice actions, job-scoped orders list, Unassigned section. Nothing about
order-context behaviour changes — auto-expand/collapse of the column, order auto-selection,
drawer flows, and the job probe all behave identically.

**Why this priority**: This is the load-bearing slice. Every other tab is additive; if the
shell regresses the existing Orders experience (the only current content), the feature is a
net loss. It also carries all six immovable constraints (C1–C6).

**Independent Test**: Deploy only the shell + Orders tab (other tabs may be visually empty
panels). Compare against `staging`: pixel-equivalent Orders content, identical network/query
behaviour on selection and on tab-strip render, drawers open/close unchanged.

**Acceptance Scenarios**:

1. **Given** a linked person with orders is selected, **When** the sidebar renders, **Then**
   the Orders tab is active and its content is pixel-equivalent to the pre-feature sidebar
   (summary card, jobAction row, orders list, unassigned section, same order).
2. **Given** the sidebar is rendered, **When** the user switches to any other tab and back,
   **Then** React Query devtools / network tab show **zero** query refires, the orders-count
   effect produces no new `onOrdersCountChange` values, and the panel does not remount
   (auto-select of first order does not re-fire).
3. **Given** CreateOrderDrawer or CreateInvoiceDrawer is open, **When** the user switches
   tabs, **Then** the drawer stays open with its form state intact.
4. **Given** an unlinked selection with no effective job (`!personId && !effectiveJob`),
   **When** the sidebar renders, **Then** the existing "Order context is available when a
   linked customer is selected" empty state renders with **no tab strip at all** (C3).
5. **Given** the desktop layout, **When** the tab strip renders, **Then** it does not sit
   under or visually collide with the page-level collapse button overlaid at the panel's
   top-left (`UnifiedInboxPage.tsx:1355-1369`, `top-2 left-2 z-10`) (C6).

---

### User Story 2 - Contact tab (Priority: P2)

With a linked customer selected, the mason opens the Contact tab and sees the person's
details — name, email, phone, address, city, country, customer status, and "customer since"
date — laid out as labeled rows. Email and phone are actionable links. For an unlinked
selection the tab shows a "no linked contact" empty state.

**Why this priority**: Highest-value new content — contact details are currently only in the
center-column header (name/handle only) and masons routinely need address/phone while reading
a thread. Zero data risk: the person record is already fetched by the panel.

**Independent Test**: With the P1 shell in place, select a linked person and verify every
Contact field against the customer record; select an unlinked thread and verify the empty
state; verify no new network request is attributable to the Contact tab.

**Acceptance Scenarios**:

1. **Given** a linked person, **When** Contact is opened, **Then** it shows
   `first_name + last_name`, email, phone, address, city, country, `is_customer` status, and
   `created_at` formatted as "customer since", each as a labeled definition-list row; absent
   values render a placeholder (em dash), not blank rows collapsing the layout.
2. **Given** a linked person with email and phone, **When** Contact renders, **Then** email is
   a `mailto:` link and phone is a `tel:` link.
3. **Given** an unlinked selection (job-linked, S5-capable or not), **When** Contact is
   opened, **Then** an icon + one-line "no linked contact" empty state renders and **no**
   person fetch is triggered (the existing `useCustomer` disable rule is untouched).
4. **Given** any selection, **When** the Contact tab renders, **Then** the only person data
   source is the panel's existing `useCustomer` query (key
   `['customers', id, organizationId]`) — no new query key appears in devtools.

---

### User Story 3 - Finances tab, order-level money v1 (Priority: P3)

The mason opens the Finances tab and sees, per order the panel already knows about, the money
breakdown (base value, permit cost, additional options total, order total) and a person-level
grand total — matching to the penny what the Orders tab's summary card shows for the same
order.

**Why this priority**: Useful at-a-glance money view, but strictly derived from data the
Orders tab already displays — lower urgency than Contact and fully dependent on P1.

**Independent Test**: With P1 in place, compare Finances figures against the summary card for
each order of a multi-order person; verify the grand total equals the sum of displayed order
totals; verify no invoice-related fetch occurs.

**Acceptance Scenarios**:

1. **Given** a person with N orders (job-scoped + unassigned), **When** Finances is opened,
   **Then** each order shows base value, permit cost, additional options total, and order
   total, computed exclusively via `getOrderBaseValue`, `getOrderPermitCost`,
   `getOrderAdditionalOptionsTotal`, `getOrderTotal` and formatted via `formatGbpDecimal` —
   and each order's total equals the Orders-tab summary card total for that order.
2. **Given** the same person, **When** Finances renders, **Then** a person-level grand total
   is shown equal to the sum of the per-order totals (helper-derived, no hand-rolled
   arithmetic beyond summing helper outputs, no `parseFloat` in components).
3. **Given** any selection, **When** Finances renders, **Then** no invoice paid/remaining/
   deposit values appear anywhere (deferred), and no invoice-money fetch is issued.
4. **Given** a selection with zero orders, **When** Finances is opened, **Then** an icon +
   one-line empty state renders (same treatment/tone as Contact's).

---

### User Story 4 - History tab, job list v1 (Priority: P4)

The mason opens the History tab and sees the selection's jobs newest-first — each with its
creation date, current stage as a badge, paid date if paid, and exit reason if exited. The
copy presents this as a **list of jobs with dates**, never as an activity/event log.

**Why this priority**: Pure read-out of probe data already in memory; nice-to-have context.
Smallest slice, last to land.

**Independent Test**: With P1 in place, select a repeat customer with multiple jobs (incl. an
exited one) and verify ordering, stage labels, paid_at, and exit_reason against the pipeline
board; verify no new fetch.

**Acceptance Scenarios**:

1. **Given** a selection with jobs, **When** History is opened, **Then** jobs from the
   panel's existing probe result (`jobsQuery.data` — person-keyed for linked, conversation-
   keyed for unlinked) render newest-first, each showing formatted `created_at`, the current
   stage as a badge using the pipeline's existing stage vocabulary (`formatStageLabel` — no
   parallel label/badge system), `paid_at` when present, and `exit_reason` when exited.
2. **Given** the UI copy of the tab, **When** reviewed, **Then** no wording implies
   stage-transition history or event timelines ("timeline", "activity", "moved to…" are all
   absent); the data shown is each job's current state plus its dates.
3. **Given** an unlinked selection whose probe returns no jobs, **When** History is opened,
   **Then** the same icon + one-line empty-state treatment as Contact renders.

---

### Edge Cases

- **Selection changes while a non-Orders tab is active**: active tab is component state; on
  person/selection change the tab may stay where it is or reset to Orders — either is
  acceptable, but the behaviour must be deterministic and must not trigger remounts of the
  panel. (Default assumed: active tab state persists across selection changes within the
  mounted panel; see Assumptions.)
- **Order-row click flash/scroll while Contact/Finances/History is active**: the summary-card
  flash + `scrollIntoView` interaction (`summaryRef`, `PersonOrdersPanel.tsx:279, :306-312`)
  lives inside the Orders tab; since order rows are also inside the Orders tab this can only
  fire when Orders is active — the ref target must remain in the (hidden-but-mounted) tree so
  no null-ref path is introduced.
- **List re-filter empties the selection** (`selectedCustomersRow` → null →
  `conversationIds=[]`): probe disables, `jobsResolved` goes false, count effect reports 0,
  page auto-collapses — all of this must behave exactly as today regardless of active tab.
- **S5 flow (unlinked but job-linked, "New order" resolves a person)**: `resolvedPersonId`
  populates mid-session; Contact tab must then render the newly resolved person from the same
  `useCustomer` query without any new fetch path being added.
- **Person with only unassigned orders (no job)**: Orders tab shows the Unassigned section as
  today; Finances still lists those orders; History may be empty.
- **Exited-job-only selection**: Orders tab keeps its "Exited job — orders are view-only"
  hint; History shows the exited job with its exit_reason.
- **Very long values (email, address, exit_reason)**: rows truncate/wrap without breaking the
  panel's fixed-width layout or introducing horizontal scroll.
- **Tab strip + header + collapse button on narrow desktop widths**: strip must remain usable
  and not overlap the collapse overlay (C6) at the panel's minimum rendered width.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sidebar MUST present four tabs — Orders (default), Contact, Finances,
  History — in that order. No Product tab is rendered or stubbed in any form.
- **FR-002**: The Orders tab MUST contain the current sidebar body verbatim — summary card
  (`OrderContextSummary`), jobAction row, job-scoped orders list, Unassigned section — moved
  inside the Orders tab wrapper only; no content changes and no component extraction that
  relocates hooks.
- **FR-003**: The Contact tab MUST render, from the panel's existing `useCustomer` data only:
  full name (`first_name` + `last_name`), email (as `mailto:`), phone (as `tel:`), address,
  city, country, `is_customer` status, and `created_at` presented as "customer since".
  Untyped `select *` columns are out of scope. Unlinked selections show a "no linked contact"
  empty state; no fetch path is added for them.
- **FR-004**: The Finances tab MUST render per-order money rows (base value, permit cost,
  additional options total, order total) and a person-level grand total, using ONLY the
  existing helpers `getOrderBaseValue`, `getOrderPermitCost`, `getOrderAdditionalOptionsTotal`,
  `getOrderTotal` (`src/modules/orders/utils/orderCalculations.ts`) and `formatGbpDecimal`
  (`src/shared/lib/formatters.ts`). No hand-rolled arithmetic, no `parseFloat` in components.
  All values are pounds-decimal; no pence fields exist in these queries and none may be added.
  Invoice paid/remaining/deposit display is deferred; no invoice-money fetch.
- **FR-005**: The History tab MUST render the jobs from the panel's existing probe result
  (`jobsQuery.data`) newest-first, showing per job: formatted `created_at`, current stage as
  a badge (stage text via the pipeline's `formatStageLabel`), `paid_at` when present,
  `exit_reason` when exited. It is a job list with dates — no event-log modeling, and no UI
  copy implying stage-transition history.
- **FR-006**: Active-tab state MUST be component-local (no URL state), defaulting to Orders.
- **FR-007**: Empty states in Contact/Finances/History MUST use an icon + one-line
  explanation matching the tone of the panel's existing empty state
  (`PersonOrdersPanel.tsx:270-274` as the reference).
- **FR-008**: Tab strip MUST be compact icon + label (lucide icons: Package / User /
  PoundSterling / Clock or equivalents), with a clearly distinguished active state and
  keyboard navigation (Radix Tabs arrow-key nav preserved if Radix is used).
- **FR-009**: Tab switching MUST cause no layout shift, and all tab panels MUST share the
  same scroll-container behaviour as the current body (`PersonOrdersPanel.tsx:259` —
  `flex-1 min-h-0 overflow-auto`).
- **FR-010**: New surfaces in these tabs MUST follow the in-progress contrast pass: gardens-*
  tokens throughout, shadcn primitives and existing badge variants, and the
  `bg-gardens-surf` / `surf2` per-surface override pattern for any field/input surface —
  never bare `--background`.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (C1 — probe logic untouched)**: The job-probe logic at
  `PersonOrdersPanel.tsx:59-61` (`useJobsByPersonId(personId)` /
  `useConversationsJobs(personId ? undefined : conversationIds)` / person-wins selection) and
  everything derived from it at `:62-105` (`jobsResolved`, `effectiveJob` via
  `effectiveJobId`, `activeSelectedJob`, S5 `useConversation`, `useOrdersByJobId`,
  `uninvoicedJobOrders`, the orders-count effect) MUST remain behaviorally identical. All
  hook calls stay above the returns, unconditional, in current order. `CustomerConversationView`
  is not edited.
- **AC-002 (C2 — always-mounted panels)**: All four tab panels stay mounted at all times.
  Tab switching toggles visibility via className only — never conditional rendering. If
  shadcn/Radix Tabs is used, every `TabsContent` MUST use `forceMount` with class-based
  hiding of inactive panels (Radix's default unmount of inactive content is forbidden).
  Rationale (audit-verified): orders-count effect `:97-105` drives page-level auto-collapse
  (`UnifiedInboxPage.tsx:231-235`); the page keeps the panel mounted by design
  (`:1351-1352`); `autoSelectedPersonRef` (`:151`) and `resolvedPersonId` (`:73`) reset on
  remount; `summaryRef` (`:279, :306-312`) must stay in the tree; portaled drawers
  (`:330-346`) hold panel-local open state.
- **AC-003 (C3 — early return preserved)**: The early return at `PersonOrdersPanel.tsx:227-237`
  (`!personId && !effectiveJob` empty state) is preserved: no tabs render in that state.
- **AC-004 (C4 — count effect invariant)**: The orders-count effect (`:97-105`) fires
  identically regardless of which tab is active.
- **AC-005 (C5 — drawers at panel root)**: `CreateOrderDrawer` / `CreateInvoiceDrawer` remain
  at panel root, outside any tab panel, so an open drawer survives tab switches.
- **AC-006 (C6 — collapse-button clearance)**: The tab strip must not collide with the
  absolutely-positioned collapse button at `UnifiedInboxPage.tsx:1355-1369` (`top-2 left-2
  z-10` overlay); the header layout accounts for it.
- **AC-007 (module boundaries)**: All new components live in `src/modules/inbox/components/`;
  data flows only through the panel's existing hooks; helper imports from `orders`, `shared`,
  and `jobsPipeline` barrels/utilities only — no deep-imports of other modules' internals
  beyond the patterns the panel already uses.
- **AC-008 (non-goals, hard)**: No new queries, hooks, or query keys of any kind. No changes
  to `UnifiedInboxPage`. No changes to `CustomerConversationView`. No invalidation changes.
  No Product tab. No URL state for the active tab. No stage-transition/event-log modeling.

### Key Entities *(include if feature involves data)*

- **Person (Customer)**: already fetched via `useCustomer(effectivePersonId)` (key
  `['customers', id, organizationId]`; `select *` from `people`, org-guarded). Typed fields
  used by Contact: `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`,
  `is_customer`, `created_at`. Null when the selection is unlinked (query disabled).
- **Order**: already fetched via `useOrdersByPersonId` / `useOrdersByJobId` (archived rows
  excluded at the API layer). Money fields consumed by Finances are pounds-decimal:
  `value`, `renovation_service_cost`, `permit_cost`, `additional_options_total`.
- **Job (ConversationJobSummary)**: already fetched by the probe
  (`useJobsByPersonId` / `useConversationsJobs`), selecting `id, conversation_id, stage,
  exit_reason, paid_at, created_at`, newest first. Consumed as-is by History; no additional
  fields exist and none are added.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Orders tab is pixel-equivalent to the current sidebar (side-by-side
  comparison against `staging` for the same selection shows no visual or behavioural diff).
- **SC-002**: Switching between all four tabs produces **zero** query refires (React Query
  devtools / network tab), zero `onOrdersCountChange` emissions beyond baseline, no drawer
  close, and no order/job selection reset.
- **SC-003**: Contact shows correct values for a linked person (verified against the customer
  record) and the empty state for unlinked selections, with no person fetch on the unlinked
  path.
- **SC-004**: For every order visible in the panel, Finances figures match the Orders-tab
  summary card's numbers exactly, and the grand total equals the sum of order totals.
- **SC-005**: History lists jobs newest-first with correct stage labels, shows `paid_at` and
  `exit_reason` where applicable, and contains no event-log language.
- **SC-006**: Gates — `npx tsc -p tsconfig.app.json --noEmit` error count stays exactly at
  the pre-change baseline (54 as of 2026-08-25); ESLint stays at the pre-change baseline
  (user-stated 10 errors / 19 warnings — re-measure both baselines on the feature branch
  before the first change; see Assumptions) unless a known-pattern warning is added, in which
  case it is predicted before apply.

## Assumptions

- **Active-tab persistence across selection changes**: the description mandates component
  state defaulting to Orders but doesn't say whether a selection change resets the active
  tab. Assumed: the tab state simply persists while the panel stays mounted (no reset
  effect), since adding a reset effect keyed on selection would be new selection-coupled
  behaviour. Cheap to flip at implementation if Giorgi prefers reset-to-Orders.
- **Stage "badge" reuse**: the pipeline has no shared `StageBadge` component — stage display
  today is `formatStageLabel(stage)` text inside styled chips (StageBoard column headers,
  the conversation-header hint chip). "Reuse the pipeline's existing stage badge styling" is
  therefore interpreted as: stage text via `formatStageLabel` rendered in the existing shadcn
  `Badge` (or the existing chip classes), matching the hint-chip visual language — no new
  stage-color vocabulary.
- **Grand-total summation**: "existing helpers ONLY / no hand-rolled arithmetic" is
  interpreted as permitting a `reduce` that sums `getOrderTotal(order)` outputs (there is no
  existing multi-order total helper); what is forbidden is re-deriving any per-order figure
  outside the four helpers or parsing strings in components.
- **Finances order set**: "per order from the panel's existing queries" is assumed to mean
  the same displayed set as the Orders tab (job-scoped `jobOrders` + `unassignedOrders`),
  keeping the two tabs' universes consistent.
- **History for unlinked selections**: `jobsQuery.data` is the conversation-keyed probe
  result there; History renders whatever the probe returns (it can be non-empty for unlinked
  job-linked selections), with the empty state only when the resolved result is empty.
- **Lint baseline discrepancy**: the feature description states 10 errors / 19 warnings; the
  recorded 2026-08-25 baseline in project memory says 10 errors / 16 warnings. The gate is
  "no new findings vs a baseline measured on this branch immediately before the first
  change" — the measured number wins, and the discrepancy is surfaced at gate time rather
  than silently adopted.
- **Date formatting**: existing formatters only (`formatDateDMY` in `src/shared/lib/formatters.ts`
  or the pipeline's `formatShortDate` in `src/modules/jobsPipeline/utils/display.ts`); which
  one is a plan-time choice, not a new helper.
- **Desktop-only surface**: the right column is `hidden lg:flex` at the page level; no
  mobile behaviour is added or changed.

---

## Post-T020 changes (authorized) — 2026-08-26

Shipped after the specced feature completed (T021 pass), per live requests from Giorgi. The
original text above stays unedited as the record of what was specified and followed through
T021.

- **Header removal + count relocation** (commit `c99fc76`): the "Order context (N)" header
  row was removed; the order count now sits on the Orders trigger (visible whenever > 0,
  from any tab); the close affordance moved onto the tab-strip row.
- **Control consolidation** (commit `c99fc76` — the authorized AC-008 deviation touching
  `UnifiedInboxPage.tsx`): the page-level floating collapse button was removed; the strip's
  right-edge PanelRightClose button is the single collapse control. **AC-006/C6 are now
  vacuous** — the button they reference no longer exists. Accepted behavior change: the
  surviving control keeps `onCloseOrder` semantics, so collapsing also clears the order
  selection.
- **Strip label pattern** (commit `1e08522`): FR-008's "icon + label" is visually
  active-tab-only; every trigger keeps its label in the DOM via sr-only (accessible names
  intact) with `title` tooltips for mouse users.
- **SC-001 divergence**: the Orders tab's panel *chrome* (header, close control) differs
  from the pre-feature sidebar; **FR-002's verbatim Orders body still holds** — the summary
  card, action row, orders list, and Unassigned section are unchanged.
- **Contact editing** (commit `c55a055`): the previously deferred capability shipped via
  reuse of the customers module's `EditCustomerDrawer` (barrel import; drawer at panel root;
  Edit button on the Contact tab). **The strict non-goals still hold** — no new queries,
  hooks, or query keys were authored; the mutation and its invalidations are the drawer's
  pre-existing ones.
