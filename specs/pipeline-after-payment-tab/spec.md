# Feature Specification: Pipeline After-Payment Tab

**Feature Branch**: `feature/pipeline-after-payment-tab`
**Created**: 2026-08-06
**Status**: Draft
**Input**: User description: "Pipeline page: after-payment tab. Second main tab on the Jobs
Pipeline page ('After payment' alongside the existing before-payment board and the existing
Exit tab), showing jobs in the four post-paid stages as four columns: confirmed,
in_production, fixed, complete."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See paid jobs again on an After-payment board (Priority: P1)

A mason (Arin) has taken payment on jobs and moved them to `confirmed`. Today those jobs
vanish from the Pipeline page entirely — the before-payment board deliberately drops
post-paid stages. He opens the Pipeline page, clicks the new **After payment** tab, and sees
a four-column board — Confirmed, In production, Fixed, Complete — with each paid job as a
card in its stage column. For Sears Melvin today that means the 8 customers who placed this
week (Barnett, Marshall, Henry, Campbell, Hazrati, Lindsey, Faith, Dean) reappear under
Confirmed.

**Why this priority**: This is Arin's "main next step" ask from the 3 Aug call and the
headline moment of the Friday demo — paid customers becoming visible again. Without it the
tab has no reason to exist.

**Independent Test**: Log in as a Sears Melvin user, open Pipeline → After payment. The 8
confirmed+paid jobs render as cards under Confirmed; In production, Fixed, and Complete
columns render empty. Churchill shows an empty state (0 post-paid jobs). No before-paid job
appears on this tab.

**Acceptance Scenarios**:

1. **Given** an org with jobs at stages `confirmed`, `in_production`, `fixed`, or `complete`,
   **When** the user opens the After payment tab, **Then** each such job appears exactly once,
   in the column matching its `stage`, org-scoped.
2. **Given** the Sears Melvin org as of 06 Aug 2026, **When** the After payment tab loads,
   **Then** 8 cards render under Confirmed and 0 under the other three columns, and the tab
   header shows a total of 8.
3. **Given** a job with `paid_at` set but stage still `invoiced` (mid-transition), **When**
   either tab loads, **Then** the job appears on the **before-payment** board only — stage
   decides tab membership; `paid_at` is data shown, not a router (matches the Orders-page
   semantics shipped in Task A).
4. **Given** an org with zero post-paid jobs, **When** the After payment tab loads, **Then**
   an empty state renders (no error, no blank screen).
5. **Given** an exited job (`exit_reason` set) whose stage is post-paid, **When** the After
   payment tab loads, **Then** the job does **not** appear there — it belongs to the Exited
   view, same as the before-payment board's treatment of exited jobs.

---

### User Story 2 - Manually move a job through the post-paid stages (Priority: P2)

After payment, work progresses physically: the memorial goes into production, gets fixed
(installed), then the job is complete. The mason moves the card forward (and, if he
mis-clicked, backward) between the four post-paid columns using the same move buttons as the
before-payment board. All moves are manual — no automations.

**Why this priority**: Movement is what makes it a working board rather than a static list.
Secondary to visibility (P1) because on demo day all 8 jobs sit at Confirmed and the moves
can be demonstrated live.

**Independent Test**: Move a confirmed job forward to In production, then Fixed, then
Complete; move it back one column. Each move persists (survives reload) and the card changes
column immediately.

**Acceptance Scenarios**:

1. **Given** a job at `confirmed`, **When** the user clicks move-forward, **Then** its stage
   becomes `in_production` and the card moves to that column (and so on through `fixed` →
   `complete`).
2. **Given** a job at `complete`, **When** the card renders, **Then** no move-forward action
   is offered.
3. **Given** a job at `in_production`, `fixed`, or `complete`, **When** the user clicks
   move-back, **Then** the job moves one column left within the after-paid board.
4. **Given** a job at `confirmed` (leftmost after-paid column), **When** the card renders,
   **Then** no move-back action is offered — backward movement out of the after-paid axis
   (confirmed → invoiced) is **disallowed** (see FR-009 for rationale).
5. **Given** any move in flight, **When** the mutation is pending, **Then** move buttons are
   disabled (same in-flight behavior as the existing board).

---

### User Story 3 - Exit a post-paid job (Priority: P3)

Sometimes a paid job stops: the customer cancels, or the job must go on hold. The mason uses
the same Exit action on a card in the After payment tab as on the before-payment board, and
the exited job moves to the existing Exited view.

**Why this priority**: Needed for completeness and parity, but rare on day one (0 such cases
in live data) and not part of the demo's headline.

**Independent Test**: Exit a post-paid job with reason `cancelled`; confirm it disappears
from the After payment tab and appears in the Exited view with its exit timestamp.

**Acceptance Scenarios**:

1. **Given** a post-paid job, **When** the user opens the Exit action, **Then** the exit
   flow works identically to the before-payment board's mechanics, but the reasons
   offered are the post-paid pair `on_hold` and `cancelled` only (the pre-paid modal
   continues to offer `lost`/`closed`/`dormant`; see FR-011).
2. **Given** the parameterized modal is used from the before-payment board, **When** exiting as
   `dormant`, **Then** `wake_at` is still required — the parameterization must not loosen the pre-paid rules.
3. **Given** any exit, **When** confirmed, **Then** `exited_at` is set (paired-CHECK rule)
   and the job leaves the After payment board and appears in the Exited view.

---

### User Story 4 - Tab totals at a glance (Priority: P3)

The mason sees how many jobs sit on each side of payment without opening each tab: the
before-payment tab header shows its total (sum of enquired/quoted/invoiced) and the After
payment tab header shows its total (sum of the four post-paid columns).

**Why this priority**: Small but visible polish; reinforces the demo story ("8 after
payment").

**Independent Test**: With Sears Melvin data, tab headers read Before payment 40 (21+17+2)
and After payment 8.

**Acceptance Scenarios**:

1. **Given** jobs across all stages, **When** the Pipeline page loads, **Then** each of the
   two board tabs shows a count equal to the sum of its own columns.
2. **Given** a job is moved or exited, **When** the mutation settles, **Then** both tab
   counts reflect the new distribution.

### Edge Cases

- **Post-paid stage with `paid_at` NULL** (shouldn't exist; the DB does not prevent it; live
  read on 06 Aug confirms zero such rows): the job **renders normally in its stage column
  with a visible "not marked paid" warning indicator** on the card. It must never silently
  vanish (Task A precedent: no row is ever dropped by a join/filter design). Rationale:
  hiding it would repeat the exact bug this feature fixes; rendering with a warning surfaces
  the data problem to the person who can fix it.
- **`paid_at` set but stage before-paid**: stays on the before-payment board until its stage
  moves. Stage is the membership gate on both tabs; `paid_at` is displayed data only.
- **Exited job at a post-paid stage**: excluded from the After payment board, shown in the
  Exited view — exits are a separate axis from stage.
- **Zero post-paid jobs** (Churchill today): tab renders an empty state, not an error.
- **Query error**: the After payment tab shows the same error treatment as the existing
  board (message panel, no crash).
- **Concurrent move**: move buttons disabled while a move is pending, matching the existing
  board.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Pipeline page MUST offer three views: the existing before-payment board,
  a new **After payment** board, and the existing Exited view. The page subtitle/copy MUST
  no longer imply the page shows only before-payment jobs.
- **FR-002**: The After payment board MUST render exactly four columns in order:
  Confirmed, In production, Fixed, Complete — the DB CHECK-constrained post-paid stages
  `confirmed`, `in_production`, `fixed`, `complete`.
- **FR-003**: A new `AFTER_PAID_STAGES` constant MUST be introduced as a **sibling** of
  `BEFORE_PAID_STAGES` (in `jobsPipeline.types.ts`). `BEFORE_PAID_STAGES` MUST NOT be
  extended — they are different axes of the same seven-stage vocabulary (same lesson as
  Task A's `orderGrouping`, in reverse).
- **FR-004**: Membership gate for the After payment board is `stage IN AFTER_PAID_STAGES`
  (and not exited). `paid_at` MUST NOT be used to route jobs between tabs.
- **FR-005**: A post-paid job with `paid_at` NULL MUST render normally in its stage column
  with a visible warning indicator ("not marked paid"); it MUST NOT be dropped.
- **FR-006**: Moves between the four post-paid columns MUST be manual, using the same
  move-buttons pattern and the existing move mutation, parameterized by stage list rather
  than duplicating the board. No stage automations are part of this feature.
- **FR-007**: Forward moves MUST stop at `complete` (no forward action on the last column).
- **FR-008**: Backward moves MUST be allowed within the after-paid columns
  (`complete` → `fixed` → `in_production` → `confirmed`).
- **FR-009**: Backward movement out of the after-paid axis (`confirmed` → `invoiced`) is
  **disallowed** — the Confirmed column offers no move-back action. Rationale: the job has
  been paid; moving its stage back to `invoiced` would make the Orders page (Task A:
  badges derived from stage) show a paid customer as merely "Invoiced", making stage
  contradict money reality. Undoing a wrongly-confirmed job is a rare data-fix, not a
  board action. If Arin asks for it on Friday, revisit as a follow-up with a confirmation
  dialog — record the ask, don't build it now.
- **FR-010**: Exit actions MUST be available on After payment cards and behave identically
  to the before-payment board: `exited_at` set on exit, `wake_at` required for `dormant`,
  exited jobs move to the Exited view.
- **FR-011**: The exit flow from the After payment tab MUST offer only the post-paid exit
  reasons `on_hold` and `cancelled` — not the pre-paid three (`lost`/`closed`/`dormant`).
  Exits are phase-split by design: prospects are lost, paying customers are held or
  cancelled (this is why the existing type is named `PrePaidExitReason`). The DB CHECK
  permits all five on any job, so this split is UI policy and MUST be enforced by the
  modal. Parameterize the existing exit modal by job phase rather than forking it; the
  before-paid board's offered set (`lost`/`closed`/`dormant`) is unchanged. Since
  `dormant` is pre-paid-only, the `wake_at` requirement never arises on the after-paid
  path — but the parameterized modal MUST keep that rule intact for the pre-paid path.
- **FR-012**: Each board tab's header MUST show its total: before-payment = sum of its three
  columns (already computed), after-payment = sum of its four columns.
- **FR-013**: Column headers on the new board MUST use `formatStageLabel` from
  `utils/display.ts` (e.g. `in_production` → "In production"), not a new local label map.
  The existing board's local `STAGE_LABEL` record (`PipelineBoard.tsx` line 13) produces
  labels identical to `formatStageLabel` for its three stages, so consolidating the
  existing board onto `formatStageLabel` is **in scope**.
- **FR-014**: All queries MUST be org-scoped (RLS + explicit `organization_id` filter as
  per the existing pipeline queries). No schema changes are expected or permitted in this
  feature.
- **FR-015**: The Exited view's "due dormant" badge behavior on the tab switcher MUST be
  preserved unchanged.

### Architectural Constraints

- **AC-001 (Module boundaries)**: All new code lives in `src/modules/jobsPipeline/`
  (components, hooks, types). No other feature module is touched; specifically, no
  Orders-page change.
- **AC-002 (Reuse over duplication)**: The new board MUST reuse `PipelineColumn`,
  `PipelineJobCard`, `formatStageLabel`, and the existing move mutation, parameterized by
  stage list. A copy-pasted second board component is a spec violation.
- **AC-003 (RLS as boundary)**: Authorization is enforced by RLS in the database; UI
  filtering is presentation only.
- **AC-004 (Axis separation)**: Stage (7 values), payment (`paid_at`), and exit
  (`exit_reason`/`exited_at`/`wake_at`) are three separate axes. No requirement in this
  feature may collapse one into another (no stage inferred from `paid_at`, no exit
  inferred from stage).

### Key Entities

- **Job (`jobs`)**: The pipeline unit. Relevant attributes: `stage` (CHECK-constrained
  seven-value vocabulary: `enquired`, `quoted`, `invoiced` | `confirmed`, `in_production`,
  `fixed`, `complete`), `paid_at` (timestamp, displayed not routed on), `exit_reason` /
  `exited_at` / `wake_at` (exit axis, paired CHECKs), `organization_id` (tenancy),
  embedded person and conversation summaries for card display.
- **Stage lists**: `BEFORE_PAID_STAGES` (existing, unchanged) and `AFTER_PAID_STAGES`
  (new sibling) — two ordered subsets partitioning the active-stage vocabulary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the After payment tab, Sears Melvin shows exactly 8 cards (all under
  Confirmed, matching the 06 Aug live read: Barnett, Marshall, Henry, Campbell, Hazrati,
  Lindsey, Faith, Dean) and Churchill shows an empty state — demonstrable in the Friday
  call with Arin.
- **SC-002**: Every job in the live dataset appears on exactly one of: before-payment
  board, after-payment board, or Exited view — no job is invisible on the Pipeline page
  (verifiable: tab totals + exited count equals the org's total job count).
- **SC-003**: A job can be moved confirmed → in_production → fixed → complete and back to
  confirmed entirely from the UI, each move persisting across reload, with zero direct DB
  edits.
- **SC-004**: A post-paid job can be exited as `on_hold` or `cancelled` (the only reasons
  offered post-paid) from the After payment tab and appears in the Exited view; the
  before-payment exit flow is unchanged, including `dormant` requiring a wake date.
- **SC-005**: `npx tsc --noEmit -p tsconfig.app.json` introduces zero new type errors over
  the 55-error baseline.

## Assumptions

- The three-way view switcher replaces the current two-value `active`/`exited` toggle on
  `JobsPipelinePage`; "active" is renamed/relabeled to "Before payment" (exact label
  wording is a design call at plan time, but the three tabs are Before payment / After
  payment / Exited in that order).
- The existing move mutation (`useMoveJobStage` / `jobsPipeline.api.ts`) validates moves
  against `BEFORE_PAID_STAGES` indices today; parameterizing it by stage list is an
  internal refactor with no behavior change for the existing board.
- The invoice-gate rule ("Needs a linked invoice" before moving into `invoiced`) is a
  before-paid-board concern only; no analogous gate exists between post-paid columns.
- `useJobsPipeline`'s current comment ("Post-paid stages with a null paid_at shouldn't
  exist; render only the three columns") describes the before-paid board's own filter and
  stays true for that board; the after-paid data need is served either by a parameterized
  version of the hook or a sibling hook — a plan-time decision, not a spec concern.
- Card content (name chain, dates, invoice total where linked) carries over as-is from
  `PipelineJobCard`; no new card fields are required for v1. `paid_at` may already be
  displayed by the card; if not, showing it on after-paid cards is optional polish, not a
  requirement.
- Zero rows currently violate the post-paid-with-null-`paid_at` invariant (live read
  06 Aug 2026), so the FR-005 warning path ships dark and is testable only with a test-org
  fixture.
- Stage automations (order-created→quoted, invoice-created→invoiced), inbox filters,
  customer labels on people, multi-job dropdowns per conversation, and any Orders-page
  change are explicitly out of scope.
- No schema changes; nothing to run in the Supabase dashboard for this feature.
