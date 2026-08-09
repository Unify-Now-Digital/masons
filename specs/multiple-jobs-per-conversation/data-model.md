# Data Model (Phase 1): Multiple jobs per conversation

Client-side view model only — **no DB entities, no schema changes** (spec Out of scope).
All types compose existing fetch results; every underlying query is org-scoped/RLS as today.

## Source data (existing, unchanged)

### ConversationJobSummary — `jobsPipeline.api.ts:101-108`
```ts
{ id, conversation_id, stage, exit_reason, paid_at, created_at }
```
Fetched by `fetchConversationsJobs(conversationIds)` — newest first (`created_at desc`).
Consumed via `useConversationsJobs` (public jobsPipeline export). **Not modified.**

### Order — `orders.types.ts` (relevant fields)
```ts
{ id, job_id, order_type, invoice_id, created_at, ... }
```
Sources: `useOrdersByPersonId(personId)` (person-wide, cached — feeds picker labels) and
`useOrdersByJobId(jobId)` (job-scoped — becomes the FR-4 list source). **Not modified.**

## Derived view model (new, pure client-side)

### JobPickerEntry — computed in `utils/jobPickerLabels.ts`
```ts
interface JobPickerEntry {
  job: ConversationJobSummary;
  jobNumber: number;        // FR-3 "Job N" — stable per conversation group
  orderLabel: string | null; // formatOrderTypeLabel(newest linked order.order_type), or null
  stageLabel: string;       // formatStageLabel(job.stage) — existing jobsPipeline export
  isExited: boolean;        // job.exit_reason != null → Exited pill (FR-1)
  label: string;            // "Job N — <orderLabel> — <stageLabel>" | "Job N — <stageLabel>"
}
```

**Job numbering (FR-3)**: sort jobs by `created_at` ascending, tie-break by `id` ascending
(SM data proves identical timestamps occur — OQ-B found atomic creation; determinism requires
the tie-break). Index+1 = N. Jobs never leave the fetch (exited jobs included), so N is stable
for a given group. Picker *display* order stays newest first (FR-1) — numbering and display
order are independent.

**Order label (D1)**: build `Map<job_id, Order>` from `useOrdersByPersonId` data keeping the
newest order per `job_id` (rows with `job_id = null` are skipped — they label no job). Label =
that order's `formatOrderTypeLabel(order_type)`. **Known v1 simplification (recorded per
review):** multi-order jobs show the newest order's label with no count — revisit with OQ-A
(nameable labels) after Arin feedback.

### Unassigned orders (FR-7 as amended 2026-08-09)
```ts
unassignedOrders = personOrders.filter(o => o.job_id === null)  // client-side, from the
                                                                // already-cached useOrdersByPersonId result
```
Rendered as a visually separated **"Unassigned" subsection below the job-scoped list, in
every selection state** — never silently removed (9 live SM orders incl. ORD-000232, £3,600).
Display-only: rows are viewable/selectable like today, but no create actions attach to them;
Orders page → Unassigned tab remains the place to act on them.

## Selection state (lives in `UnifiedInboxPage`)

```ts
selectedJobId: string | null   // null = "no explicit choice — use default rule"
```

| Event | Effect |
|---|---|
| Conversation group changes (`activeConversationIds` key changes) | reset to `null` |
| User picks a job in JobPicker | `setSelectedJobId(job.id)` |
| "New job" succeeds (FR-6) | `setSelectedJobId(result.jobId)` from `AddToPipelineResult` |
| Selected id absent from current jobs fetch (stale/deleted) | treated as `null` (fallback) |

**Effective selection (FR-2), derived — never stored:**
```ts
effectiveJob = jobs.find(j => j.id === selectedJobId)
  ?? jobs.find(j => !j.exit_reason)   // newest active (list is newest-first)
  ?? jobs[0]                          // newest overall (all-exited fallback)
  ?? null                             // zero jobs — existing no-job behavior
```
Both consumers (`CustomerConversationView`, `PersonOrdersPanel`) receive `selectedJobId` and
derive `effectiveJob` from the **same cache-shared `useConversationsJobs` query** — in
customers view both components already receive the identical `selectedCustomersRow.conversationIds`
array, so the query key matches and no second fetch occurs. In flat (non-customers) view no
picker renders (header is `ConversationView`); `selectedJobId` stays `null` and the default
rule reproduces today's `latestActiveJob` targeting exactly.

## Behavioral invariants

- **FR-4 (per approved directive)**: the sidebar's job-scoped order list and context switch
  to `useOrdersByJobId(effectiveJob?.id ?? null)` — an **argument swap** on the existing hook
  (`latestActiveJob?.id` → `effectiveJob?.id`), not new client-side filtering.
- **FR-7 (amended)**: orphan orders (`job_id = null`) are excluded from the job-scoped list
  by construction, but surface in the display-only Unassigned subsection (above) whenever
  they exist — the no-silent-vanish guarantee. Displayed orders = job-scoped list +
  unassigned subsection; the panel's `onOrdersCountChange` count follows the displayed set.
- **Creation gating (D7)**: "New order" / "Create invoice" affordances render only when
  `effectiveJob` is **active** (`!exit_reason`) — preserves today's invariant that creation
  targets active jobs only. An exited selection (US-4) shows its orders read-only with no
  creation buttons.
- **Invoice preload**: `uninvoicedJobOrders` derives from the same job-scoped query
  (unchanged filter `!order.invoice_id`), now scoped to `effectiveJob`.
- **S5 person-resolution (D6)**: keys off `effectiveJob.conversation_id` (was
  `latestActiveJob.conversation_id`); only reachable when the creation affordances render,
  i.e. `effectiveJob` is active.
