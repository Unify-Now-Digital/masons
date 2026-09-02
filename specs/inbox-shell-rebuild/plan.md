# Implementation Plan: Inbox Right-Panel Shell Rebuild + Top-Bar Control Reduction

**Branch**: `feature/inbox-shell-rebuild` | **Date**: 2026-09-03 | **Spec**: `specs/inbox-shell-rebuild/spec.md` (at `3aae85e`)
**Input**: Feature specification + `docs/ux/inbox.md` (audit; line-drift table in the spec header). Written directly — `/plan`'s `setup-plan.sh` does not exist (docs/backlog.md).

**Planning tripwire: 2/3** — two prediction misses during investigation, both recorded in *Findings from planning* below. Heightened caution applies to implementation: predictions per commit, tight verification.

## Summary

Replace the four-tab Radix Tabs shell in `PersonOrdersPanel.tsx` (:255–391) with one scrolling column of four force-mounted collapsible cards (Orders, Contact, Finance, History) using the existing unstyled shadcn/Radix Collapsible; move the Additional Options itemization into the Finance card as a per-order child owning its own query (spec FR-006, option (a)); remove the customers-view bulk-selection apparatus and two filter pills, relocate "+" and the Unread filter as icon-only controls beside the list-collapse button; retoken the filter pills to the Finance/Pipeline selected pairing with `aria-pressed`. Five commits, three independently shippable. No data-layer, routing, or schema work.

## Technical Context

**Language/Version**: TypeScript ~5.x, React 18, Vite 5.4 (SWC)
**Primary Dependencies**: `@radix-ui/react-collapsible` ^1.1.0 (already installed; bare re-exports at `src/shared/components/ui/collapsible.tsx`), `@radix-ui/react-tabs` ^1.1.0 (being removed from this component), TanStack Query, Tailwind (gardens-* utilities) + `--g-*` CSS variables
**Storage**: N/A — no schema/API changes; the one moved query (`useAdditionalOptionsByOrder`, key `['orders','additionalOptions',orderId]`) keeps its hook and key
**Testing**: gates (`npm run gate`: tsc item-diff 54/54, lint ≤8/≤19, vitest) + browser verify on staging against a named SM record per UI commit (Giorgi runs gates)
**Target Platform**: staging web app (https://staging.unifynow.digital), desktop-first (`hidden lg:flex` column 3)
**Project Type**: web SPA, single project
**Performance Goals**: no new fetches — card toggle is zero-network (spec SC-002); no change to query counts
**Constraints**: host stays mounted (FR-002); card bodies mounted-but-hidden via `data-[state=closed]:hidden` static class (FR-003); no height animation (FR-005); nothing under `specs/inbox-sidebar-multi-tabs/` (AC-004); flat view inherits shared-component changes only (T-2)
**Scale/Scope**: ~6 files edited, 1 file deleted, 1 small component added; all inside `src/modules/inbox/`

## Constitution Check

- **Dual router constraint**: PASS — no routing/navigation changes; redirects at router.tsx:43–50/:77 untouched.
- **Module boundaries**: PASS — every edit is inside `src/modules/inbox/`. The Finance-token alignment copies a style idiom (CSS variables), not an import; no cross-feature deep imports added.
- **Supabase + RLS**: PASS — no new or changed data access. All existing reads stay org-guarded at the query layer.
- **Secrets**: N/A — no edge functions, no privileged operations.
- **Additive-first**: two deliberate removals, both UI-layer and revertable by `git revert`: (1) the customers-view bulk-selection surface incl. deleting `BulkDeleteConversationsDialog.tsx` (verified sole importer: UnifiedInboxPage:12); (2) manual mark-unread from the customers view (R-001 accepted loss; backlog line + Arin flag recorded). Rollback = revert the C3a commit.

## Project Structure

### Documentation (this feature)

```text
specs/inbox-shell-rebuild/
├── spec.md              # done (3aae85e)
├── plan.md              # this file
└── tasks.md             # next (/tasks — note: check-prerequisites.sh is also missing; expect improvisation)
```

`research.md`, `data-model.md`, `contracts/`, `quickstart.md`: intentionally skipped — UI-only feature, no data model, no API surface; the research answers live in this plan's *Settled questions*.

### Source Code (repository root)

```text
src/modules/inbox/
├── pages/UnifiedInboxPage.tsx           # C3a removals, C3b icon controls (1406 lines today)
├── components/
│   ├── PersonOrdersPanel.tsx            # C1 shell swap (only file in C1)
│   ├── OrderContextSummary.tsx          # C2: itemized block leaves (:130–143, :89–100)
│   ├── InboxFinancesTab.tsx             # C2: renders the new per-order child
│   ├── InboxOrderOptionsList.tsx        # C2: NEW — per-order child, owns useAdditionalOptionsByOrder (name at approval)
│   ├── CustomerThreadList.tsx           # C3a removals, C3b header changes
│   ├── BulkDeleteConversationsDialog.tsx# C3a: DELETED (sole importer removed)
│   ├── InboxFilterPill.tsx              # C4 retoken + aria-pressed
│   ├── InboxContactTab.tsx              # C4 only if divider/contrast classes change; otherwise untouched
│   └── InboxHistoryTab.tsx              # C4 only if divider/contrast classes change; otherwise untouched
```

**Structure Decision**: single project, feature-internal edits only. The new per-order options child lives beside the tab components in `src/modules/inbox/components/`; it consumes the existing `@/modules/orders` hook exactly as `OrderContextSummary` already does (established cross-module import, not a new boundary crossing).

## Complexity Tracking

No constitution violations. Table intentionally empty.

---

## Settled questions (investigated 2026-09-03, per-area predictions → reads → tally)

### 1. T-3 / FR-010 carve-out — what the flat view actually shares (Area 1; 1 miss)

Per-symbol consumer map, grep-verified in `UnifiedInboxPage.tsx`:

| Symbol | Consumers | Verdict |
|---|---|---|
| `selectedItems` (:104) | flat only — `toggleTargetIds` :664–669, `handleToggleReadUnread` flat branch :893–896, `handleDelete` :899–900, view-switch clear :917, `toggleSelection` :1004, InboxConversationList props :1177/:1190 | **stays** |
| `selectedCustomerRowKeys` (:105) | customers only — :519–520, prune effect :656–662, `toggleCustomerRowSelection` :929–937, `handleToggleSelectAllCustomerRows` :939–964, reset :988, CustomerThreadList props :1235–1240 | **remove (C3a)** |
| `bulkDeleteDialogOpen` / `bulkDeleteConversationIds` (:106–107) | customers only — fed solely by `handleDeleteCustomersRows` :966–978; consumed by `handleConfirmBulkDelete` :980–1001 and dialog JSX :1080–1086 | **remove (C3a)** |
| `BulkDeleteConversationsDialog` (import :12, JSX :1080) | sole importer is this page; **the flat view's Delete never used it** — flat deletes via `handleDelete` (`window.confirm` + `deleteMutation`, :898–925) | **remove + delete file (C3a)** |
| `markedReadIds` (:137) | shared — display memos :291–302 feed both views; setters: customers auto-read :637, flat auto-read :756, shared toggle handler :881 | **stays** |
| `customersMarkReadTargetIds` / `customersMarkUnreadTargetIds` (:671–684) + customers branches of `handleToggleReadUnread` (:855–896) and `anyToggleTargetUnread` (:685–691) | customers R/U toggle only | **remove (C3a)** |
| `userForcedUnreadIds` ref | auto-read guard (customers effect :624–647) + flat unread branch | **stays** — customers entries simply stop being written; guard inert there, load-bearing for flat |

**Removal does NOT touch flat-view wiring.** The customers-view removal is clean: every removed symbol is customers-only. The one cross-touch is cosmetic — `handleConfirmBulkDelete`'s `setSelectedItems([])` (:987) dies with its handler; `selectedItems` itself is untouched. Post-removal dead-constant check: `MAX_BULK_DELETE_CONVERSATIONS` (page) and `MAX_BULK_SELECTION` (CustomerThreadList:156) — delete if orphaned, verify with grep at implementation.

**Premise correction (finding, reported plainly)**: the customers-view Read/Unread toggle **never used checkbox selection**. It targets the *active* row via `selectedCustomersRow` (`customersMarkReadTargetIds` = all row conversation ids; mark-unread = latest conversation only, :678–684). The scope's and audit D1's "bulk Delete and Read/Unread lose their only selection source" is half-right: true for Delete, false for the R/U toggle, which would survive bulk-selection removal mechanically. Its removal therefore rests **entirely on the R-001 ruling** (accepted capability loss) — which stands; nothing changes in scope, but the spec's FR-010 rationale sentence deserves a one-line amendment at commit time.

### 2. FR-008 mechanism (Area 2; 1 miss — FR-008's premise dissolves)

`summaryFlash` has exactly one trigger: clicking an already-selected (or sole) order row **inside the Orders panel body** (PersonOrdersPanel:355–363 — inline `scrollIntoView` + `setSummaryFlash(true)` + 900 ms clear). `onOrderCreated={onSelectOrder}` (:400) only selects the new order; **no flash fires on order creation**. Since the trigger lives inside the card body, and a collapsed body is `display:none` and unclickable, "flash fires while the Orders card is collapsed" is impossible by construction.

**Consequence — flagged for ruling, not silently resolved**: FR-008 and edge case #2 rest on a false premise ("order-created flash"). No auto-expand mechanism is needed or should be built. Proposed spec amendment: reduce FR-008 to "the row-click flash + `scrollIntoView` continue to work against the single column scroll container" (the inline call already does — `scrollIntoView` scrolls the nearest scrollable ancestor, which becomes the column). Giorgi rules; C1 implements whichever text stands.

### 3. Commit split (Area 3; prediction held — dialog file deletable)

| Commit | Files | FRs | Ships independently? |
|---|---|---|---|
| **C1 — shell swap** (US1) | `PersonOrdersPanel.tsx` only | FR-001, 002, 003, 004, 005, 007 (+ FR-008 as amended) | **Yes** — pure container swap; tab bodies untouched |
| **C2 — options move** (US2) | `OrderContextSummary.tsx`, `InboxFinancesTab.tsx`, new `InboxOrderOptionsList.tsx` | FR-006 | After C1 (ruled destination is the Finance *card*); mechanically independent of C3/C4 |
| **C3a — bulk removal** (US3) | `UnifiedInboxPage.tsx`, `CustomerThreadList.tsx`, delete `BulkDeleteConversationsDialog.tsx` | FR-010; FR-011 removals (Awaiting/Unlinked/Unread pills, header text) | **Yes** — pure removal per the Area-1 map; no flat-view contact |
| **C3b — icon controls** (US3) | `UnifiedInboxPage.tsx`, `CustomerThreadList.tsx` | FR-009 ("+" relocation), FR-011 Unread icon, FR-012 channel shrink | After C3a (same header real estate) |
| **C4 — visual pass** (US4) | `InboxFilterPill.tsx` + card/header surfaces (possibly `InboxContactTab.tsx`/`InboxHistoryTab.tsx` classes) | FR-014, FR-015 | Pill retoken: yes. Divider/contrast pass on cards: after C1. Land as one commit after C1 |

FR-013 (preservation list) is not a commit — it is the browser-verify checklist run at C1, C3a, and C3b (the commits touching its surfaces): GHL switch, `?conversation` + resolver, `?view=flat`, `?channel`, both localStorage keys, auto-open effect (:240), mute/unmute, search + debounce chain.

Sequence: **C1 → C2 → C3a → C3b → C4**. If priorities shift, C3a can land before C1 with zero conflict (disjoint files except none). Each commit gate-green and browser-verified against a named SM record before Giorgi commits.

### 4. Per-commit baseline plan (Area 4; prediction held 9/9)

Verified per file on 2026-09-03 (`grep -c <name> specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt`): **0 items** in each of PersonOrdersPanel, UnifiedInboxPage, CustomerThreadList, OrderContextSummary, InboxFilterPill, InboxFinancesTab, InboxContactTab, InboxHistoryTab, BulkDeleteConversationsDialog. No baseline re-anchoring is expected in any commit; the item-diff must stay 54/54 with 0 NEW at every gate. If any commit unexpectedly shifts baseline keys, that is a tripwire surprise — stop and re-check before proceeding (memory: item keys are `file(line,col)`).

## Findings from planning (tripwire record)

- **Miss 1 (Area 1)**: predicted `BulkDeleteConversationsDialog` + its state were shared by both views; actually customers-only — flat deletes via `window.confirm`. Effect: C3a is *simpler* than planned (file deletable).
- **Miss 2 (Area 2)**: predicted the flash was order-created and needed auto-expand; actually row-click-triggered inside the card body — FR-008 dissolves into a no-op plus a spec amendment.
- **Finding (no prediction stated)**: customers R/U toggle keys off the active row, not checkbox selection — FR-010's "only selection source" rationale is wrong for the toggle; removal stands on R-001 alone.
- Both misses shrink scope rather than grow it; neither changes the ruled outcomes. Tripwire enters implementation at 2/3 — one more surprise means propose stopping.
- **Amendments applied (ruled 2026-09-03)**: both spec amendments proposed above are now in the spec — FR-008 reduced to row-click flash/scroll continuity with no auto-expand (edge case #2 struck, A-4 moot), and FR-010's rationale corrected (Delete loses its selection source; the R/U toggle does not and is removed on R-001 alone). Spec and plan agree; the spec pointer `3aae85e` in this header predates the amendment commit.
