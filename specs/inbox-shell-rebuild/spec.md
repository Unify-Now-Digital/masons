# Feature Specification: Inbox Right-Panel Shell Rebuild + Top-Bar Control Reduction

**Feature Branch**: `feature/inbox-shell-rebuild`
**Created**: 2026-09-03
**Status**: Draft
**Input**: User description: "Inbox right-panel shell rebuild — tabs to collapsible cards, plus top-bar control reduction." Full scope, rulings (2026-09-02, docs/backlog.md Product track), and invariants supplied in the /specify argument; `docs/ux/inbox.md` (audit, pinned at staging `1ab595a`) is the structural source of truth. Where the audit and any older doc disagree, the audit wins.

> **Line-number status**: audit anchors re-verified 2026-09-03 on `feature/inbox-shell-rebuild` (branched from staging `278ad36`). `PersonOrdersPanel.tsx`, `CustomerThreadList.tsx`, `OrderContextSummary.tsx`, `InboxFilterPill.tsx` are unchanged from the audit. `UnifiedInboxPage.tsx` drifted +6/7 lines below ~:96 (search-cycle C3 debounce): searchQuery :97, debounce :98–103, selectedCustomerRowKeys :105, bulk-delete state :106–107, ?conversation seed :108–115, collapse state :154–155, storage keys :168–171, auto-open effect :240, baseFilters :250–256, deep-link resolver ~:590–605, NewConversationModal :1069, GHL switch :1090–1119 (role=tab :1094/:1108), collapse button :1155–1160, column 3 :1357, vestigial `relative` :1360, PersonOrdersPanel render :1361. All refs below use these current numbers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tabs become one column of collapsible cards (Priority: P1)

Staff working a conversation see the customer's Orders, Contact, Finance, and History context as four collapsible cards in a single scrolling column, instead of four mutually exclusive tabs. They can see Orders and Finance at the same time — impossible today — and collapse what they don't need.

**Why this priority**: The shell swap is the feature. Every other change hangs off it, and it is the Arin-visible UX complaint (tab-hopping to assemble context).

**Independent Test**: On staging, select a conversation with a linked person that has orders (name the specific record at verify time). All four cards render in one column; expanding/collapsing any card shows/hides its body with zero network requests; an open Create Order drawer with typed input survives collapsing every card.

**Acceptance Scenarios**:

1. **Given** a selected conversation with linked person and orders, **When** the right panel renders, **Then** four cards — Orders, Contact, Finance, History, in that order — appear in one vertically scrolling column, and no tab bar renders.
2. **Given** any card, **When** its header is toggled, **Then** the body hides/shows without unmounting (no refetch, no spinner flash, no scroll-position reset elsewhere in the column) and the collapsed body contributes zero height.
3. **Given** an open drawer (Create Order / Create Invoice / Edit Customer) with user-entered input, **When** any card is collapsed and re-expanded, **Then** the drawer and its input are intact.
4. **Given** a card in either state, **When** the user selects a different conversation, **Then** the panel host is not remounted (queries refresh by key change only; drawer/resolution state per today's semantics).

---

### User Story 2 - Additional Options itemization moves into the Finance card (Priority: P2)

Staff reviewing a customer's money position see the per-order Additional Options line items inside the Finance card alongside the options total the Finance view already shows — instead of finding the itemization only inside the Orders view.

**Why this priority**: Ruled scope; depends on the Finance card existing (P1) but is separately shippable and testable.

**Independent Test**: For an order with additional options on the named staging record: Finance card lists that order's option line items; Orders card no longer renders the itemized block.

**Acceptance Scenarios**:

1. **Given** an order with additional options, **When** the Finance card renders, **Then** each option line (label + amount) appears under that order, consistent with the total already computed via `getOrderAdditionalOptionsTotal` (InboxFinancesTab.tsx:48,56).
2. **Given** the same order, **When** the Orders card renders, **Then** the itemized block (formerly OrderContextSummary:130–143) is absent — moved, not duplicated.
3. **Given** an order with zero options, **When** the Finance card renders, **Then** no empty itemization section appears.

---

### User Story 3 - Top-bar control reduction (Priority: P2)

Staff see a customers-list header with materially fewer controls: an icon-only Unread filter toggle and an icon-only "+" beside the list-collapse button, no bulk-selection apparatus, a shorter filter-pill row, and a smaller channel control. New conversation, unread triage, hidden-sender recovery, and search all remain. One capability is deliberately removed (R-001, ruled 2026-09-03): manual mark-unread leaves the customers view with bulk selection.

**Why this priority**: Ruled 2026-09-02; independent of the P1 shell (different component: CustomerThreadList/page header vs PersonOrdersPanel).

**Independent Test**: Customers view on staging: count header controls before/after; create a conversation from the relocated "+"; confirm Unmute is still reachable under Hidden.

**Acceptance Scenarios**:

1. **Given** the customers view, **When** the header renders, **Then** the "+ New" labeled button (CustomerThreadList:189–196) is gone and an icon-only "+" with an accessible name sits beside the list-collapse button (page :1155–1160), opening NewConversationModal exactly as before.
2. **Given** the customers view, **When** the header renders, **Then** the select-all checkbox (:163–175), per-row checkboxes (:291), "Customers · N new" header text (:176–186), bulk Delete (:197–206), and bulk Read/Unread toggle (:207–225) are absent.
3. **Given** the filter row, **When** it renders, **Then** Awaiting, Unlinked, and Unread pills are absent; All and Customers remain; `Hidden (n)` still appears when mutedCount > 0 and the row-level Unmute (:387–401) still works under it.
4. **Given** an unlinked conversation, **When** its row renders, **Then** its inline "unlinked" tag still shows (discoverability without the removed filter).
5. **Given** the flat view (`?view=flat`), **When** it renders, **Then** its parallel control stack is unchanged (exempt; it inherits only shared-component changes).
6. **Given** the icon-only Unread toggle beside "+", **When** clicked, **Then** it toggles `listFilter === 'unread'` (the filter's only surface — no Unread pill exists), with `aria-pressed` reflecting the state.

---

### User Story 4 - Visual pass: contrast up, dividers down, tokened pills (Priority: P3)

Staff see a right panel and list header with clearer visual hierarchy — stronger surface contrast, fewer border lines — and filter pills whose selected state matches the house pattern instead of a one-off hex.

**Why this priority**: Polish on top of the structural work; smallest independent value.

**Independent Test**: Inspect pills: selected state uses the PipelinePage:100–102 token pairing, `aria-pressed` present, zero raw hex in the pill component.

**Acceptance Scenarios**:

1. **Given** any filter pill, **When** selected, **Then** its styling comes from the PipelinePage:100–102 pairing (`var(--g-acc-lt)` background, `var(--g-acc)` border) — the hardcoded `bg-[#243D2E] text-white` (InboxFilterPill.tsx:24) is gone — and `aria-pressed` reflects selection.
2. **Given** the flat view's pill row (InboxConversationList:281, shared `InboxFilterPillRow`), **When** it renders, **Then** it inherits the same styling (accepted inheritance; no flat-specific work).
3. **Given** the rebuilt panel and list header, **Then** styling uses gardens-* / `--g-*` tokens only; no new raw hex or ad-hoc colour classes.

---

### Edge Cases

- **All cards collapsed**: column shows four headers only; scroll container may be shorter than the panel — no layout collapse of column 3 (chain stays height-bound, audit C4).
- ~~Order created while Orders card is collapsed~~ STRUCK (ruled 2026-09-03, same false premise as the original FR-008): the flash is row-click-triggered inside the card body, which is unclickable when collapsed — the scenario cannot occur.
- **mutedCount drops to 0 while Hidden filter is active**: existing behavior (pill only renders when > 0, CustomerThreadList:142–148) is parity — do not change.
- **Unlinked conversation selected**: cards render their current no-person states (link CTA etc.) — parity; resolution state (:85–86) unaffected by the shell swap.
- **Right panel auto-open on zero orders** (page :240 `setRightCollapsed(count === 0)`): unchanged.
- **Very long Orders card**: History sits below the fold of the single column; collapse is the mitigation. Sticky card headers are geometry — approval-time.
- **Search debounce (C3)**: the 300 ms `debouncedSearchQuery` chain (:97–103, :250–256) is search-cycle territory; the shell cycle must not move or rewire it while restyling the search input's surroundings.

## Requirements *(mandatory)*

### Functional Requirements

**Shell**

- **FR-001**: Replace the shadcn Tabs shell in `PersonOrdersPanel.tsx` (:255–391: Tabs root, TabsList/triggers :261–307, four TabsContent :308–390) with one vertically scrolling column of four collapsible cards — Orders, Contact, Finance, History — using the existing shadcn Collapsible (`src/shared/components/ui/collapsible.tsx`, bare re-exports of `@radix-ui/react-collapsible ^1.1.0`). No Accordion exists in the repo and none is added.
- **FR-002 (host mount invariant)**: `PersonOrdersPanel` (or its successor) stays mounted across conversation selection and card collapse. Everything heavyweight remains in the host: queries :62–100, drawer state :93–96, drawers mounted outside the card containers :393–415, resolution state :85–86, refs :165–166, orders-count effect :111–119. `activeTab` (:95, `SidebarTab` :43) is replaced by per-card open state; no other host state changes.
- **FR-003 (mounted-but-hidden invariant)**: Card bodies use `forceMount` and are hidden when closed via a static class carrying `data-[state=closed]:hidden` — the direct transfer of the `PANEL_BODY_CLASSES` idiom (:47–48) and its AC-002 contract comment (:44–46, comment updated to describe the card contract). The class must add no display utility, so both the data-state variant and Radix's own `hidden` attribute stay effective on force-mounted content.
- **FR-004 (scroll ownership)**: The column container becomes the single scroll region (`flex-1 min-h-0 overflow-auto`); card bodies lose per-panel `overflow-auto`. Collapsed bodies contribute zero height (display:none satisfies this). The chain above is already height-bound to page :1359 (audit C4) — no PageShell contact. **Accepted behavior change**: per-tab scroll-position preservation (audit C2) ceases to exist as a concept; the column has one scroll position.
- **FR-005 (no height animation required)**: Open/close is specified as instant show/hide. The substrate tension is real, not stylistic: Radix animates via `--radix-collapsible-content-height`, and a force-mounted `display:none` body measures 0 — height animation and FR-003 conflict. Any animation is an approval-time ruling (C4c/C8/C9b/C9c precedent); it must not be bought by weakening FR-003.
- **FR-006 (Additional Options → Finance card, option (a))**: The itemized options block (OrderContextSummary:130–143 render, :89–100 data, fed by `useAdditionalOptionsByOrder(order.id)` :25) moves into the Finance card as a **per-order child component owning its own `useAdditionalOptionsByOrder` query** — audit A4's option (a). Why (a) over (b) batch hook: identical query key `['orders','additionalOptions',orderId]` (useOrders.ts:43) is TanStack-deduped against any other consumer, so no extra fetches; it reuses the established OrderContextSummary pattern; option (b) adds new API surface for zero fetch savings at live volumes. Consequence (true under either option, audit A4): the Finance card stops being purely presentational — accepted. The block leaves the Orders card (move, not copy).
- **FR-007 (card open state)**: Per-card open/closed state is host-local component state — unpersisted and not URL-addressable, matching the tabs' semantics (audit A3: "Nothing tab-related is persisted or URL-addressable"). Default: **all cards expanded** (R-002, ruled 2026-09-03 — the complaint was tabs hiding things; collapsed-by-default recreates it).
- **FR-008 (flash continuity — amended per plan Area 2, ruled 2026-09-03)**: The row-click flash + `scrollIntoView` (:355–363; triggered by clicking an already-selected or sole order row *inside* the Orders card body) continue to work against the single-column scroll container. **No auto-expand mechanism** — the trigger is unreachable while the card is collapsed (`display:none` body), so the original "order-created flash while collapsed" premise was false; `onOrderCreated` (:400) only selects the new order and never flashes.

**Controls** (customers view only; flat view exempt)

- **FR-009 ("+" relocation)**: The labeled New button (CustomerThreadList:189–196) is removed; an icon-only "+" with accessible name/title ("New conversation") renders at page level beside the list-collapse button (:1155–1160). This is a props/ownership change across the component boundary, not CSS: the page already owns `newConversationModalOpen` (:128) and the open handlers (:1186, :1217); `CustomerThreadList` loses `onNewClick`. `NewConversationModal` (:1069) and all prefill plumbing stay — the composer and empty-channel paths still call `onRequestNewConversation` (audit D1.2).
- **FR-010 (bulk selection dropped)**: Remove from the customers view: select-all checkbox (:163–175), per-row selection checkboxes (:291), "Customers · N new" header text (:176–186), bulk Delete (:197–206), bulk Read/Unread toggle (:207–225). Rationale amended (ruled 2026-09-03, per plan Area 1): **Delete** loses its only selection source with the checkboxes; the **Read/Unread toggle does NOT** — it keys off the active row via `customersMarkReadTargetIds`/`customersMarkUnreadTargetIds` (UnifiedInboxPage:671–684) and would survive mechanically. Its removal rests on R-001 alone. Page-level plumbing (`selectedCustomerRowKeys` :105, bulk-delete dialog state :106–107, `BulkDeleteConversationsDialog`, `markedReadIds`) is removed **only where the flat view does not consume it** — the flat list keeps its own parallel Delete/Read controls (exempt) and anything it shares stays. Consequences stated: (1) the unread-total readout ("N new") disappears from the customers view; (2) **deliberate capability removal, not an oversight** (R-001, ruled 2026-09-03): the toggle was the customers view's only manual mark-unread path. If Arin asks why mark-unread went, the answer is "ruled", not "it broke" — the toggle did not depend on the removed selection and its removal is a product decision. Recorded in docs/backlog.md ("restore as a per-row action if Arin misses it") and flagged for the next Arin call as a visible change.
- **FR-011 (filters)**: Remove Awaiting, Unlinked, and Unread from `FILTER_BUTTONS` (:20–26). Remaining row: **All, Customers** — All is the reset (R-004) — plus `Hidden (n)` when mutedCount > 0 (:142–148). The **Unread filter relocates** (R-001 + amendment, ruled 2026-09-03): it becomes the icon-only toggle beside "+" (FR-009), the single surface for `listFilter 'unread'`, with `aria-pressed` — the icon **replaces** the pill; two surfaces for one filter state is the clutter being removed. It is not the bulk Read/Unread action, which is removed under FR-010. Hidden STAYS (ruled 2026-09-02, supersedes the demotion ruling; the unmute-relocation backlog line is moot) — mutedCount plumbing (useCustomerThreads:118–139) and row Unmute (:387–401) untouched. Unlinked rows remain discoverable via their inline row tag. Fetch wiring unchanged: `unread` → `unread_only` at baseFilters (:250–256); `customers` stays client-side.
- **FR-012 (channel dropdown shrinks)**: The native `<select>` (:235–245) keeps its options and client-side group-filter behavior (useCustomerThreads:133) at a reduced footprint; the exact control form is an approval-time ruling.
- **FR-013 (preservation list)**: Unchanged and verified post-change: GHL source switch (:1090–1119, role=tab/aria-selected :1094/:1108); `?conversation` seed (:108–115) and customers-row deep-link resolver (~:590–605); `?view=flat` (useInboxView) and its full control stack; `?channel` derivation; both localStorage keys `inbox.desktop.leftCollapsed.v1.<uid>` / `rightCollapsed` (:168–171, persist :210–215); right-panel auto-open effect (:240); mute/unmute API (inboxConversations.api.ts:275–335); search input behavior incl. the C3 debounce chain.

**Visual**

- **FR-014 (pill pairing + semantics)**: `InboxFilterPill.tsx` selected state drops `bg-[#243D2E] text-white` (:24) for the PipelinePage:100–102 pairing — `background: var(--g-acc-lt)`, `1px solid var(--g-acc)` border (verified present at those lines). Selected text colour (R-003, ruled 2026-09-03 — use Finance's pill-text token, not a new one): **`var(--g-acc-dk)`** when selected, `var(--g-tx)` unselected — the Finance chip pattern at InvoiceWorkspace.tsx:650 and :671 (its comment cites the same PipelinePage:100–102 pairing). Add `aria-pressed={selected}` (:18–30 has no ARIA today, audit D5). Shared component: the restyle reaches the flat view's `InboxFilterPillRow` (InboxConversationList:281) by inheritance — accepted, no flat-specific work.
- **FR-015 (contrast/divider pass)**: Right panel and customers-list header get stronger surface contrast and fewer border dividers, using gardens-*/`--g-*` tokens only; no new raw hex. Specific class choices are approval-time (C4c precedent; docs/ux/tokens.md does not exist yet).

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Not touched — no routing changes; the `/dashboard/enquiry-triage` and `/dashboard/ghl-inbox` redirects (router.tsx:43–50, :77) are unaffected.
- **AC-002 (Module boundaries)**: All work stays in `src/modules/inbox/` except `InboxFilterPill` (already inbox-owned) and the page header; no deep-imports added; nothing promoted to `src/shared/`.
- **AC-003 (RLS as boundary)**: No data-layer changes; all reads remain org-guarded at the query layer as today.
- **AC-004 (baseline quarantine)**: Nothing under `specs/inbox-sidebar-multi-tabs/` may be touched, relocated, or cleaned up — `scripts/gate-tsc.mjs:14` reads the repo tsc baseline from inside it (audit D4). This feature partially reverses that feature; the reversal is code-only.
- **AC-005 (baseline line-shift)**: Verified 2026-09-03 — no `tsc-baseline-items.txt` entry lives in any file this feature touches (PersonOrdersPanel, UnifiedInboxPage, CustomerThreadList, OrderContextSummary, InboxFilterPill, InboxConversationList, the three tab components). No re-anchoring expected; re-check per edited file at implementation time.
- **AC-006 (search-cycle territory)**: `inboxConversations.api.ts`, the RPC, and the debounce chain are the shipped search cycle's; this feature reads them but changes none of them. The four client-side name predicates and the tokenised-vs-client divergence are ruled — not "fixed" here.

### Key Entities

None — UI-only. No schema, API, or query-key changes; the one query that moves (`useAdditionalOptionsByOrder`) keeps its existing key and hook.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff member can see Orders and Finance content simultaneously in the right panel (0 tab/card switches needed; impossible pre-change).
- **SC-002**: Toggling any card open/closed triggers **zero** network requests (browser network panel, staging, named record) and preserves any open drawer's typed input.
- **SC-003**: Selecting a different conversation does not remount the panel host (no full-panel spinner flash; React DevTools or log-once check at verify time).
- **SC-004**: Customers-view header control count drops from 8 (audit D1 inventory) to ≤ 4 groups: icon cluster (Unread toggle, "+", collapse), pill row, channel control, search. Bulk-selection UI count: 0.
- **SC-005**: `?conversation` deep link, `?view=flat`, `?channel`, GHL switch, and both collapse keys behave identically pre/post (manual pass on staging, each named).
- **SC-006**: Every pill exposes `aria-pressed`; selected pills contain zero hardcoded hex (`grep -c '#243D2E' src/modules/inbox` = 0 post-change).
- **SC-007**: Gates on the branch: tsc item-diff 54/54 with 0 new items, lint ≤ 8 errors / ≤ 19 warnings (no new), existing tests green (Giorgi's runs are the gate).
- **SC-008**: Finance card shows itemized additional options for an order that has them, and the Orders card no longer does (same named staging record for both checks).

## Assumptions

- **A-1**: The four panel bodies (inline Orders JSX, InboxContactTab, InboxFinancesTab, InboxHistoryTab) keep their internal content unchanged except the FR-006 move — this is a container swap (audit A2: panels are presentational and own nothing; the Finance card gains the one per-order child).
- **A-2**: ~~Assumption~~ RULED (R-002): all four cards default to expanded on mount.
- **A-3**: ~~Assumption~~ RULED (R-004 + R-001 amendment): the "All" pill stays; Awaiting and Unlinked are removed and Unread relocates to the icon beside "+", leaving the row All/Customers (+Hidden when muted).
- **A-4**: ~~Assumption~~ MOOT (FR-008 amendment, ruled 2026-09-03): no auto-expand exists to assume about; the flash trigger lives inside the card body.
- **A-5**: Card collapse state is intentionally not persisted (parity with tabs). If Giorgi wants persistence later, the two existing localStorage collapse keys are the naming precedent — out of scope now.
- **A-6**: "More contrast, fewer dividing lines" (FR-015) is bounded to the inbox right panel and customers-list header; nothing PageShell/sidebar-owned (spun out, ~28 routes).
- **A-7**: Browser verification happens on staging (or Playwright MCP) against a specific named SM record before commit, per gate rules; no DB writes are needed anywhere in this feature.

## Rulings & Flagged Tensions *(all six flags ruled by Giorgi, 2026-09-03)*

- **R-001 — RULED: accept the loss.** The icon-only control beside "+" is the **Unread FILTER** (wired per FR-011). Bulk selection goes, and manual mark-unread goes with it from the customers view — a deliberate capability removal, not an oversight (flat view keeps its own controls). Recorded in docs/backlog.md with a restore path (per-row action if Arin misses it) and flagged for the next Arin call as a visible change. **Amendment (ruled 2026-09-03, second pass): the icon REPLACES the Unread pill** — one surface per filter; two surfaces is the clutter being removed.
- **R-002 — RULED**: all cards default expanded. The complaint was tabs hiding things; collapsed-by-default recreates it. (FR-007.)
- **R-003 — RULED**: selected-pill text uses Finance's existing pill-text token — `var(--g-acc-dk)` selected / `var(--g-tx)` unselected (InvoiceWorkspace.tsx:650, :671) — not a newly invented one. (FR-014.)
- **R-004 — RULED**: "All" pill stays; All is the reset. With the R-001 amendment relocating Unread to the icon, the pill row is All/Customers (+Hidden when muted). (FR-011.)
- **R-005 (recorded, not contested)**: Animation/geometry (card header affordance, chevron, sticky headers, any transition) remains deferred to approval per C4c/C8/C9b/C9c precedent; FR-005 states the behavioral floor.
- **T-1 — RULED: accepted loss, stated plainly.** Per-tab scroll positions cease to exist; one column means one scroll position by construction. (FR-004.)
- **T-2 — RULED**: the flat-view exemption means "no flat-specific work", not "flat is untouched". Shared component, shared restyle, no extra effort, no prop. The InboxFilterPill restyle reaching `InboxConversationList:281` is by design, not a violation. (FR-014.)
- **T-3 — SETTLED (plan Area 1, grep-verified 2026-09-03)**: the flat view consumes `markedReadIds` (stays) but **not** `BulkDeleteConversationsDialog` or its state — flat deletes via `window.confirm` + `deleteMutation`, so the dialog, its two state vars, and the component file are all removable with the customers-view bulk UI. Per-symbol map in plan.md.
