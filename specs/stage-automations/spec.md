# Feature Specification: Stage Automations — order-created → quoted, invoice-created → invoiced

**Feature Branch**: `feature/stage-automations`
**Created**: 2026-08-07
**Status**: Draft
**Input**: User description: "Stage automations: order-created → quoted, invoice-created → invoiced. Automatically advance a job's pipeline stage when an order or invoice is created against it." (Blessed by Arin on the 3 Aug call — "can we automate that if we do the invoice?" This revises the old "stage moves are manual only" rule for these two transitions ONLY; all other moves — post-paid moves, confirmed, exits — stay manual.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invoice created → job auto-advances to 'invoiced' (Priority: P1)

A user creates an invoice against a job (via CreateInvoiceDrawer, which passes `job_id`). After the invoice is created successfully, the job's pipeline stage automatically advances to `invoiced` — no manual board drag needed. The job's card visibly jumps columns on the pipeline board.

**Why this priority**: This is the transition Arin explicitly asked to automate, and the demo moment for the Friday call: create an invoice from the drawer, watch the card jump columns. It delivers the core value on its own.

**Independent Test**: On a test org, put a job at `enquired` or `quoted`, create an invoice against it from the drawer, and observe the job land in the `invoiced` column without any manual stage move. The invoice record exists regardless of whether the advance succeeded.

**Acceptance Scenarios**:

1. **Given** a job at `quoted` with no exit reason, **When** an invoice is created against it, **Then** the job's stage becomes `invoiced` and the pipeline board (active + after-paid tabs) refreshes to show the card in the new column.
2. **Given** a job at `enquired` with no exit reason, **When** an invoice is created against it, **Then** the job jumps directly to `invoiced` (a two-step jump is expected — this automation is not bound by the board's same-axis-adjacency rule).
3. **Given** a job already at `invoiced` (or any later/post-paid stage such as `confirmed`, `in_production`, `fixed`, `complete`), **When** another invoice is created against it, **Then** the job's stage does not change.
4. **Given** a job with `exit_reason` set, **When** an invoice is created against it, **Then** the job's stage does not change (exited jobs are never auto-moved).
5. **Given** a job in any state, **When** invoice creation succeeds but the stage advance fails (network error, job deleted concurrently), **Then** the invoice record survives untouched and the user sees at most a quiet log/toast — creation is never failed or rolled back by the automation.

---

### User Story 2 - Order created → job auto-advances to 'quoted' (Priority: P2)

A user creates an order linked to a job. After the order is created successfully, the job automatically advances to `quoted` if it is currently earlier than `quoted` on the before-paid axis.

**Why this priority**: Same automation family and shares all machinery with Story 1, but the invoiced transition is the one Arin named and the one being demoed. Quoted is the natural companion.

**Independent Test**: On a test org, put a job at `enquired`, create an order with that `job_id`, and observe the job move to `quoted`. Create an order with no `job_id` and observe no stage activity at all.

**Acceptance Scenarios**:

1. **Given** a job at `enquired` with no exit reason, **When** an order carrying that `job_id` is created, **Then** the job's stage becomes `quoted`.
2. **Given** an order created with no `job_id`, **When** creation succeeds, **Then** no stage automation fires (no-op, no error).
3. **Given** a job at `quoted` or any later stage (including post-paid stages), **When** a second order is created against it, **Then** the job's stage does not change — a later-stage job is never dragged backward.
4. **Given** a job with `exit_reason` set, **When** an order is created against it, **Then** the job's stage does not change.

---

### User Story 3 - Quote-to-order conversion triggers the same 'quoted' automation (Priority: P3)

Converting a quote to an order produces an order; the same order-created automation applies to the resulting order's job.

**Why this priority**: Completes coverage of order-producing paths in the UI, but is a secondary entry point compared to direct creation.

**Independent Test**: Convert a quote whose resulting order carries a `job_id` for a job at `enquired`; the job moves to `quoted`. Convert one whose order has no `job_id`; nothing fires.

**Acceptance Scenarios**:

1. **Given** a quote whose conversion produces an order with a `job_id` for a job at `enquired`, **When** the conversion succeeds, **Then** the job advances to `quoted`.
2. **Given** a conversion producing an order with no `job_id`, **When** it succeeds, **Then** the automation no-ops.

---

### User Story 4 - Combined drawer submission fires both automations, net result 'invoiced' (Priority: P2)

CreateInvoiceDrawer can inline-create an order (stamping `job_id`) AND the invoice in one submission. Both automations fire on the same job — order → `quoted`, invoice → `invoiced`. Forward-only ordering makes the net result `invoiced` regardless of which fires first. This is expected behavior, not a race defect.

**Why this priority**: It is a real, reachable UI path that exercises both automations at once; without a named expectation it would look like a bug in review.

**Independent Test**: From CreateInvoiceDrawer on a job at `enquired`, inline-create an order and submit the invoice in one go; the job ends at `invoiced`.

**Acceptance Scenarios**:

1. **Given** a job at `enquired`, **When** a single drawer submission inline-creates an order and creates an invoice against the job, **Then** both automations fire and the job's final stage is `invoiced` regardless of fire order (if `quoted` lands first, `invoiced` advances past it; if `invoiced` lands first, the `quoted` fire no-ops as backward).

---

### Edge Cases

- **Job not found** (deleted, or `job_id` pointing outside the caller's org): the org-scoped fetch returns nothing → silent no-op. Cross-org advancement is impossible by construction.
- **Repeated fires on the same job** (second order, third invoice): forward-only rule (`indexOf(current) >= indexOf(target)` within `BEFORE_PAID_STAGES` → no-op) makes the automation idempotent.
- **Post-paid jobs**: stage not in `BEFORE_PAID_STAGES` → no-op. A second order/invoice on a `confirmed`/`in_production`/`fixed`/`complete` job must never drag it back to the before-paid axis.
- **Exited jobs**: `exit_reason IS NOT NULL` → no-op, checked before any stage comparison.
- **Advance failure after successful creation**: the created order/invoice always survives; the automation fires only after creation succeeds, and its failure is isolated (log/quiet toast at most).
- **Website-created orders bypass the automation** (they don't go through the client-side mutation): acceptable — the website flow is being repurposed to create jobs-not-orders (settled 3 Aug decision, separate task).
- **D4 invoiced-gate interaction — deliberate, not a contradiction**: the board's MANUAL move into `invoiced` requires a linked invoice to exist. The automation's advance to `invoiced` fires BECAUSE an invoice was just created on the job — it satisfies the gate's intent by construction and deliberately does not re-run the gate's check.
- **Jump moves are expected**: an invoice on an `enquired` job goes `enquired → invoiced` directly. This function is NOT `moveJobStage` and must not reuse its same-axis-adjacency validation; it has its own forward-only rule. `moveJobStage` is not modified.
- **Pre-existing data**: exactly 1 Sears Melvin job sits at `enquired` with an order attached (would have been `quoted` had this existed). Backfill is OUT OF SCOPE — a separate decision; the automation only acts on future creations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically advance a job's stage to `quoted` when an order carrying that job's id is successfully created via the client-side creation mutation (`useCreateOrder`) or quote-to-order conversion (`useConvertQuoteToOrder`).
- **FR-002**: The system MUST automatically advance a job's stage to `invoiced` when an invoice carrying that job's id is successfully created via the client-side creation mutation (`useCreateInvoice`).
- **FR-003**: The automation MUST be implemented as a single core function `autoAdvanceJobStage({ organizationId, jobId, targetStage })` owned by the `jobsPipeline` module (which owns stage semantics) and exported through that module's public surface for the orders/invoicing modules to call.
- **FR-004**: `targetStage` MUST accept only `'quoted'` and `'invoiced'` — the two blessed automations — and the type MUST make other targets unrepresentable.
- **FR-005**: The automation MUST fetch the job org-scoped; a job not found MUST be a silent no-op.
- **FR-006**: The automation MUST no-op when the job's `exit_reason` is not null (exited jobs are never auto-moved).
- **FR-007**: The automation MUST no-op when the job's current stage is not in `BEFORE_PAID_STAGES` (post-paid jobs are never dragged back).
- **FR-008**: The automation MUST be forward-only within BEFORE_PAID_STAGES, and this guard MUST be encoded in the UPDATE statement's WHERE predicate itself — the update matches only jobs whose current stage is strictly earlier than the target on the before-paid axis, with exit_reason IS NULL and the org guard in the same predicate. Check-and-write is one atomic statement: concurrent fires (e.g. the drawer's order+invoice double-fire) cannot interleave a backward write. A pre-fetch MAY exist for logging only; it is not the correctness boundary.
- **FR-009**: When the guarded UPDATE matches (rows affected = 1), the calling mutation MUST invalidate the pipeline query keys (active + afterPaid) and orders byJob as appropriate. Zero rows affected = the no-op cases (already at/past target, exited, post-paid, not found) — silent, no error.
- **FR-010**: Automation failure MUST NOT fail, block, or roll back the order/invoice creation. It fires only after creation succeeds; failures surface at most as a quiet log/toast; the created record always survives.
- **FR-011**: The order-created automation MUST fire only when the created order carries a `job_id` (in `useCreateOrder`'s existing `data.job_id` branch at `src/modules/orders/hooks/useOrders.ts:211`; same rule for conversion at `:227`). Orders without `job_id` MUST cause no stage activity.
- **FR-012**: All stage moves other than these two automations MUST remain manual and unchanged — post-paid moves, `confirmed`, and exits are untouched, and `moveJobStage` MUST NOT be modified.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Client-side only)**: Implementation lives entirely in the creation mutations' onSuccess paths. No schema changes, no DB triggers, no Dashboard work in this feature. A DB trigger covering non-UI insert paths is a noted hardening follow-up, out of scope.
- **AC-002 (Module boundaries)**: Stage-advance logic MUST live in the `jobsPipeline` module under `src/modules/` and be consumed by the orders/invoicing modules only through the jobsPipeline module's public surface — no deep imports of its internals.
- **AC-003 (Org scoping as boundary)**: Every read and write MUST be scoped by `organization_id`; the org-scoped fetch and org-guarded UPDATE are the correctness boundary, with RLS behind them. UI checks are not security.
- **AC-004 (Type-check gate)**: `npx tsc --noEmit -p tsconfig.app.json` MUST stay at the 55-error baseline — zero new errors.

### Key Entities *(include if feature involves data)*

- **Job**: pipeline-tracked work item; relevant attributes: `stage` (position on the before-paid axis `BEFORE_PAID_STAGES` or post-paid stages), `exit_reason` (non-null = exited, frozen to automation), `organization_id` (tenancy scope). The only entity whose state this feature mutates.
- **Order**: created against a job via optional `job_id`; its successful creation is the trigger for the `quoted` automation. Not modified by this feature.
- **Invoice**: created against a job via `job_id` (CreateInvoiceDrawer passes it); its successful creation is the trigger for the `invoiced` automation. Not modified by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Creating an invoice from the drawer on a before-paid, non-exited job lands the job in the `invoiced` column with zero manual stage moves, and the board reflects it without a page reload (the Friday-demo moment).
- **SC-002**: Creating an order with a `job_id` on an `enquired`, non-exited job lands the job at `quoted` with zero manual moves.
- **SC-003**: 100% of order/invoice creations survive independently of automation outcome — no creation is ever failed or rolled back by a stage-advance failure.
- **SC-004**: Zero backward or off-axis auto-moves: post-paid, exited, and already-at-or-past-target jobs are unchanged after any number of order/invoice creations.
- **SC-005**: The combined drawer submission (inline order + invoice) deterministically ends with the job at `invoiced`.
- **SC-006**: Type-check gate holds: `npx tsc --noEmit -p tsconfig.app.json` reports exactly the 55 pre-existing errors, zero new.

## Assumptions

- Client-side onSuccess coverage of the three UI hook points (`useCreateOrder` at `src/modules/orders/hooks/useOrders.ts:194`, `useConvertQuoteToOrder` at `:227`, `useCreateInvoice` at `src/modules/invoicing/hooks/useInvoices.ts:43`) is sufficient for this feature; non-UI insert paths (website, webhooks, direct DB) are knowingly uncovered until the follow-up DB trigger.
- Website-created orders bypassing the automation is acceptable because the website flow is being repurposed to create jobs-not-orders (settled 3 Aug decision, separate task).
- Backfill of historical inconsistencies (including the 1 known Sears Melvin job at `enquired` with an order) is out of scope — a separate decision.
- The D4 invoiced-gate's intent is satisfied by construction when the automation advances to `invoiced` (an invoice was just created on that job); the gate's check is deliberately not re-run.
- The `BEFORE_PAID_STAGES` ordering owned by the jobsPipeline module is the authoritative forward-only ordering for these automations.
- Work happens on `feature/stage-automations` (off `staging` at 1512ac3, which includes the after-payment tab feature); merge to `staging` only after full verification.
- Out of scope: DB triggers, website/webhook insert paths, backfill, any change to `moveJobStage` or the boards, inbox filters, customer labels, schema changes.
