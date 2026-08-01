# Quickstart: Pipeline Page (Before Paid) + Add to Pipeline

Implementation order (each step leaves the app buildable; FR-012 first — everything depends on it):

## 1. Types foundation

- Extend `src/shared/types/database.types.ts`: `jobs` table entry (between `invoices` and
  `memorials`), `job_id` on `orders`/`invoices` Row/Insert/Update + Relationships. See
  `data-model.md §5` for exact insertion points and the relationship-per-view convention.
- Gate: `npx tsc -p tsconfig.app.json` — still exactly the 59-error baseline.

## 2. Module skeleton

```text
src/modules/jobsPipeline/
├── api/
│   ├── jobsPipelineKeys.ts        # ['jobsPipeline', …] key factory
│   ├── jobsPipeline.api.ts        # Q1–Q4, M1–M2 (contracts/jobs-pipeline-data.md)
│   └── addToPipeline.api.ts       # intake flow (contracts/add-to-pipeline.md)
├── hooks/
│   ├── useJobsPipeline.ts         # active board (Q1 + Q2 combined view-model)
│   ├── useExitedJobs.ts           # Q3
│   ├── useConversationJob.ts      # Q4
│   └── useJobMutations.ts         # M1, M2, useAddToPipeline
├── components/                    # board, column, card, exit modal, exited list, filters
├── pages/
│   └── JobsPipelinePage.tsx       # Active | Exited view switch
├── types/jobsPipeline.types.ts    # data-model.md §3
├── utils/display.ts               # display name chain, channel→source map, handle classifier
└── index.ts                       # export { JobsPipelinePage }; export { useAddToPipeline, useConversationJob }
```

Names/keys deliberately avoid the existing `src/modules/jobs` and `src/modules/pipeline`
modules (research.md R2/R3).

## 3. Board UI (User Story 1)

- `JobsPipelinePage` → three-column grid, styling lifted from
  `src/modules/inquiries/components/InquiriesBoard.tsx` (gardens tokens) and the gardens kit
  (`Card, Btn, Pill` from `@/shared/components/gardens`).
- Card: display-name chain, `stage_status` Pill (tolerate null / arbitrary text: `pending`,
  `uncontacted`), created date, invoice total on Invoiced cards (`formatGbpDecimal`).
- Card click → `navigate('/dashboard/inbox?conversation=' + conversation.id)`; not clickable when
  `conversation` is null.
- Move buttons: ±1 within Enquired/Quoted/Invoiced; Invoiced-entry button disabled (with
  tooltip "Needs a linked invoice") unless the invoice summary map has a count for the job.

## 4. Exit modal + Exited view (User Story 2)

- Modal (shadcn Dialog): Lost / Closed / Dormant radios; date picker rendered+required only for
  Dormant; confirm disabled until valid. Calls M2.
- Exited view: toggle on the page (e.g. "Exited" tab/segmented control); list ordered
  `exited_at desc`, client-side reason filter; columns: name/handle, reason, exited date, wake
  date. No delete anywhere. (Parent-spec fallback: this list is the first scope cut — keep it a
  separate component so cutting it doesn't touch the board.)

## 5. Route + sidebar cutover

- `src/app/router.tsx`: static-import `JobsPipelinePage` from `@/modules/jobsPipeline`; point
  `<Route path="inquiries">` at it; remove the inquiries lazy import (module files stay).
- `src/components/layout/Sidebar.tsx`: 'Inquiries' entry → label 'Pipeline', same
  `to: '/dashboard/inquiries'`, drop `ai: true`.
- Old inquiries module remains in tree, now unrouted (FR-001).

## 6. Inbox intake (User Story 3)

- `ConversationView.tsx`: `useConversationJob(conversation.id)` + `useAddToPipeline()` (both via
  `@/modules/jobsPipeline` public surface); pass `secondaryActionButtonLabel="Add to pipeline"`
  to `ConversationHeader` when no job exists.
- Flow per `contracts/add-to-pipeline.md` (org-scoped dedupe, no `updated_at`, channel→source
  map, concurrency re-check).

## Verification

1. **Typecheck**: `npx tsc -p tsconfig.app.json` → 59 pre-existing errors, zero new. `npm run
   lint` clean on touched files. (`vite build` does not typecheck — run tsc separately.)
2. **Test org, write flows** (never Churchill/Sears Melvin — AC-004): seed a conversation per
   channel case; verify Add-to-pipeline (a) linked person, (b) no person + new handle, (c) no
   person + duplicate handle → reuse; verify moves, Invoiced gate off/on (create test invoice
   with job_id via app flows if available, else defer gate-on check to SM read-only), exits
   (dormant date required), Exited list filter.
3. **SM prod, read-only** (SC-001): board shows 43 jobs (23 Enquired / 20 Quoted), `pending`
   pills, correct names; card click lands on the right conversation. No writes.
4. **Grep discipline** (parent spec §7): grep on disk confirms no `updated_at` in any
   conversation update payload, no `.delete()` on jobs, no global `people` query in the module.
5. Old route check: `/dashboard/inquiries` renders the new page; `/dashboard/pipeline` (legacy
   order board) unchanged.
