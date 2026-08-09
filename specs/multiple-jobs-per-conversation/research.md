# Research (Phase 0): Multiple jobs per conversation

Date: 2026-08-09 · Branch: `feature/multi-job-picker` · Spec: `spec.md` (authoritative)

Two mandated questions, answered with grep evidence from the working tree.

## Q1 — Who passes jobId into CreateInvoiceDrawer; how does inbox "New order" source job_id?

### CreateInvoiceDrawer call sites (exhaustive)

```
$ grep -rn "CreateInvoiceDrawer" src/
src\modules\invoicing\index.ts:4:export { CreateInvoiceDrawer } from './components/CreateInvoiceDrawer';
src\modules\invoicing\components\InvoiceWorkspace.tsx:12:import { CreateInvoiceDrawer } from './CreateInvoiceDrawer';
src\modules\invoicing\components\InvoiceWorkspace.tsx:705:      <CreateInvoiceDrawer
src\modules\invoicing\components\CreateInvoiceDrawer.tsx:55:interface CreateInvoiceDrawerProps {
src\modules\invoicing\components\CreateInvoiceDrawer.tsx:139:export const CreateInvoiceDrawer: React.FC<CreateInvoiceDrawerProps> = ({
src\modules\invoicing\components\CreateInvoiceDrawer.tsx:996:export default CreateInvoiceDrawer;
src\modules\inbox\components\PersonOrdersPanel.tsx:10:import { CreateInvoiceDrawer } from '@/modules/invoicing';
src\modules\inbox\components\PersonOrdersPanel.tsx:286:      <CreateInvoiceDrawer
```

Exactly **two render sites**:

1. **`PersonOrdersPanel.tsx:286-292`** — the inbox sidebar path. Passes
   `jobId={latestActiveJob?.id ?? null}`:
   ```tsx
   <CreateInvoiceDrawer
     open={invoiceDrawerOpen}
     onOpenChange={setInvoiceDrawerOpen}
     preloadedOrders={uninvoicedJobOrders}
     jobId={latestActiveJob?.id ?? null}
     initialPersonId={effectivePersonId}
   />
   ```
2. **`InvoiceWorkspace.tsx:705-708`** — the Invoicing page path. Passes **no jobId**
   (prop is optional; `invoices.job_id` ends up null from this path):
   ```tsx
   <CreateInvoiceDrawer
     open={createDrawerOpen}
     onOpenChange={setCreateDrawerOpen}
   />
   ```
   This is the orders-page/invoicing-page creation path the spec puts **out of scope** —
   untouched by this feature.

The `jobId` prop already exists (`CreateInvoiceDrawer.tsx:64-65`):
```ts
/** Linked pipeline job; written to `invoices.job_id` and onto inline-created orders. */
jobId?: string | null;
```

### Inbox "New order" job_id source

```
$ grep -rn "initialJobId" src/
src\modules\inbox\components\PersonOrdersPanel.tsx:279:        initialJobId={latestActiveJob?.id ?? null}
src\modules\orders\components\CreateOrderDrawer.tsx:43:  initialJobId?: string | null;
src\modules\orders\components\CreateOrderDrawer.tsx:55:  initialJobId,
src\modules\orders\components\CreateOrderDrawer.tsx:286:      job_id: initialJobId || null,
```

Single source: `PersonOrdersPanel.tsx:279` passes `initialJobId={latestActiveJob?.id ?? null}`
into `CreateOrderDrawer`, which writes it verbatim as `job_id` (`CreateOrderDrawer.tsx:286`).

### latestActiveJob derivation — both components, no third path

```
$ grep -rn "latestActiveJob" src/
src\modules\inbox\components\CustomerConversationView.tsx:118:  const latestActiveJob = groupJobs.data?.find((j) => !j.exit_reason) ?? null;
src\modules\inbox\components\CustomerConversationView.tsx:285:            latestActiveJob ? `In pipeline: ${formatStageLabel(latestActiveJob.stage)}` : undefined
src\modules\inbox\components\PersonOrdersPanel.tsx:52:  const latestActiveJob = jobsQuery.data?.find((j) => !j.exit_reason) ?? null;
src\modules\inbox\components\PersonOrdersPanel.tsx:61:    !personId && latestActiveJob ? latestActiveJob.conversation_id : null
src\modules\inbox\components\PersonOrdersPanel.tsx:69:  const { data: jobOrders = [] } = useOrdersByJobId(latestActiveJob?.id ?? null);
src\modules\inbox\components\PersonOrdersPanel.tsx:83:    if (!isLoading) onOrdersCountChange?.(orders.length || (latestActiveJob ? 1 : 0));
src\modules\inbox\components\PersonOrdersPanel.tsx:84:  }, [orders.length, isLoading, onOrdersCountChange, latestActiveJob]);
src\modules\inbox\components\PersonOrdersPanel.tsx:91:    if (!latestActiveJob || !organizationId) return;
src\modules\inbox\components\PersonOrdersPanel.tsx:155:  const jobAction = !jobsResolved ? null : latestActiveJob ? (
src\modules\inbox\components\PersonOrdersPanel.tsx:181:  if (!personId && !latestActiveJob) {
src\modules\inbox\components\PersonOrdersPanel.tsx:279:        initialJobId={latestActiveJob?.id ?? null}
src\modules\inbox\components\PersonOrdersPanel.tsx:290:        jobId={latestActiveJob?.id ?? null}
```

**CONFIRMED**: `latestActiveJob` exists in exactly two files, both derived identically as
`jobs.find((j) => !j.exit_reason)` over the same `useConversationsJobs(conversationIds)`
query (newest-first, so `.find` = newest active).

- `CustomerConversationView` uses it **display-only** (the "In pipeline: <stage>" hint chip
  at line 285 — the exact spot FR-1 replaces). It creates nothing.
- `PersonOrdersPanel` uses it for **all creation targeting**: `initialJobId` (New order,
  line 279) and `jobId` (Create invoice, line 290), plus job-scoped invoice preload
  (`useOrdersByJobId`, line 69).
- **No third path exists** — no other file references `latestActiveJob`, no other caller
  passes `jobId`/`initialJobId`.

## Q2 — Which order field renders the "New Memorial" chip (FR-3 label source)?

The chip is `orders.order_type`, formatted by `formatOrderTypeLabel`:

```
$ grep -rn "formatOrderTypeLabel" src/ (inbox hits)
src\modules\inbox\components\OrderContextSummary.tsx:123:      orderType={formatOrderTypeLabel(order.order_type)}
src\modules\inbox\components\PersonOrdersPanel.tsx:254:                      formatOrderTypeLabel(order.order_type) +
```

`OrderContextSummary.tsx:123` feeds `InboxOrderSummaryCard`'s `orderType` prop, which renders
the visible chip (`InboxOrderSummaryCard.tsx:64-67`):

```tsx
<div className="flex items-center gap-1.5 flex-wrap">
  <span className="text-[11px] font-medium text-gardens-txs px-2 py-0.5 rounded-md bg-gardens-page">
    {orderType}
  </span>
```

Formatter (`src/modules/orders/utils/orderTypeDisplay.ts:5-11`) normalizes DB values
(e.g. `new-memorial` → `New Memorial`). **FR-3 order label = `formatOrderTypeLabel(order.order_type)`
of the job's linked order** — same field, same formatter as the existing chip.

## Supporting findings (needed by the plan)

- **Job fetch & ordering** (`jobsPipeline.api.ts:110-122`): `fetchConversationsJobs` selects
  `id, conversation_id, stage, exit_reason, paid_at, created_at` from `jobs`,
  `.order('created_at', { ascending: false })` — newest first, satisfying FR-1's ordering and
  giving `created_at` for the client-side "Job N" numbering (FR-3). It returns **no order
  fields**, so the picker's order label must come from a separate orders source.
- **Order-per-job source without new API**: `useOrdersByPersonId(personId)` (already used by
  the sidebar) returns orders carrying `job_id` — a client-side `job_id → order` map covers
  picker labels. Zero API changes.
- **Common parent**: `UnifiedInboxPage.tsx` hosts both `CustomerConversationView` (line 1306)
  and `PersonOrdersPanel` (line 1350) — selected-job state lifts there and threads down as
  props.
- **Module surface**: `jobsPipeline/index.ts` already exports `useConversationsJobs`,
  `formatStageLabel`, `autoAdvanceJobStage` — inbox consumes via the public index today;
  no new exports required.
- **Scope fence check**: nothing in `supabase/`, no `jobsPipeline.api` signature change, no
  `autoAdvanceStage` change, no schema change is needed by any FR. Fence holds.
