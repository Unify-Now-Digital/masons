# Spec: Multiple jobs per conversation — job picker + job-scoped sidebar

Feature Branch: feature/multi-job-picker
Created: 2026-08-09
Status: Draft — plan pending
Input: Ground-truth investigation 09 Aug 2026 (grep + SQL, SM org);
       product decisions by Giorgi; OQ-A pending Arin.

## Problem
The data model and create path already support multiple jobs per
conversation (jobs.conversation_id has no uniqueness; "New job" passes
allowAdditional). But all inbox surfaces render exactly one job:
CustomerConversationView:118 and PersonOrdersPanel:52 take the newest
active job and hide the rest. SM production already has multi-job
people (person d4b7a8ac… has 4 jobs; 1869c23c… has 2). A user managing
a second concurrent memorial cannot see or act on it from the inbox.

## Goal
The conversation view gains a job picker. The selected job scopes the
right sidebar (order context, order list, actions) and is the explicit
target of "New order" and "Create invoice".

## User Scenarios & Testing

US-1 (P1) Switch between jobs on one conversation
  As a Mason user viewing a conversation whose contact has multiple
  jobs, I can pick which job I'm working on, and the sidebar shows
  only that job's orders and details.
  Acceptance:
  - Given the 4-job test person, the picker lists 4 entries labeled
    "Job 1 — <order label> — Quoted" … "Job 4 — …", newest first.
  - Selecting Job 2 shows only Job 2's order (1 order, not 4) in
    the order context panel and orders list.
  - Default selection on open = newest active job (FR-2).

US-2 (P1) Create order/invoice against the selected job
  Acceptance:
  - With Job 2 selected, "Create invoice" writes invoices.job_id =
    Job 2's id (verified by SELECT on the created row).
  - Stage automation advances Job 2 only; Jobs 1/3/4 stages
    unchanged (verified by SELECT before/after).

US-3 (P2) Add a new job and land on it
  Acceptance:
  - "New job" on a conversation with existing jobs creates an
    additional job (allowAdditional path unchanged) and the picker
    auto-selects it (FR-6).

US-4 (P2) Exited jobs remain reachable
  Acceptance:
  - A job with exit_reason set appears in the picker with the
    Exited pill and is selectable; its orders display read-only
    as today.

Edge Cases:
- Conversation with zero jobs: picker hidden or replaced by the
  existing "Add to pipeline" affordance — current no-job behavior
  unchanged.
- Exactly one job: picker renders with one entry (or collapses to
  the current badge — plan decides; behavior must be identical to
  today's single-job display).
- Selected job has no orders: order context panel shows the
  existing empty state, not other jobs' orders.
- All jobs exited: default selection = newest job (FR-2 fallback).

## Requirements
FR-1 Job picker renders in the conversation header where the single
     "In pipeline: <stage>" badge renders today. Lists ALL jobs for the
     conversation group (active and exited), newest first (existing
     fetchConversationsJobs order). Exited jobs show the Exited pill
     and remain selectable (history stays reachable).
FR-2 Default selection = newest active job; if none, newest job.
FR-3 Label format: "Job N — <order label> — <Stage>" when the job has
     a linked order; "Job N — <Stage>" otherwise. N is stable per
     conversation group, numbered by created_at ascending (Job 1 =
     oldest), computed client-side from the same fetch. Order label
     derived from the job's linked order (order type / product name —
     confirm exact field in plan; it is the source of the
     "New Memorial" chip in the existing sidebar).
FR-4 Right sidebar (order context panel + orders list) shows only
     orders where order.job_id = selectedJob.id.
FR-5 "New order" and "Create invoice" from the sidebar pass
     selectedJob.id as job_id. Stage automations then advance the
     selected job (no change to autoAdvanceJobStage — it already keys
     off the row's job_id).
FR-6 "New job" (allowAdditional) behavior unchanged; after creation,
     picker selects the new job.
FR-7 The job-scoped list shows only orders where order.job_id =
     selectedJob.id. Orders belonging to the person with
     job_id = null render in a visually separated "Unassigned"
     subsection below the job-scoped list, in every selection
     state — they never silently vanish (9 such orders exist in
     SM today, incl. ORD-000232). Unassigned orders are
     display-only in the sidebar (no create actions); Orders
     page → Unassigned tab remains the place to act on them.

## Success Criteria
SC-001 A user can view and act on every job of a multi-job
       conversation from the inbox without leaving the page.
SC-002 Zero cross-job writes: every order/invoice created from the
       sidebar carries the selected job's id.
SC-003 Single-job conversations look and behave identically to
       pre-change (no regression for the common case).
SC-004 tsc error count remains exactly 55.

## Out of scope
- Part B data model (parties/roles, grave entity, companies).
- jobs.enquiry_id / enquiries table semantics (separate ground-truth).
- Job labels beyond derived format (no jobs.label column in v1).
- Orders-page and quote-convert creation paths (job_id sourcing there
  unchanged; audit separately if needed).
- Pipeline board changes (already renders one card per job).
- Any schema changes, migrations, or DB-side changes.

## Open questions (Arin, Monday)
OQ-A Picker label: is "Job N — New Memorial — Quoted" the right
     vocabulary for his team, or does he want a nameable label?
OQ-B RESOLVED: audited both multi-job people via SQL — every
     job/order pairing correct (orders created atomically with their
     jobs, identical created_at timestamps). No data fix needed.
OQ-C (from T008 browser pass, 2026-08-09): the 4-job person
     (d4b7a8ac…) spans 4 SEPARATE conversations, one job each — so
     no single conversation shows a multi-job picker for them. Jobs
     with conversation_id = null also exist in production and can
     never appear in any conversation's picker. Not a defect: the
     picker scopes to the conversation group by design. Ask Arin
     which model fits the business: (a) concurrent memorials share
     one conversation, (b) stay split with the picker remaining
     group-scoped, or (c) stay split but the picker goes person-wide
     for linked conversations (affects whether cross-conversation
     grouping is a Part B need).

## Constraints
- tsc baseline exactly 55 (npx tsc --noEmit -p tsconfig.app.json);
  zero new errors.
- No payload may include updated_at on inbox_conversations.
- All queries org-scoped with organization_id.
- Frontend-only: components, hooks, prop threading. No API signature
  changes beyond passing an explicit jobId where a prop already
  exists (CreateInvoiceDrawer already takes a jobId prop).
- Respect existing module boundaries (inbox components consume
  jobsPipeline via its public API/index exports, as today).
- No routing changes; feature lives entirely within the existing
  inbox route.