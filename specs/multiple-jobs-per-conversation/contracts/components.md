# Component Contracts (Phase 1)

No HTTP/API contracts — frontend-only feature. These are the prop/state contracts between the
touched components. Existing props are listed only where their sourcing changes.

## 1. `JobPicker` (NEW — `src/modules/inbox/components/JobPicker.tsx`)

```ts
interface JobPickerProps {
  jobs: ConversationJobSummary[];        // newest first, as fetched — picker does not re-sort display
  ordersByJobId: Map<string, Order>;     // newest order per job (label source, D1)
  selectedJobId: string;                 // effectiveJob.id — parent guarantees non-null when rendered
  onSelectJob: (jobId: string) => void;
}
```

- Renders only when `jobs.length >= 2` (D2). Parent renders the existing static
  `pipelineHintLabel` chip at 0–1 jobs — pixel-identical to today.
- Entry label per FR-3 via `jobPickerLabels.ts`; exited entries append the Exited pill
  (visual match to the pipeline board's existing pill) and remain selectable (FR-1/US-4).
- Dropdown built on the existing shadcn `DropdownMenu`/`Select` primitives; trigger chip
  reuses the `pipelineHintLabel` chip styling (`ConversationHeader.tsx:52` classes) so the
  header layout is unchanged.

## 2. `utils/jobPickerLabels.ts` (NEW — pure, no React)

```ts
function buildJobPickerEntries(
  jobs: ConversationJobSummary[],
  ordersByJobId: Map<string, Order>,
): JobPickerEntry[];                      // see data-model.md

function buildOrdersByJobId(orders: Order[]): Map<string, Order>;
  // skips job_id = null (FR-7); keeps newest per job (D1)

function effectiveJobId(
  jobs: ConversationJobSummary[],
  selectedJobId: string | null,
): string | null;                         // FR-2 rule — single shared implementation
```

`effectiveJobId` is the **only** implementation of the FR-2 fallback; both consumers call it
(no per-component drift).

## 3. `ConversationHeader` (MODIFY — additive prop)

```ts
pipelineHintSlot?: React.ReactNode;  // NEW, optional. Rendered where the pipelineHintLabel
                                     // chip renders today (:51-55); when set, replaces the
                                     // chip. pipelineHintLabel behavior unchanged when unset.
```

Additive + optional → the other `ConversationHeader` consumer (`ConversationView`, flat inbox)
is untouched and type-safe with zero edits.

## 4. `CustomerConversationView` (MODIFY)

```ts
// NEW props (threaded from UnifiedInboxPage):
selectedJobId: string | null;
onSelectJob: (jobId: string) => void;
```

- **AMENDED at T006 approval (2026-08-09)**: `latestActiveJob` (`:118`) is KEPT for the
  ≤1-job hint chip — a lone exited job must render no chip (pixel parity, and an
  "In pipeline" label would be semantically wrong for an exited job). `effectiveJobId(...)`
  drives only the picker's selection. At ≥2 jobs `pipelineHintSlot` takes precedence in
  `ConversationHeader`, so the label prop is inert there.
- Header wiring: `jobs.length >= 2` → `pipelineHintSlot={<JobPicker …/>}`; `jobs.length <= 1`
  → today's `pipelineHintLabel` string from `latestActiveJob`, unchanged.
- Picker order labels: `useOrdersByPersonId(linkedPersonId)` → `buildOrdersByJobId` — same
  query key the sidebar already holds in cache; no new fetch in the common case.
- **FR-6**: "New job" button (`:296-302`) adds a per-call callback —
  `addToPipeline.mutate(args, { onSuccess: (r) => onSelectJob(r.jobId) })`.
  `AddToPipelineResult.jobId` is confirmed in `addToPipeline.api.ts:27-32,142`; per-call
  `onSuccess` composes with the hook-level one (invalidation + toast unchanged —
  `useAddToPipeline` is **not modified**).

## 5. `PersonOrdersPanel` (MODIFY)

```ts
// NEW prop:
selectedJobId: string | null;
```

Every `latestActiveJob` site becomes `effectiveJob` (per approved review — the full itemized
list, not just the creation sites):

| Line (pre-change) | Site | Becomes |
|---|---|---|
| `:52` | derivation | `effectiveJob` via shared `effectiveJobId(jobsQuery.data, selectedJobId)` |
| `:61` | S5 conversation probe | `effectiveJob.conversation_id` (D6) |
| `:69` | `useOrdersByJobId(latestActiveJob?.id)` | **argument swap** → `useOrdersByJobId(effectiveJob?.id ?? null)` (FR-4 mechanism, per directive) |
| `:83-84` | `onOrdersCountChange` | job-scoped count: `jobOrders.length \|\| (effectiveJob ? 1 : 0)` |
| `:91` | `handleNewOrder` guard | `effectiveJob` + active check (D7) |
| `:155` | `jobAction` render guard | creation buttons require `effectiveJob && !effectiveJob.exit_reason` (D7); exited selection → orders visible, no buttons |
| `:181` | empty-state guard | `!personId && !effectiveJob` |
| `:279` | `CreateOrderDrawer.initialJobId` | `effectiveJob?.id ?? null` (FR-5) |
| `:290` | `CreateInvoiceDrawer.jobId` | `effectiveJob?.id ?? null` (FR-5) |

**FR-4 list source change**: the rendered job-scoped orders list + `OrderContextSummary`
switch from the person-wide `orders` (`useOrdersByPersonId`, `:46`) to the job-scoped
`jobOrders` result. `useOrdersByPersonId` stays mounted — it now drives three things:
auto-select effect keying, cache-priming for picker labels, and the Unassigned subsection
below. Zero-jobs conversations keep today's person-wide display path untouched (edge case:
"current no-job behavior unchanged").

**Unassigned subsection (FR-7 as amended 2026-08-09)**:

```ts
const unassignedOrders = orders.filter(o => o.job_id === null); // orders = useOrdersByPersonId data
```

- Renders below the job-scoped list whenever a job-scoped list renders (≥1 job) and
  `unassignedOrders.length > 0` — **in every selection state**, including exited selections.
  Visually separated: its own `SECTION_LABEL` heading ("Unassigned"), same `InboxOrderListRow`
  rows.
- **Display-only**: rows are selectable for viewing (`onSelectOrder` → `OrderContextSummary`,
  exactly as these orders behave today — e.g. live ORD-000232 stays visible AND clickable),
  but no create actions attach to the subsection and `jobAction` never targets an unassigned
  order. Orders page → Unassigned tab remains the acting surface.
- No new fetch: pure client-side filter of the already-cached person-wide result.
- `onOrdersCountChange` reports the displayed set: `jobOrders.length + unassignedOrders.length`
  (fallback `|| (effectiveJob ? 1 : 0)` unchanged).

## 6. `UnifiedInboxPage` (MODIFY — state owner)

```ts
const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
useEffect(() => { setSelectedJobId(null); }, [activeConversationIdsKey]); // group change reset
```

- Threads `selectedJobId` + `onSelectJob={setSelectedJobId}` into `CustomerConversationView`
  (`:1306`) and `selectedJobId` into `PersonOrdersPanel` (`:1350`).
- `activeConversationIdsKey = activeConversationIds.join(',')` — same memo idiom the panel
  already uses (`PersonOrdersPanel.tsx:75`).
- Flat view: no picker; `selectedJobId` remains `null` → FR-2 default reproduces today's
  behavior (verified in data-model.md).
- Also reset `selectedOrderId` when the selected job changes (the selected order may not
  belong to the newly selected job).

## Unmodified by contract (fence)

`useConversationsJobs`, `fetchConversationsJobs`, `useAddToPipeline`, `autoAdvanceJobStage`,
`CreateOrderDrawer` (already accepts `initialJobId`), `CreateInvoiceDrawer` (already accepts
`jobId`), `OrderContextSummary`, `InboxOrderSummaryCard`, everything in `supabase/`.
