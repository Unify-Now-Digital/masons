# Data Model — Inbox Sidebar Multi-Tabs

**No new queries, hooks, query keys, tables, or fields.** Every entity below is already
fetched by `PersonOrdersPanel`'s existing hooks; this feature only re-presents them.

## Entities consumed (read-only)

### Person (Customer)
- Source: `useCustomer(effectivePersonId ?? '')` — `PersonOrdersPanel.tsx:76`; key
  `['customers', id, organizationId]`; disabled when no id/org.
- Typed fields used by Contact (`src/modules/customers/hooks/useCustomers.ts:6-19`):
  `first_name`, `last_name`, `email` (nullable), `phone` (nullable), `address` (nullable),
  `city` (nullable), `country` (nullable), `is_customer` (boolean), `created_at` (ISO string).
- Untyped `select *` columns: out of scope by spec.

### Order
- Source: `useOrdersByPersonId(personId)` (`:50`) and `useOrdersByJobId(effectiveJob?.id)`
  (`:86`); archived rows excluded at API layer.
- Money fields used by Finances — **all pounds-decimal**, accessed only through helpers:
  - base: `value` / `renovation_service_cost` → `getOrderBaseValue`
  - permit: `permit_cost` → `getOrderPermitCost`
  - options: `additional_options_total` → `getOrderAdditionalOptionsTotal`
  - total: → `getOrderTotal`
- Identity/label fields reused: `id`, display id via `getOrderDisplayId`, type label via
  `formatOrderTypeLabel`.

### Job (probe result rows)
- Source: `jobsQuery.data` — person-keyed `useJobsByPersonId` for linked selections,
  conversation-keyed `useConversationsJobs` otherwise (`PersonOrdersPanel.tsx:59-61`).
- Fields present in the select (`jobsPipeline.api.ts:117, :131`): `id`, `conversation_id`,
  `stage`, `exit_reason`, `paid_at`, `created_at`. Rows arrive newest-first — History renders
  input order, no re-sort.
- Type: `ConversationJobSummary` is not barrel-exported; the History tab defines a structural
  subset locally (precedent: `PickerJob`, `jobPickerLabels.ts:6-13`):

```ts
/** Structural subset of jobsPipeline's ConversationJobSummary (type not barrel-exported). */
interface SidebarHistoryJob {
  id: string;
  stage: JobStage;          // type-only import from '@/modules/jobsPipeline'
  exit_reason: string | null;
  paid_at: string | null;
  created_at: string;
}
```

## New client-side state

| State | Owner | Type | Notes |
|---|---|---|---|
| `activeTab` | `PersonOrdersPanel` (component state) | `'orders' \| 'contact' \| 'finances' \| 'history'` | Default `'orders'`; no URL sync; persists across selection changes while mounted (approved assumption a); declared above both returns with the other hooks |
| `editDrawerOpen` | `PersonOrdersPanel` (component state) | `boolean` | Opens the reused `EditCustomerDrawer` (customers barrel) rendered at panel root; toggled by the Contact tab's Edit button (c55a055) |

## Derived values (render-time, no new memos required beyond trivial ones)

| Value | Derivation | Consumer |
|---|---|---|
| Finances order set | `[...jobOrders, ...unassignedOrders]` (the displayed set) | `InboxFinancesTab` |
| Grand total | `reduce` of `getOrderTotal(order)` over that set | `InboxFinancesTab` |
| `hasLinkedPerson` | `effectivePersonId != null` (existing `:75` value) | `InboxContactTab` |
| History rows | `jobsQuery.data` passed through unchanged | `InboxHistoryTab` |
