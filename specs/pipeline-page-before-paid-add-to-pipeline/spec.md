# Feature Specification: Pipeline Page (Before Paid) + Add to Pipeline

**Feature Branch**: `feature/pipeline-page-before-paid-add-to-pipeline`
**Created**: 2026-08-02
**Status**: Draft
**Input**: User description: "Pipeline page (Before Paid) + Add to pipeline — build the jobs-based Pipeline page replacing /dashboard/inquiries, and the inbox 'Add to pipeline' intake action, per specs/status_v2-implementation-spec.md §4–5."

> **Authoritative parent spec**: `specs/status_v2-implementation-spec.md` (§4–5 are this feature's
> scope). The `jobs` table, RLS policies, indexes, and the SM backfill **already exist in
> production** — this feature creates **no schema**. `specs/007-inquiries-pipeline/` describes the
> OLD read-only inquiries board this feature replaces; it is superseded, read for context only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See and work the pre-paid pipeline (Priority: P1)

As a signed-in organization member, I open the Pipeline page (which takes over the sidebar slot and
route previously held by Inquiries) and see all of my organization's active pre-paid jobs in three
columns — Enquired, Quoted, Invoiced — so I know exactly where every prospective job sits and can
move it forward as work happens.

**Why this priority**: This is the core deliverable — the operational view over the `jobs` table
that the schema and backfill were built for. It is the Monday demo item and replaces the stale
read-only inquiries board.

**Independent Test**: With the backfilled Sears Melvin data (23 enquired / 20 quoted jobs), open
the Pipeline page and confirm every job with `exit_reason IS NULL AND paid_at IS NULL` appears in
the column matching its stage, with correct card content, and that no other organization's jobs are
visible.

**Acceptance Scenarios**:

1. **Given** I am a member of an org with active pre-paid jobs, **When** I open the Pipeline page,
   **Then** I see three columns — Enquired, Quoted, Invoiced — containing exactly the org's jobs
   where `exit_reason` is null and `paid_at` is null, each in the column matching its stage.
2. **Given** a job whose linked person has a name, **When** its card renders, **Then** the card
   shows the person's name, a stage_status pill, and the job's created date.
3. **Given** a job whose person is missing or unnamed, **When** its card renders, **Then** the card
   falls back to the linked conversation's `primary_handle` as the display name.
4. **Given** any pipeline card, **When** I click it, **Then** the app navigates to that job's
   conversation in the Inbox.
5. **Given** a job in Enquired, **When** I use the forward move control, **Then** the job moves to
   Quoted (and back moves reverse it) with no gate.
6. **Given** a job in Quoted with **no** invoice carrying its `job_id`, **When** I view its card,
   **Then** the "move to Invoiced" control is disabled; **Given** an invoice with this `job_id`
   exists, **Then** the control is enabled and the move succeeds.
7. **Given** jobs belonging to a different organization, **When** I load the page, **Then** none of
   them appear (org scoping enforced by RLS, mirrored in the query).

---

### User Story 2 - Exit a job from the pipeline (Priority: P2)

As an organization member, I can exit a job that is not progressing — marking it lost, closed, or
dormant (with a wake date) — so the active board stays honest without ever deleting history, and I
can review exited jobs in a filterable list.

**Why this priority**: Without exits the board silts up with dead enquiries and stops reflecting
reality. Exits are the agreed alternative to deletion (no DELETE policy exists on `jobs` by
design). The Exited list view is the first scope cut if time runs out — the exit modal itself is
not cuttable.

**Independent Test**: Exit a test-org job via each of the three reasons and confirm the correct
exit fields are written, the job leaves the active columns, and it appears in the Exited view; a
dormant exit without a wake date must be rejected before any write.

**Acceptance Scenarios**:

1. **Given** an active pre-paid job, **When** I click its Exit control, **Then** a modal offers
   exactly three reasons: Lost, Closed, Dormant.
2. **Given** I pick Lost or Closed and confirm, **Then** the job's `exit_reason` and `exited_at`
   are written and the job disappears from the active columns.
3. **Given** I pick Dormant, **Then** a wake date is required — confirm is blocked until one is
   set — and confirming writes `exit_reason`, `exited_at`, and `wake_at`.
4. **Given** exited jobs exist, **When** I open the Exited view, **Then** I see them as a
   filterable list (at minimum filterable by exit reason) showing person/handle, reason, exit
   date, and wake date where present.
5. **Given** the Exited view, **Then** no control anywhere offers deletion of a job.

---

### User Story 3 - Add an inbox conversation to the pipeline (Priority: P3)

As an organization member reading a conversation in the unified Inbox that has no job yet
(email / WhatsApp / GHL enquiries arrive with no person and no job), I click "Add to pipeline" and
the system creates the person if needed, links the conversation, and creates a job at
Enquired/uncontacted — so new enquiries enter the pipeline with one click and no duplicate people.

**Why this priority**: This is the intake path for all non-website channels going forward. It is
P3 only because the board (P1) must exist for the created jobs to land anywhere visible; it is
still required for the Monday demo.

**Independent Test**: In a test org, use "Add to pipeline" on (a) a conversation with a linked
person, (b) a conversation with no person whose handle matches no existing person, and (c) one
whose handle matches an existing org person — confirming job creation, person creation/reuse, and
conversation linking respectively.

**Acceptance Scenarios**:

1. **Given** a conversation with no associated job, **When** I view it in the Inbox, **Then** an
   "Add to pipeline" action is available; **Given** a job already exists for the conversation,
   **Then** the action is not offered.
2. **Given** I click "Add to pipeline" on a conversation that already has a `person_id`, **Then** a
   job is created with source = the conversation's channel, stage `enquired`, stage_status
   `uncontacted`, linked to the conversation and person.
3. **Given** the conversation has `person_id = null` and no existing person in **this org**
   matches the conversation handle (email or phone), **Then** a new person is created from the
   handle, the job is created against them, and the conversation is updated with `person_id` and
   `link_state = 'linked'`.
4. **Given** the conversation has `person_id = null` but a person in this org already matches the
   handle by email or phone, **Then** that person is reused — no duplicate is created. The
   duplicate check is **org-scoped, never global** (matching a same-handle person in another org
   must NOT link or leak).
5. **Given** any conversation update performed by this flow, **Then** the update payload does not
   include `updated_at` (PostgREST silently rejects payloads that do).
6. **Given** the newly created job, **When** I open the Pipeline page, **Then** it appears in the
   Enquired column with an `uncontacted` pill.

---

### Edge Cases

- Conversation handle is neither a plausible email nor phone (e.g. a GHL contact ref): person is
  still created org-scoped from the handle; duplicate check simply finds no match. No global
  lookup ever occurs.
- Two users click "Add to pipeline" on the same conversation near-simultaneously: at most one job
  may result; the action must re-check for an existing job before insert (best-effort in V1 — no
  DB uniqueness on conversation is being added this sprint).
- A job's invoice is deleted/voided after the job moved to Invoiced: the job stays where it is;
  the gate applies to the *move*, not retroactively.
- Backfilled jobs (43 SM rows) predate this UI: they must render correctly, including any with
  sparse person data (fallback to `primary_handle`).
- Invoiced-column cards where an invoice exists: show the invoice total when present; absence of a
  total must not break the card.
- A dormant job's `wake_at` passes: no automation this sprint — the job simply remains in the
  Exited view (wake handling is post-sprint).
- Moving back from Invoiced to Quoted: allowed (moves are free pre-paid except the Invoiced-entry
  gate).
- Old `/dashboard/inquiries` deep links: route is taken over by Pipeline — links land on the new
  page rather than 404.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST replace the `/dashboard/inquiries` route and its sidebar entry with
  the Pipeline page, labeled "Pipeline". The old inquiries module's files MUST remain in the tree
  (deletion happens post-cutover, out of this feature).
- **FR-002**: The Pipeline "Before Paid" board MUST show three columns — Enquired, Quoted,
  Invoiced — populated from `jobs` where `exit_reason IS NULL AND paid_at IS NULL`, scoped to the
  user's organization.
- **FR-003**: Each card MUST show: person name (falling back to the linked conversation's
  `primary_handle`), the job's `stage_status` as a pill, and the created date. Invoiced-column
  cards MUST additionally show the invoice total when one is present.
- **FR-004**: Clicking a card MUST open that job's conversation in the Inbox.
- **FR-005**: Users MUST be able to move a job forward/backward between Enquired and Quoted
  freely. Moving a job **into Invoiced** MUST be disabled unless at least one invoice with this
  job's `job_id` exists (app-level gate, per parent-spec decision D4).
- **FR-006**: An Exit action MUST open a modal offering Lost / Closed / Dormant. Dormant MUST
  require a wake date before confirmation. Confirming MUST write `exit_reason`, `exited_at`, and
  (dormant only) `wake_at` on the job.
- **FR-007**: An Exited view MUST list exited jobs as a filterable list. No delete capability may
  be exposed anywhere for jobs.
- **FR-008**: The Inbox MUST offer an "Add to pipeline" action on conversations that have no
  associated job, and not offer it when a job exists.
- **FR-009**: "Add to pipeline" MUST create a job with source = conversation channel, stage
  `enquired`, stage_status `uncontacted`, linked to the conversation and its person.
- **FR-010**: When the conversation's `person_id` is null, the flow MUST first resolve a person:
  check for an existing person **within the organization** matching the conversation handle by
  email or phone (NEVER a global lookup); reuse on match, otherwise create a person from the
  handle. It MUST then set the conversation's `person_id` and `link_state = 'linked'`.
- **FR-011**: Conversation update payloads in this feature MUST NOT include `updated_at`
  (PostgREST silently rejects such updates).
- **FR-012**: `src/shared/types/database.types.ts` MUST be extended with the `jobs` table types
  and the `job_id` columns on `orders` and `invoices`, hand-extended to match the file's existing
  conventions if CLI type generation is unavailable. This is a prerequisite for all other work.
- **FR-013**: The feature MUST NOT create or alter any database schema, MUST NOT modify
  `enquiry_stage` or any code referencing it, and MUST NOT change orders/invoices write paths
  (the sidebar order/invoice `job_id` wiring is parent-spec §4 bullet 3, explicitly out of this
  feature).

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: The route swap MUST preserve the coexistence of `src/app/`
  (shell/router wiring) and `src/pages/` (`Dashboard.tsx` hosts nested routes); the Pipeline page
  slots into the existing nested-route structure exactly where Inquiries sat.
- **AC-002 (Module boundaries)**: New feature code lives in `src/modules/<feature>/` with the
  existing `api/` / `components/` / `hooks/` / `types/` layout; no deep imports into other
  modules' internals; shared code goes to `src/shared/`. Styling uses the existing `gardens-*`
  design tokens.
- **AC-003 (RLS as boundary)**: Org isolation is enforced by the existing `jobs_org_*` RLS
  policies (`user_is_member_of_org`); UI/query org filters are UX, not security. There is no
  DELETE policy on `jobs` — the UI must not attempt deletes.
- **AC-004 (Production data)**: Churchill and Sears Melvin are live orgs. No manual writes to
  their data during development; testing of write flows (moves, exits, add-to-pipeline) happens
  in test orgs only.

### Key Entities

- **Job** (`jobs`, exists in prod): the pipeline unit. One job per enquiry; holds ≥1 orders; one
  invoice covers the job. Key attributes: `organization_id`, stage (enum `enquired` →
  `complete`), `stage_status`, `person_id`, conversation link, `paid_at`, `exit_reason`,
  `exited_at`, `wake_at` (DB constraints already enforce dormant-needs-wake and exit-field
  pairing). Stage lives on jobs only.
- **Conversation** (`inbox_conversations`): inbox thread; supplies `primary_handle` fallback and
  channel (job source); gains `person_id` + `link_state='linked'` via Add-to-pipeline.
- **Person** (`people`): customer identity; created from a conversation handle when missing, with
  org-scoped email/phone dedupe.
- **Invoice** (`invoices`): its `job_id` presence gates the move into Invoiced and supplies the
  Invoiced-card total. Read-only in this feature.
- **Order** (`orders`): carries `job_id` (typed here, not written here).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With production SM data, the Pipeline page shows all 43 backfilled jobs in the
  correct columns (23 Enquired / 20 Quoted at backfill state) with zero jobs from other orgs.
- **SC-002**: A user can take a fresh inbound conversation from "no person, no job" to a visible
  Enquired card in a single "Add to pipeline" click, with zero duplicate person rows created for
  handles already known to the org.
- **SC-003**: 100% of attempts to move a job into Invoiced without a linked invoice are blocked
  in the UI; 100% of dormant exits carry a wake date (DB constraint would reject them anyway —
  the UI never lets it get that far).
- **SC-004**: No job row is ever hard-deleted; every exited job remains retrievable in the Exited
  view.
- **SC-005**: `npx tsc -p tsconfig.app.json` reports zero new errors over the 59-error baseline;
  `vite build` passes (noting it does not typecheck).
- **SC-006**: The feature is demoable on the Monday call: board + moves + exit + add-to-pipeline
  end to end.

## Assumptions

- The `jobs` schema, RLS policies, indexes, and SM backfill are applied in production exactly as
  recorded in `20260801210000_jobs_pipeline_schema.sql` and `20260801213000_jobs_backfill_sm.sql`;
  no schema work of any kind belongs to this feature.
- Jobs reference their conversation (per parent spec §3.1, "every job with person + conversation"),
  so card fallback and card-click navigation resolve through the job's linked conversation.
  RESOLVED during planning (verified in `20260801210000_jobs_pipeline_schema.sql`): link columns
  are `jobs.conversation_id`, `jobs.person_id`, `jobs.enquiry_id`, plus `orders.job_id` and
  `invoices.job_id` — see `research.md` R1.
- "Person name" comes from the existing `people` table naming fields as used elsewhere in the app
  (e.g. inbox linking UI); the same display convention is reused.
- The After Paid tab (read-only post-paid labels) and Orders-page `order_type <> 'quote'`
  filtering are parent-spec §5 items but are NOT in this feature's scope unless trivially
  co-located; the user description scopes this feature to Before-Paid + intake. They remain on
  the parent spec's list.
- The Exited view ships in this feature; per the parent spec it is the designated first scope cut
  if time runs out (modal is never cut).
- Invoice existence for the Invoiced gate is checked at move time via a read of invoices by
  `job_id`; no realtime subscription is required for V1.
- Website intake (extending `trg_sync_enquiry_to_inbox` to insert jobs) is a Dashboard/DB task in
  parent spec §4 and is explicitly NOT part of this app-side feature.
- Wake-date automation for dormant jobs (resurfacing at `wake_at`) is post-sprint; this feature
  only records the date.

## Out of Scope (from user description and parent spec §6)

- Any schema/migration work; `enquiry_stage` retirement or drop.
- Deleting the old inquiries module files (post-cutover cleanup).
- Orders/invoices write-path changes, including sidebar order/invoice creation wiring (`job_id`
  on new orders/invoices — parent spec §4 bullet 3).
- After Paid interactive gates; `create_quote` / `people_email_key` org-scope rewrite; portal
  rebuild; Churchill intake; §3.3 Arin worksheet backfill.
