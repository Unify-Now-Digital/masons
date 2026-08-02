# Feature Specification: Create Orders and Invoice from an Inbox Conversation

**Feature directory:** `specs/sidebar-order-invoice-from-conversation/`
**Parent spec:** `specs/status_v2-implementation-spec.md` §4, third bullet
**Builds on:** `specs/pipeline-page-before-paid-add-to-pipeline/` (jobs pipeline, merged to staging at `1c7fb62`)
**Status:** READY FOR `/speckit.plan` — all ground-truth items resolved 02 Aug 2026 (evidence in §8)

---

## 1. Summary

From an inbox conversation (grouped and flat view) that has a linked job, the user can create one or more orders for that job and then one invoice covering those orders, from the conversation's right sidebar / order context area. All created records are fully linked: orders get `job_id`, `person_id`, and (after invoice creation) `invoice_id`; the invoice gets `person_id` and `job_id`.

**Corrected bug framing (per GT-1 evidence):** the historical "invoices save with person_id NULL" bug was fixed for the CreateInvoiceDrawer path by commit `427578b` (14 Jul 2026, "Link invoices to people by person_id instead of matching customer_name"). Production data confirms the flip: last pre-commit invoice (INV-000113, 13 Jul 20:02 UTC) has NULL `person_id`; first post-commit invoice (INV-000114, 20:27 UTC) and all subsequent person-linked invoices have it set. Remaining NULLs in SM: **6 rows** (historical + no-person-selected cases). This feature's obligation is therefore: (a) the **new** sidebar write paths must set all linkage fields correctly from day one, and (b) the historical backfill is explicitly **out of scope** (separate ID-scoped migration, Arin sign-off).

## 2. Scope

**In scope**
- Sidebar entry point on conversations with a linked job, in both grouped and flat inbox views.
- Order creation reusing `CreateOrderDrawer`, prefilled with the linked person's name/email/phone; write path extended to set `job_id` and `person_id` (and `customer_email`/`customer_phone` — the existing drawer path writes these as NULL even when a person is linked; the sidebar path does better).
- "Create invoice" affordance once ≥1 order exists for the job, opening the existing `CreateInvoiceDrawer` preloaded with those orders; invoice written with `person_id` and `job_id`; each covered order written with `invoice_id` (the confirmed linkage model, §5).
- `invoices.job_id` write support in the drawer payload (column exists and is live in prod; no current write path sets it).
- Org-scoping on every read and write.
- **In-scope hardening (touched write path):** org-scope the invoice-number fallback query in `createInvoice` (`invoicing.api.ts` — the max-invoice-number lookup currently reads across all orgs).

**Out of scope / non-goals**
- No schema changes (confirmed unnecessary: `orders.invoice_id`, `orders.job_id`, `orders.person_id`, `invoices.job_id`, `invoices.person_id` all exist).
- Backfill of the 6 historical NULL-`person_id` invoices in SM (separate migration, Arin sign-off, ID-scoped statements with read-back evidence).
- No auto-stage-change on order or invoice creation. Job stage moves remain manual.
- `updateInvoice` lacks an `organization_id` guard (updates by `id` alone) — **logged, not fixed here** unless the invoice phase must touch it anyway; one concern per commit.
- No changes to Stripe edge functions (the existing background `ensureStripeInvoice` call is reused as-is).
- No changes to the legacy "create order inside invoice drawer" flow for users arriving from the Invoices page; this feature adds the conversation-side entry, it does not remove the old one.

## 3. User Scenarios

**S1 — Flat view, single order, invoice.** User opens a conversation with a linked job in flat view. Sidebar shows job context and a "New order" action. User creates an order; customer fields prefilled from the linked person. Sidebar shows the order and a "Create invoice" action. Invoice drawer opens preloaded with the order; on save, invoice has `person_id` + `job_id`, and the order has `invoice_id` set.

**S2 — Grouped view parity.** Same flow from the grouped Customers view. Deep-link/scroll behavior from the pipeline feature unaffected.

**S3 — Multi-order, one invoice.** User creates two orders for the job, then one invoice covering both. Confirmed feasible: linkage is order-side (`orders.invoice_id`), and the existing drawer already aggregates multiple orders into one invoice amount. Both orders end with `invoice_id` = the created invoice; both carry `job_id` + `person_id`.

**S4 — No linked job.** Conversation has no job: creation flow not offered (OQ-1 resolution governs whether a pointer to "Add to pipeline" is shown).

**S5 — No linked person.** Conversation has a job but no resolvable person (e.g. GHL web-chat contact never synced to `people`). The sidebar flow **requires** a person before order creation, reusing the org-scoped person create/dedupe from Add-to-pipeline. It must never create orders or invoices with NULL `person_id` (unlike the legacy drawer, where person selection is optional — see INV-000115 precedent).

## 4. Functional Requirements

- **FR-1** Sidebar entry point renders only when the conversation has a linked job, in both grouped and flat views.
- **FR-2** Order creation reuses `CreateOrderDrawer`. Prefill: name, email, phone from the linked person. New orders written with `organization_id`, `job_id`, `person_id`, `customer_email`, `customer_phone`.
- **FR-3** Person resolution and create/dedupe reuses the org-scoped logic shipped in Add-to-pipeline. All email matching org-scoped (never rely on the global `people_email_key`).
- **FR-4** "Create invoice" appears only when ≥1 order exists for the job; opens `CreateInvoiceDrawer` preloaded with those orders. It must not route through the legacy inline-order path in a way that risks duplicate orders.
- **FR-5** Invoice save from this flow persists `person_id` (mechanism already sound post-`427578b`) and `job_id` (new payload field). Each covered order gets `invoice_id` written — the existing background-linkage pattern from the drawer (snapshot orders → write `invoice_id: invoiceId`) is the reference implementation.
- **FR-6** For **pre-existing** orders being invoiced (created in the sidebar before the invoice), `invoice_id` is written via an org-scoped update on those order IDs — not by re-creating orders.
- **FR-7** No `updated_at` in any payload touching `inbox_conversations` (silent PostgREST rejection).
- **FR-8** No job stage mutation anywhere in this flow.
- **FR-9** All queries org-scoped by `organization_id`; mystery org `15486fe5-…` excluded as everywhere else.
- **FR-10** UI uses `gardens-*` tokens; no function-valued `className` through Radix `asChild` triggers.
- **FR-11** The invoice-number fallback query in `createInvoice` gains an `organization_id` filter (in-scope hardening, §2).

## 5. Confirmed Data Model (evidence-based)

**Linkage direction: order-side.** `orders.invoice_id → invoices.id` is the live model (CreateInvoiceDrawer writes `invoice_id: invoiceId` on background-created orders). `invoices.order_id` is legacy — explicitly nulled in the drawer payload with comment "No longer used, but keep for type compatibility" — and must not be used for new linkage.

| Record | Fields this feature writes | Notes |
|---|---|---|
| `orders` | `organization_id`, `job_id`, `person_id`, `customer_email`, `customer_phone`, `invoice_id` (at invoice time), existing fields | `invoice_id` via creation payload or org-scoped update per FR-6 |
| `invoices` | `organization_id` (injected by `useCreateInvoice`), `person_id`, `job_id`, existing fields | `job_id` is the net-new payload field |
| `people` | Only via existing org-scoped create/dedupe path | No new write logic |

Money fields follow the units rule: decimal-pounds vs bigint-pence-as-string; `Number()` coercion and existing helpers (`formatGbpDecimal`, `formatGbpPence`). `intended_deposit_pence` conversion stays in the drawer as-is.

## 6. Constraints

- No schema changes.
- tsc gate: `npx tsc --noEmit -p tsconfig.app.json`, baseline exactly 59 pre-existing errors, zero new. `vite build` is not a typecheck.
- Per-edit approval in Claude Code; phase-by-phase commits with Giorgi's review gates; one concern per commit, Giorgi's own commit wording.
- All client-side work; no edge function deploys expected. If any become necessary, commit + push before deploy.
- Verification against SM only; Churchill untouched.

## 7. Acceptance Criteria & Verification

All verification against **Sears Melvin** (`3770972d-1bbd-417b-b413-297e844db285`). Read-back SQL recorded with actual output per migration-evidence discipline.

- **AC-1** Flat view: create one order from a job-linked conversation. Read-back: order row has non-null `job_id`, `person_id`, `customer_email` (when person has one), correct `organization_id`.
- **AC-2** Same from grouped view.
- **AC-3** Two orders → one invoice. Read-back: invoice has non-null `person_id` and `job_id`; both orders have `invoice_id` = that invoice; `invoices.order_id` remains NULL (legacy field untouched).
- **AC-4** Job stage unchanged after AC-1–AC-3 (read-back on job row).
- **AC-5** S5: conversation with job but no synced person → flow requires person create/dedupe; resulting records fully linked; no NULL `person_id` possible from this path.
- **AC-6** Org-scope negative check: same-email person existing in Churchill is not matched by any step (guards `people_email_key` cross-org behavior).
- **AC-7** Invoice-number fallback: with RPC forced to fail (or by code inspection + unit-level reasoning if forcing is impractical), the fallback query is org-scoped.
- **AC-8** tsc: exactly 59 errors, zero new.
- **AC-9** Test rows created during verification are deleted by ID-scoped, org-guarded statements with before/after SELECT evidence.

## 8. Ground-Truth Evidence Log (resolved 02 Aug 2026)

- **GT-1 (person_id drop) — RESOLVED, reframed.** Write chain: `CreateInvoiceDrawer` builds payload (schema includes `person_id`, `invoice.schema.ts:4`) → `useCreateInvoice` injects `organization_id` (`useInvoices.ts:47`) → `createInvoice` inserts as-is (`invoicing.api.ts`). Fix commit `427578b` dated 2026-07-14 00:06 +0400. SQL evidence: INV-000113 (2026-07-13 20:02 UTC) `person_id` NULL; INV-000114 (20:27 UTC) onward populated. Remaining SM NULLs: 6 (backfill scope, out of this feature).
- **GT-2 (linkage) — RESOLVED.** `information_schema` confirms `orders` has `invoice_id`, `job_id`, `person_id`, `organization_id`. Code confirms order-side linkage is the live pattern; `invoices.order_id` legacy/nulled.
- **GT-3 (sidebar components) — OPEN for plan phase.** Identify conversation right-sidebar component(s) for grouped and flat views and where the job link is available. First plan task, read-only.
- **GT-4 (invoice drawer preload contract) — PARTIALLY RESOLVED.** Drawer manages an internal `orders` array (inline-created) aggregated via `orders.reduce` into `finalAmount`; background path snapshots orders and writes `invoice_id`. Plan must determine how to preload **pre-existing** orders (vs. inline definitions) — likely a new optional prop carrying order rows, with the background path branching: create-new vs. update-existing (FR-6).
- **GT-5 (person resolution reuse) — OPEN for plan phase.** Confirm the Add-to-pipeline person create/dedupe is importable from the sidebar context.
- **Additional findings logged:** invoice-number fallback query not org-scoped (now FR-11); `updateInvoice` has no org guard (logged, out of scope); legacy drawer writes `customer_email`/`customer_phone` as NULL even with a linked person (sidebar path corrects this for its own orders).

## 9. Open Questions

- **OQ-1** Conversations without a job: hide the entry point entirely, or show a disabled state pointing to "Add to pipeline"? (Recommend the pointer; Giorgi's call at plan time.)
- **OQ-2 — RESOLVED into S5/FR-3:** no-person case requires person create/dedupe before order creation; no NULL-person records from this path.
- **OQ-3** The order-side linkage (`orders.invoice_id`) written here is the **interim mechanism** pending the unsettled Order↔Invoice model decision with Arin. One line in Monday's demo notes so the architectural decision isn't made by implementation default. (Reality check for that discussion: the codebase has already voted — order-side linkage is live; the decision is whether to bless it.)

## 10. Phasing (for `/speckit.plan` to elaborate)

1. **Plan-phase investigation** — GT-3, GT-4 (preload mechanism), GT-5. Read-only.
2. **Order path** — sidebar entry (both views) + `CreateOrderDrawer` extension (`job_id`, `person_id`, email/phone prefill + write). Commit gate.
3. **Invoice path** — drawer preload of pre-existing orders + `job_id` payload + `invoice_id` update on covered orders (FR-5/FR-6) + FR-11 hardening. Commit gate. (FR-11 as its own commit: one concern per commit.)
4. **Verification** — AC-1..AC-9 with recorded SQL output. Staging merge gate.