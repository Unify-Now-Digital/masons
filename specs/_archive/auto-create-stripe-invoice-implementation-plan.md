# Auto-create Stripe invoice — Implementation plan

**Feature spec:** [specs/auto-create-stripe-invoice.md](auto-create-stripe-invoice.md)  
**Plan artifacts:** [specs/auto-create-stripe-invoice-plan/](auto-create-stripe-invoice-plan/)

**Branch:** `feature/auto-create-stripe-invoice`

*Note: Plan generated from spec and user-provided implementation details; `.specify/scripts/bash/setup-plan.sh` was not available for this feature.*

---

## Technical context (from arguments)

**Goal:** Automatically create a Stripe invoice as soon as a local invoice becomes billable, so Full + Partial actions appear immediately in the Invoicing table without clicking manual Link.

**Decisions:**
1. **Primary trigger:** After the first order is attached to an invoice / after invoice totals are recalculated and invoice amount > 0.
2. **Secondary trigger (optional safety):** After invoice creation if it is already billable and has orders. This avoids creating Stripe invoices for empty invoices.

**Stack:** React + TypeScript + Vite + Supabase; invoicing in `src/modules/invoicing/`; Stripe Edge Function `stripe-create-invoice` (idempotent when `stripe_invoice_id` already set).

---

## Progress tracking

| Phase | Status | Artifact(s) |
|-------|--------|-------------|
| 0 – Research | ✅ Complete | research.md |
| 1 – Data model & contracts | ✅ Complete | data-model.md, contracts/, quickstart.md |
| 2 – Tasks | ✅ Complete | tasks.md |

---

## Implementation phases

### Phase 0 – Identify exact trigger points

- **Goal:** Locate CreateInvoiceDrawer flow, ExpandedInvoiceOrders / Add Order flow, and any shared recalc path that updates `invoice.amount` after order attach/remove. Prefer a single helper path: after successful order attach + invoice refresh, call `ensureStripeInvoice(invoiceId)`.
- **Artifact:** `specs/auto-create-stripe-invoice-plan/research.md`.

### Phase 1 – Shared guard/helper

- **Goal:** Add client-side helper or mutation wrapper `ensureStripeInvoice(invoice)` (or `ensureStripeInvoice(invoiceId)` with fetch): if `invoice.stripe_invoice_id` exists → do nothing; if `invoice.amount <= 0` → do nothing; if invoice has no linked orders / no billable content → do nothing; otherwise call `createStripeInvoice(invoice.id)`. Prevent duplicate calls with an in-flight guard keyed by `invoice.id` (Map/Set/ref); clear on success/failure. On failure: log/toast non-blocking; keep invoice usable; allow fallback manual "Create link" during rollout.
- **Artifacts:** data-model.md (no schema change; document existing invoice/order fields), contracts/ (ensureStripeInvoice contract, createStripeInvoice usage), quickstart.md (QA and rollout notes).

### Phase 2 – Wire trigger into invoice-ready flows

- **Goal:** After adding first order to invoice (or any order attach where amount becomes > 0): refetch invoice detail, call `ensureStripeInvoice(updatedInvoice)`. If invoice can be created with orders already attached: after invoice create success and initial detail fetch, call `ensureStripeInvoice(newInvoice)`. For revised invoices: once new invoice record exists and amount > 0, same helper runs and creates Stripe invoice if missing.
- **Files:** CreateInvoiceDrawer, ExpandedInvoiceOrders (or shared hook used by both); optional Revise flow if new invoice is created there.

### Phase 3 – Refresh/invalidate state after auto-create

- **Goal:** On successful `createStripeInvoice`: invalidate invoices list and invoice detail queries; if selected invoice matches, merge returned Stripe fields into `selectedInvoice` (stripe_invoice_id, hosted_invoice_url, stripe_invoice_status, amount_paid, amount_remaining). Ensure table row updates so Stripe column shows Full (if hosted_invoice_url) and Partial (if stripe_invoice_id or hosted_invoice_url).

### Phase 4 – Table/UI behavior during rollout

- **Goal:** Stripe payment link column: preferred steady state = Full + Partial, no Link button; temporary fallback = if no Stripe invoice exists unexpectedly, keep "Link" as manual retry. Optional: small loading state ("Creating…" or spinner) in Stripe column for that row while auto-create runs. Do not block order attach or invoice creation if Stripe create fails.

### Phase 5 – Existing invoices / backfill

- **Goal:** No schema changes. Do NOT auto-backfill all historical invoices in this task. Keep manual fallback "Link" for existing invoices that lack Stripe invoice until touched/retried. Optional future task: bulk/backfill action.

### Phase 6 – QA checklist

- Create invoice → add first order → Stripe invoice auto-created.
- In table, Full + Partial appear without clicking Link.
- No duplicate Stripe invoices when editing invoice / adding more orders.
- Revised invoice gets its own Stripe invoice automatically.
- If Stripe create fails, local invoice still works and fallback retry remains.
- Existing invoices without Stripe invoice can still be handled manually.

---

## Deliverables

- Shared `ensureStripeInvoice` helper/mutation (with in-flight guard).
- Trigger wiring in invoice creation and order-attach flow.
- Query invalidation + selectedInvoice update on success.
- Temporary fallback / manual retry behavior retained where needed.
- Manual QA notes in quickstart.md.
