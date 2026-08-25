# Phase 0 Research — Inbox Sidebar Multi-Tabs

**Branch**: `feature/inbox-sidebar-multi-tabs` | **Date**: 2026-08-25
**Spec**: `specs/inbox-sidebar-multi-tabs/spec.md` | Ground truth: read-only audit of 2026-08-25
(line numbers verified against `staging` @ `f7449dd`).

## R1. Tab primitive — shadcn Tabs already exists

`src/shared/components/ui/tabs.tsx` exists (Radix `@radix-ui/react-tabs` wrapper exporting
`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`). **No new UI file is needed** — plan-time
directive 2's "add the primitive" branch is moot; no extra commit-plan line.

Two call-site adjustments are required (className overrides only — the primitive file is not
edited):

- **Token mismatch vs contrast pass**: the primitive styles `TabsList` with `bg-muted` and
  the active trigger with `data-[state=active]:bg-background` (`tabs.tsx:15, :30`). FR-010
  forbids bare `--background` surfaces in this panel. The call site overrides with gardens-*
  classes via the `className` prop (`cn` merge, standard shadcn pattern).
- **`TabsContent` default `mt-2`** (`tabs.tsx:45`) must be neutralized (`mt-0`) so the four
  panels align identically with the current body's spacing.

## R2. Radix forceMount + class-hiding semantics (AC-002)

- Radix `Tabs.Content` **unmounts inactive content by default**. With `forceMount`, the node
  stays mounted, carries `data-state="inactive"`, and Radix also sets the HTML `hidden`
  attribute on non-selected content.
- AC-002 requires class-based hiding, and the `hidden` attribute alone is fragile: any
  explicit `display` utility on the same element (e.g. `flex`) overrides the attribute's
  `display: none`. Decision:
  1. Every `TabsContent` gets `forceMount` + `data-[state=inactive]:hidden` in className.
  2. **No display-setting utility** (`flex`, `grid`, `block`) is placed on `TabsContent`
     itself — its layout classes are limited to `flex-1 min-h-0 overflow-auto scrollbar-hide`
     plus padding/spacing, none of which set `display`. Both the attribute and the class then
     hide reliably, and effects/refs in hidden panels keep running (C2/C4).
- `Tabs` (Root) renders a plain div; giving it `flex-1 min-h-0 flex flex-col` slots it into
  the panel's existing flex column exactly where the single body div sits today.
- Keyboard nav (arrow keys on the trigger list) is Radix default — preserved for free (FR-008).

## R3. Render structure — both returns (directive 5)

`PersonOrdersPanel.tsx` has two returns; the plan accounts for both explicitly:

- **Early return `:227-237`** (`!personId && !effectiveJob`): untouched, byte-for-byte. It
  renders before any tab structure exists — no strip, no Tabs root (C3). The new
  `activeTab` useState is declared with the other hooks above both returns, so hook order is
  identical on both paths (C1).
- **Main return `:239-348`**: root div and header block (`:240-257`) unchanged. The single
  body div (`:259`) is replaced by:
  `Tabs root → TabsList (strip) → 4 × TabsContent (forceMount)`. The Orders `TabsContent`
  receives the current body's exact classes (`flex-1 min-h-0 overflow-auto scrollbar-hide
  px-3 py-3 space-y-3` + `mt-0 data-[state=inactive]:hidden`) and the current body's
  children verbatim (`:260-327` ternary: skeleton / error / empty / summary+lists). The
  drawers (`:330-346`) stay siblings of the Tabs root inside the panel root div (C5).

## R4. C6 — collapse-button clearance

The page-level collapse button (`UnifiedInboxPage.tsx:1355-1369`) is absolutely positioned
`top-2 left-2 z-10` over the panel. The current header row already coexists with it. Decision:
**the tab strip renders as a new row below the existing header block**, full-width under the
`border-b` — it never enters the button's overlay zone, and the header (which carries the
close X and the count) is unchanged. No edit to `UnifiedInboxPage` (AC-008).

Consequence for "pixel-equivalent": the strip adds one row of vertical space above the body —
inherent to the feature. "Pixel-equivalent" is interpreted as: the Orders tab's *content* is
unchanged; the only diff versus `staging` is the strip row itself.

## R5. Stage display for History (approved assumption b)

No `StageBadge` component exists anywhere in `src/modules/jobsPipeline` (verified by grep).
Stage text comes from `formatStageLabel` (`utils/display.ts:53-56`), which **is**
barrel-exported (`jobsPipeline/index.ts:6`), as is `type JobStage` (`index.ts:7`). History
renders `formatStageLabel(job.stage)` inside the panel's existing chip vocabulary — the same
classes as the order-type chip (`InboxOrderSummaryCard.tsx:65-67`:
`text-[11px] font-medium text-gardens-txs px-2 py-0.5 rounded-md bg-gardens-page`) or the
shadcn `Badge` `secondary` variant already used in this panel (`OrderContextSummary.tsx:69`).
Chosen: the chip classes (closer visual kin to the pipeline hint chip). No new color/stage
vocabulary.

## R6. Job type for History props

`ConversationJobSummary` is deliberately **not** barrel-exported (see the structural-subset
precedent at `jobPickerLabels.ts:6-13`, whose `PickerJob` omits `paid_at`). History needs
`paid_at`, so the tab component defines its own structural interface (id, stage, exit_reason,
paid_at, created_at) in its own file — same established pattern, no new export from
`jobsPipeline`, no deep import of its types file.

## R7. Date formatting for History (approved assumption g resolved)

Chosen: `formatDateDMY` (`src/shared/lib/formatters.ts:43-50`) — it is what the panel already
uses for order dates (`PersonOrdersPanel.tsx:185, :302`), keeping one date format inside the
sidebar. The pipeline's `formatShortDate` is not barrel-exported and would either need a
barrel addition or a deep import; rejected on both counts.

## R8. Finances computation shape (approved assumptions c, d)

- Order set = the panel's displayed set: `jobOrders` (job-scoped) + `unassignedOrders`
  (orphans) — same universe as the Orders tab.
- Per-order figures: exclusively `getOrderBaseValue` / `getOrderPermitCost` /
  `getOrderAdditionalOptionsTotal` / `getOrderTotal` (`orderCalculations.ts:17-54`), formatted
  by `formatGbpDecimal` (`formatters.ts:15-23`).
- Grand total: `orders.reduce((sum, o) => sum + getOrderTotal(o), 0)` — the one permitted
  summation of helper outputs. No `parseFloat`, no field access arithmetic in components.
- Note the existing hand-rolled duplicate in `OrderContextSummary.tsx:56` stays as-is (Orders
  tab content is verbatim; SC-004 holds because both derive from the same three helpers).

## R9. Contact tab data nuances

- `person` comes from the panel's existing `useCustomer(effectivePersonId ?? '')`
  (`PersonOrdersPanel.tsx:76`); `effectivePersonId = personId ?? resolvedPersonId` (`:75`),
  so after an S5 resolution the Contact tab correctly starts showing the newly linked person
  with zero new fetch paths.
- Three render states must be distinguishable: (a) no linked person → empty state; (b) linked
  person, query still loading → skeleton (not the empty state — avoids a "no linked contact"
  flash); (c) person loaded → rows. The component therefore receives both the person object
  and a `hasLinkedPerson` boolean, not just the person.
- `is_customer` / `created_at` are typed on the `Customer` interface (`useCustomers.ts:6-19`);
  all Contact fields are typed — no `select *` stragglers used (FR-003).

## R10. Lint/tsc prediction basis (directive 1)

- tsc gate: `npx tsc -p tsconfig.app.json --noEmit` — baseline **54 errors** (2026-08-25),
  0 new allowed. (Bare `npx tsc --noEmit` checks nothing — solution tsconfig.)
- Lint baseline corrected per directive: **10 errors / 19 warnings** (16→19 accepted 25 Aug,
  three `react-refresh/only-export-components` warnings from status-cell vocabulary exports).
  All predictions computed against 19.
- New tab-body files export exactly one React component each (props interfaces are type-only
  exports, which `react-refresh/only-export-components` ignores) → predicted **0 new
  warnings, 0 new errors** in every commit.

## Alternatives considered

| Decision | Alternative | Rejected because |
|---|---|---|
| Reuse `ui/tabs.tsx` | Hand-rolled button strip + className toggling | Loses free Radix a11y/arrow-key nav (FR-008); more code to review |
| Strip below header | Strip inside header row | Collides with the page-level collapse overlay (C6) and squeezes the close X |
| `formatDateDMY` | `formatShortDate` (pipeline) | Not barrel-exported; would add public surface or a deep import for a cosmetic difference |
| Structural job type in tab file | Barrel-export `ConversationJobSummary` | New public surface on `jobsPipeline` for a read-only display; existing precedent (`PickerJob`) says structural subset |
| Chip classes for stage | New `StageBadge` shared component | Spec forbids a parallel badge vocabulary; nothing to share yet |

---

## Post-T020 note (2026-08-26)

**R3** ("root div and header block unchanged") and **R4** (the strip-below-header C6
clearance decision) are superseded by commit `c99fc76`: the header row and the page-level
collapse button were both removed — the strip is now the panel's top row with a right-edge
collapse control, and no clearance is needed. R1, R2, and R5–R10 stand as shipped.
