# Quickstart (Phase 1): Manual verification walkthrough

Target: SM org (LIVE — real orders; treat per multi-tenancy guardrails). All SQL below is
**read-only** unless marked FIXTURE. Anything that creates rows follows the established
disposable-SM-fixture pattern: UI-created, ids tracked here at run time, cleanup by approved
`DELETE … RETURNING id` afterwards. **Creating an invoice from the drawer creates a live
Stripe invoice — void it during cleanup.**

## Gates (before any manual pass)

```bash
npx tsc --noEmit -p tsconfig.app.json   # must report exactly 55 errors (baseline), zero new
npm run lint
npm run dev
```

## US-1 — Switch between jobs (read-only, live data OK)

Fixture: SM person `d4b7a8ac…` (4 jobs), secondary `1869c23c…` (2 jobs).

1. Inbox → Customers view → open the 4-job person's conversation.
2. Header shows the **job picker** (not the single "In pipeline:" chip). Open it:
   - 4 entries, newest first; labels `Job N — <order type> — <Stage>` (Job numbering:
     oldest = Job 1); any exited job shows the Exited pill.
   - Default highlighted entry = newest **active** job (FR-2).
3. Select an older job → right sidebar order list + order context show **only** that job's
   order(s). Verify expected pairing against:
   ```sql
   select j.id, j.stage, j.exit_reason, j.created_at, o.id as order_id, o.order_type
   from jobs j left join orders o on o.job_id = j.id
   where j.person_id = '<d4b7a8ac-full-id>' and j.organization_id = '<SM-org-id>'
   order by j.created_at asc;
   ```
4. Switch back and forth — no refetch spinner beyond React Query background refresh; no
   console errors.

## US-2 — Create order/invoice against the selected job (FIXTURE — approval required)

⚠️ Writes to live SM. Use a **disposable fixture person/conversation** (existing pattern),
never the real multi-job people. Record created ids here during the run.

**Fixture vehicle (recorded at T008, 2026-08-09)**: job `c6d65fc8…` on person `7658eef5…`
(conversation `5a378f1e…`), created during the FR-6 browser check and KEPT for this run per
Giorgi's decision. ⚠️ The person is REAL (owns live orphan ORD-000232, £3,600) — cleanup
deletes job `c6d65fc8` and any orders/invoices created against it ONLY; never the person,
the conversation, or ORD-000232.

**RUN COMPLETE (2026-08-10)**: T010 + T012 executed and torn down in full. Stripe invoice
`in_1U2c5H…` voided (Mason's own stripe-void-invoice path) before row deletion; person
`7658eef5…` verified restored to exactly one real job (quoted, ORD-000239). Teardown order
(FK `orders_invoice_id_fkey`, no cascade): null `orders.invoice_id` → delete invoice →
delete order → delete job. All SC-002/FR-6/D7/US-4/FR-2 checks passed.

1. On the fixture conversation create two jobs ("Add to pipeline", then "New job").
2. Select **Job 1** (the older one) in the picker.
3. "New order" → create a minimal order. Verify:
   ```sql
   select id, job_id, order_type from orders where id = '<created-order-id>';
   -- job_id must equal Job 1's id (SC-002)
   ```
4. "Create invoice" (covers the uninvoiced Job 1 order). Verify target + automation scope:
   ```sql
   select id, job_id from invoices where id = '<created-invoice-id>';         -- Job 1's id
   select id, stage from jobs where conversation_id in (…fixture ids…);
   -- Job 1 advanced by stage automation; Job 2 stage UNCHANGED (US-2)
   ```
5. Cleanup (approved DELETE … RETURNING id): void the Stripe invoice, then remove invoice,
   order, jobs, fixture person/conversation. Paste RETURNING output below.

- Run record: created ids: ______ · cleanup output: ______

## US-3 — New job lands selected (part of the US-2 fixture run)

"New job" on the fixture conversation → picker auto-selects the new job (FR-6): picker trigger
shows the new job's label; sidebar shows its (empty) order state, not Job 1's orders.

## US-4 — Exited job reachable (read-only)

Pick any SM person with an exited job (or exit one on the US-2 fixture before cleanup):
picker entry shows Exited pill; selecting it shows its orders; **no "New order"/"Create
invoice" buttons** while an exited job is selected (D7).

## Edge cases

- **Zero jobs**: unlinked/no-job conversation → no picker; existing "Add to pipeline"
  affordance and empty-state text unchanged.
- **Exactly one job**: header shows the static "In pipeline: <stage>" chip — visually
  identical to pre-change (D2/SC-003). Compare against a `staging` checkout if in doubt.
- **Selected job has no orders**: existing empty state, not other jobs' orders.
- **All jobs exited**: default selection = newest job; orders visible; creation buttons absent.
- **Flat (non-customers) inbox view**: no picker in header; sidebar targets newest active job
  exactly as today (`selectedJobId` stays null → FR-2 default).
- **FR-7 orphan check (amended)** (read-only): open a person with a `job_id IS NULL` order —
  ORD-000232 (£3,600) is the live SM reference case. The order appears in the "Unassigned"
  subsection below the job-scoped list **in every job selection state**, is clickable
  (context summary shows), has no create actions attached, and also remains in Orders page →
  Unassigned tab. Find the 9 SM cases:
  ```sql
  select id, person_id, order_type, value from orders
  where organization_id = '<SM-org-id>' and person_id is not null and job_id is null;
  ```

## Regression sweep

- Single-job conversation: create order + invoice → both carry that job's id (behavior
  unchanged from `latestActiveJob` era). Covered by the US-2 fixture's Job-2-only phase or a
  staging-branch comparison.
- `npx tsc --noEmit -p tsconfig.app.json` again post-implementation: exactly 55 (SC-004).
