# Implementation Plan: Pipeline Page (Before Paid) + Add to Pipeline

**Branch**: `feature/pipeline-page-before-paid-add-to-pipeline` | **Date**: 2026-08-02 | **Spec**: `specs/pipeline-page-before-paid-add-to-pipeline/spec.md`
**Input**: Feature specification from `specs/pipeline-page-before-paid-add-to-pipeline/spec.md`
**Parent**: `specs/status_v2-implementation-spec.md` §4–5 (authoritative; schema + backfill already applied in production — zero schema work here)

## Summary

Build a new frontend module `src/modules/jobsPipeline/` that (a) replaces the Inquiries board at
`/dashboard/inquiries` (sidebar label "Pipeline") with a three-column Before-Paid board over the
existing `jobs` table (Enquired / Quoted / Invoiced; `exit_reason IS NULL AND paid_at IS NULL`,
org-scoped), with one-step stage moves, an app-level Invoiced gate (invoice with `job_id` must
exist), an exit modal (lost/closed/dormant + required wake date) and a filterable Exited list; and
(b) adds an "Add to pipeline" action to inbox conversations without a job, which resolves/creates
the person (org-scoped email/phone dedupe, never global), creates the job (source mapped from
channel, stage `enquired`, stage_status `uncontacted`), and links the conversation
(`person_id` + `link_state='linked'`, never `updated_at` in the payload). Purely frontend +
`database.types.ts` documentation parity; no DB objects, no orders/invoices write-path changes.

User-provided pre-answer incorporated and verified against
`supabase/migrations/20260801210000_jobs_pipeline_schema.sql`: link columns are
`jobs.conversation_id`, `jobs.person_id`, `jobs.enquiry_id`, plus `orders.job_id` and
`invoices.job_id` — confirmed by reading the migration (research.md R1); the spec's open
assumption is resolved.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite (SWC)
**Primary Dependencies**: React Router v6 (`src/app/router.tsx` — all routes), TanStack React Query, Supabase JS client (`src/shared/lib/supabase.ts`, deliberately `createClient<any>`), shadcn/ui + gardens kit (`@/shared/components/gardens`), gardens-* Tailwind tokens
**Storage**: Existing Supabase Postgres — `jobs` table with `jobs_org_*` RLS (no DELETE policy), partial indexes `jobs_org_stage_idx`/`jobs_org_exited_idx`; reads on `invoices`/`people`/`inbox_conversations`; writes on `jobs`, `people` (insert), `inbox_conversations` (link fields only)
**Testing**: `npx tsc -p tsconfig.app.json` (59-error baseline, zero new), `npm run lint`, manual test-org script + SM read-only verification (quickstart.md); no UI test harness exists in repo
**Target Platform**: Web (existing dashboard SPA)
**Project Type**: Single frontend feature module + shared-types extension
**Performance Goals**: Board interactive from two org-scoped queries (jobs + invoices) at current scale (~43 jobs); no realtime subscriptions in V1
**Constraints**: No schema changes; no writes to Churchill/Sears Melvin during dev; `enquiry_stage` untouched; old inquiries module files stay in tree; conversation update payloads must exclude `updated_at`; person dedupe org-scoped only
**Scale/Scope**: One new module (~15 files), 2-line router change, 1 sidebar entry, 1 inbox wiring point (`ConversationView`), 3 insertion regions in `database.types.ts`

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design — no violations.*

- **Dual router constraint**: PASS. `src/app/` + `src/pages/` coexistence untouched; only the
  element behind the existing `path="inquiries"` route in `src/app/router.tsx` changes, matching
  the established registration pattern (research.md R4).
- **Module boundaries**: PASS. All new code in `src/modules/jobsPipeline/` with a minimal public
  surface (`JobsPipelinePage`, `useAddToPipeline`, `useConversationJob`) via `index.ts`; inbox
  consumes only that surface. The module does its own `people` reads/inserts rather than
  extending the grandfathered inbox→customers deep import (research.md R8).
- **Supabase + RLS**: PASS. `jobs_org_*` policies (via `user_is_member_of_org`) are the security
  boundary; explicit org filters in queries are UX. No new policies needed; no DELETE attempted
  (none exists). Note: the jobs policies use `user_is_member_of_org(...)`, mirroring `orders_org_*`,
  rather than the constitution's `(select auth.uid())` ownership idiom — pre-existing applied
  schema, out of this feature's scope.
- **Secrets**: PASS. No edge functions, no secrets, frontend anon-key access only.
- **Additive-first**: PASS. No destructive changes: old inquiries module files remain (route
  detached only), `enquiry_stage` untouched, types extension additive, no data migrations.

## Phase 0: Research (complete → `research.md`)

Resolved decisions (full detail in research.md R1–R14):

1. **R1 Schema ground truth** read from the applied migration — constraints (`jobs_exit_pairs`,
   `jobs_dormant_needs_wake`) dictate exit-payload shape; backfill rows carry
   `stage_status='pending'`, new intake writes `'uncontacted'` (pill handles free text/null).
2. **R2 Naming collisions resolved**: module `jobsPipeline`, page `JobsPipelinePage`, keys
   `['jobsPipeline', …]`; route path stays `inquiries` (deep links preserved; existing hidden
   `pipeline` + `jobs` modules untouched).
3. **R3 Pre-existing breakage flagged, out of scope**: legacy `src/modules/jobs` + logistics
   query `.from('jobs')` with the old scheduling shape; broken before (42P01) and after (42703)
   the migration — logged for parent-spec cleanup, not touched here.
4. **R7 channel→source mapping** (corrected by Giorgi 02 Aug): `web→website` (trigger-created
   website-enquiry conversations), `sms→sms` (`jobs_source_check` extended in production),
   `email`/`whatsapp`/`ghl` pass through, unrecognized → `manual`.
5. **R8 Person resolution**: single-click; org-scoped client-side dedupe reusing
   `AddToCustomersDialog`'s matchers (normalized email / phone-last-10, ≥7 digits);
   `first_name` from email local-part or raw handle, `last_name=''` (NOT NULL).
6. **R10 Invoiced gate**: org-scoped invoices-with-job_id query reduced to a per-job map for
   button state + card totals (`formatGbpDecimal(amount)` — pounds, not pence); fresh re-check
   inside the move mutation.
7. **R9/R14** `updated_at` exclusion (incident precedent commit `53e8eb1`); verification =
   tsc baseline + lint + test-org script + SM read-only check.

## Phase 1: Design (complete)

- `data-model.md` — jobs schema table, read/write surface per related entity, module TS types
  (`PipelineJob`, `BEFORE_PAID_STAGES`, exit/source unions), derived rules (display-name chain,
  move targets, exit payload, handle classifier), exact `database.types.ts` insertion points.
- `contracts/jobs-pipeline-data.md` — queries Q1–Q4 (active board, invoice summaries, exited
  list, conversation-job probe) and mutations M1–M2 (move with in-mutation gate re-check, exit)
  plus explicit non-operations (no deletes, no orders/invoices writes, no un-exit).
- `contracts/add-to-pipeline.md` — the 4-step intake mutation (concurrency re-check → person
  resolve/create → job insert → conversation link), failure semantics (acceptable partial
  progress, no transactional RPC in V1), invalidation set, prohibitions.
- `quickstart.md` — build order (types → skeleton → board → exit → cutover → inbox) and the
  verification script.

## Phase 2: Task breakdown

Generated by `/tasks` (per plan template: tasks.md is not a /plan output). Suggested task
grouping already implied by quickstart steps 1–6 + verification.

## Post-Design Constitution Check

- **Dual router constraint**: PASS (element swap on an existing route only).
- **Module boundaries**: PASS (one new module; inbox uses public surface; no new deep imports).
- **Supabase + RLS**: PASS (existing policies; org-scoped queries; no global people lookup).
- **Secrets**: PASS (none involved).
- **Additive-first**: PASS (no deletions, no schema, no behavior change to orders/invoices/
  enquiry_stage; Inquiries route element replacement is the single intentional swap, with files
  retained for rollback by reverting two lines in router.tsx + Sidebar.tsx).

## Project Structure

### Documentation (this feature)

```text
specs/pipeline-page-before-paid-add-to-pipeline/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── jobs-pipeline-data.md
│   └── add-to-pipeline.md
└── tasks.md             # Phase 2 (/tasks output — not created by /plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── router.tsx                        # MODIFY: path="inquiries" element → JobsPipelinePage
├── components/layout/
│   └── Sidebar.tsx                       # MODIFY: 'Inquiries' NavItem → label 'Pipeline'
├── modules/
│   ├── jobsPipeline/                     # NEW module (layout in quickstart.md §2)
│   │   ├── api/      (jobsPipelineKeys, jobsPipeline.api, addToPipeline.api)
│   │   ├── hooks/    (useJobsPipeline, useExitedJobs, useConversationJob, useJobMutations)
│   │   ├── components/ (board, column, card, exit modal, exited list, filters)
│   │   ├── pages/JobsPipelinePage.tsx
│   │   ├── types/jobsPipeline.types.ts
│   │   ├── utils/display.ts
│   │   └── index.ts
│   ├── inbox/
│   │   └── components/ConversationView.tsx  # MODIFY: wire Add-to-pipeline into
│   │                                        # ConversationHeader's unused secondary slot
│   ├── inquiries/                        # UNTOUCHED (unrouted after cutover; deleted post-soak)
│   ├── jobs/                             # UNTOUCHED (legacy scheduling module, see R3)
│   └── pipeline/                         # UNTOUCHED (legacy order-stage board, see R2)
└── shared/
    └── types/database.types.ts           # MODIFY: jobs entry + job_id on orders/invoices (FR-012)
```

**Structure Decision**: Standard feature-module architecture; zero backend changes. Four modified
files total outside the new module (`router.tsx`, `Sidebar.tsx`, `ConversationView.tsx`,
`database.types.ts`), keeping the cutover reviewable and trivially revertible.

## Complexity Tracking

No constitution violations; no complexity exceptions required.

## Risks & Watchpoints

1. **Legacy `.from('jobs')` consumers** (R3): hidden `/dashboard/jobs` + logistics schedule were
   already broken; do not "fix" opportunistically — flag to Giorgi for the cleanup list.
2. **Partial-progress intake** (contracts/add-to-pipeline.md): person-without-job or
   job-without-link possible on mid-flow failure; toasts state the partial outcome; retry paths
   exist. Transactional RPC deliberately deferred (schema-adjacent).
3. **`stage_status` is free text**: render defensively; don't build an enum that the backfill's
   `'pending'` value would violate.
4. **Invoiced gate race**: button state can be stale; the in-mutation re-check (M1) is the
   authority. DB does not enforce D4 — app-level by design (V1).
5. **Demo timing**: Exited list view is the sanctioned first scope cut (parent spec §5) — kept in
   a standalone component so cutting it is a one-line page change.
