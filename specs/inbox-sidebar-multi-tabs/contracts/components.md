# Component Contracts — Inbox Sidebar Multi-Tabs

Rule (plan directive 3): new components exist ONLY for new content (Contact / Finances /
History bodies). They are pure presentational — **props in, JSX out; they call no data hooks**
(`useNavigate`/`useQuery`/`useCustomer`/etc. all forbidden inside them). All hooks, state,
refs, and drawers remain in `PersonOrdersPanel`.

## Modified: `PersonOrdersPanel` (`src/modules/inbox/components/PersonOrdersPanel.tsx`)

Props: **unchanged** (`personId`, `conversationIds`, `selectedJobId`, `selectedOrderId`,
`onSelectOrder`, `onCloseOrder`, `onOrdersCountChange`).

Internal additions:
- `const [activeTab, setActiveTab] = useState<SidebarTab>('orders')` and
  `const [editDrawerOpen, setEditDrawerOpen] = useState(false)` — declared with the
  existing hooks, above both returns.
- Imports: `Tabs, TabsList, TabsTrigger, TabsContent` from `@/shared/components/ui/tabs`;
  lucide `User, PoundSterling, Clock, PanelRightClose` (the header's `X` left with the
  header, c99fc76); the three new tab components; `EditCustomerDrawer` from the
  `@/modules/customers` barrel (c55a055).

Render structure (both returns):

```text
if (!personId && !effectiveJob)  → EARLY RETURN :227-237, byte-identical, NO tabs (C3)

main return:
<div root>                                       // unchanged
  <Tabs value={activeTab} onValueChange={…} className="flex-1 min-h-0 flex flex-col">
    <div className="…strip row: flex, border-b border-gardens-bdr, px-2 py-1.5…">  // top row of the panel
      <TabsList className="…flex-1 min-w-0, bg-transparent, p-0…">
        4 × TabsTrigger (`group`, `title` tooltip) — icon always visible; label in the DOM
        on every trigger but sr-only unless active (group-data-[state=active]:not-sr-only +
        group-data-[state=active]:truncate); the Orders trigger also renders the order
        count when jobOrders.length > 0
      </TabsList>
      <button PanelRightClose onClick={onCloseOrder} …/>   // single collapse control (c99fc76)
    </div>
    <TabsContent value="orders"   forceMount className={PANEL_BODY_CLASSES}>
      …current body children :260-327 moved verbatim (skeleton/error/empty ternary,
       summaryRef div + OrderContextSummary, jobAction, orders list, unassignedSection)…
    </TabsContent>
    <TabsContent value="contact"  forceMount className={PANEL_BODY_CLASSES}>
      <InboxContactTab … onEdit />
    </TabsContent>
    <TabsContent value="finances" forceMount className={PANEL_BODY_CLASSES}>
      <InboxFinancesTab … />
    </TabsContent>
    <TabsContent value="history"  forceMount className={PANEL_BODY_CLASSES}>
      <InboxHistoryTab … />
    </TabsContent>
  </Tabs>
  <CreateOrderDrawer … />    // unchanged, sibling of Tabs (C5)
  <CreateInvoiceDrawer … />  // unchanged, sibling of Tabs (C5)
  <EditCustomerDrawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}
    customer={person ?? null} />                // sibling of Tabs (C5), added c55a055
</div>
```

`PANEL_BODY_CLASSES` (shared by all four TabsContent — FR-009, AC-002):
`"flex-1 min-h-0 overflow-auto scrollbar-hide px-3 py-3 space-y-3 mt-0
data-[state=inactive]:hidden"` — identical to the current body's classes (`:259`) plus the
`mt-0` reset and the class-based hide. No display-setting utility on TabsContent (see
research R2).

Invariants restated: every `TabsContent` has `forceMount` (AC-002); hook order and all logic
`:47-105` untouched (C1); orders-count effect untouched (C4); `jobsQuery.data` is the single
source for History.

## New: `InboxContactTab` (`src/modules/inbox/components/InboxContactTab.tsx`)

```ts
interface InboxContactTabProps {
  /** True when the selection resolves to a person (effectivePersonId != null). */
  hasLinkedPerson: boolean;
  /** The panel's existing useCustomer result; undefined while loading or when unlinked. */
  person: Customer | undefined;   // type import from '@/modules/customers/hooks/useCustomers'
  /** Opens the shared EditCustomerDrawer; the Edit button renders only with a loaded person. */
  onEdit?: () => void;
}
```

Behaviour:
- `!hasLinkedPerson` → empty state: `User` icon + one line ("No linked contact for this
  conversation" tone matching `:270-274`).
- `hasLinkedPerson && !person` → skeleton rows (loading; never the empty state).
- `person` → definition-list rows: Name (`first_name last_name`, em dash if both blank),
  Email as `mailto:` link, Phone as `tel:` link, Address, City, Country, Status
  (`is_customer` → "Customer" / "Contact"), Customer since (`formatDateDMY(created_at)`).
  Absent nullable values render an em dash. Row styling: label `text-[11px] text-gardens-txs`
  left, value `text-[11px] font-medium text-gardens-tx` right — the exact row idiom of
  `InboxOrderSummaryCard` items, inside a card surface matching the summary card
  (`rounded-xl border border-gardens-bdr bg-white/90 p-3.5`).

## New: `InboxFinancesTab` (`src/modules/inbox/components/InboxFinancesTab.tsx`)

```ts
interface InboxFinancesTabProps {
  /** Displayed set: jobOrders + unassignedOrders, panel's existing arrays. */
  orders: Order[];
  isLoading: boolean;
}
```

Behaviour:
- `isLoading` → skeletons; `orders.length === 0` → empty state (`PoundSterling` icon + one
  line).
- Per order, a card/section headed by `getOrderDisplayId(order)` +
  `formatOrderTypeLabel(order.order_type)`, with rows: Base value, Permit cost, Additional
  options, Order total — each `formatGbpDecimal(helper(order))`; zero-value rows may render
  em dash or be shown at £0.00, but the Total row always renders.
- Footer row: **Grand total** = `formatGbpDecimal(orders.reduce((s, o) => s + getOrderTotal(o), 0))`.
- Hard rules: only the four calculation helpers + `formatGbpDecimal`; no `parseFloat`; no
  field arithmetic; no pence anywhere; no invoice data.

## New: `InboxHistoryTab` (`src/modules/inbox/components/InboxHistoryTab.tsx`)

```ts
/** Structural subset of jobsPipeline's ConversationJobSummary (type not barrel-exported). */
export interface SidebarHistoryJob {   // type-only export — lint-safe
  id: string;
  stage: JobStage;
  exit_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

interface InboxHistoryTabProps {
  /** jobsQuery.data verbatim: undefined = probe unresolved, [] = resolved-empty. */
  jobs: SidebarHistoryJob[] | undefined;
}
```

Behaviour:
- `undefined` → skeletons (probe unresolved); `[]` → empty state (`Clock` icon + one line).
- Rows in input order (already newest-first — no re-sort). Per job: "Created
  `formatDateDMY(created_at)`", stage chip (`formatStageLabel(stage)` in the existing chip
  classes — `text-[11px] font-medium text-gardens-txs px-2 py-0.5 rounded-md bg-gardens-page`),
  "Paid `formatDateDMY(paid_at)`" when present, and when exited a muted line with the
  `exit_reason` value.
- Copy constraints (FR-005/SC-005): it is a list of jobs with dates. Forbidden words in this
  tab's UI copy: "timeline", "activity", "moved", "history of changes", or any event-log
  phrasing. The tab label "History" itself is the approved scope.

## Explicitly NOT in contracts

- No changes to `CustomerConversationView`, `OrderContextSummary`, `InboxOrderListRow`,
  `InboxOrderSummaryCard`, `ui/tabs.tsx`, or any hook/api file. `UnifiedInboxPage` carries
  exactly one authorized deviation (commit `c99fc76`): the floating collapse-button block
  and its then-unused `PanelRightClose` import were removed.
- No new exports from any module barrel.
- No Product tab component, stub, or reserved trigger.
