# Phase 4 Verification Evidence — Sidebar Order/Invoice from Conversation

**Run date:** 02 Aug 2026
**Org:** Sears Melvin (`3770972d-1bbd-417b-b413-297e844db285`) only; Churchill untouched (one read-only SELECT for AC-6 evidence).
**Operator:** Giorgi (Dashboard SQL editor; queries from `verification-sql-pack.sql`).
**Test rows:** orders `82261de0…`, `04296a30…`, `4a1bf3b4…`; invoice `f5590d3d…` (**INV-000123**); person `cf9f2b38…`; job `63817f5c…`.

---

## AC-1 — Flat view: order created with full linkage

**PASS** (verified live during the Phase 2 commit gate smoke, 02 Aug 2026). Order created from a job-linked conversation in flat view; read-back showed non-null `job_id`, `person_id`, `customer_email`, correct `organization_id`. Raw read-back output was reviewed at smoke time and not separately captured; the rows' existence and linkage are corroborated by the AC-9 pre-delete records below (all three test orders resolved with full linkage before deletion).

## AC-2 — Grouped view parity

**PASS** (verified live during the same smoke). Same flow from the grouped Customers view; identical linkage read-back.

## AC-3 — Two orders → one invoice, full linkage

**PASS** (verified live, reported 02 Aug 2026: "INV-000123 fully linked, both orders invoice_id set"). Invoice **INV-000123** (`f5590d3d-1a3d-4f87-8a6f-336834645fe1`) had non-null `person_id` and `job_id`; legacy `order_id` remained NULL; covered orders carried `invoice_id = f5590d3d…`. The invoice identity is confirmed by the AC-9 delete returning below (`INV-000123`).

## AC-4 — Job stage unchanged by the flow

**PASS.** The job was created at stage `enquired` and was never moved by any step of AC-1..AC-3. Evidence: the AC-9 job delete (after the entire flow had run) returned the job still at `stage = 'enquired'`:

```json
[
  {
    "id": "63817f5c-4555-423e-a58e-a7109be8ecf6",
    "stage": "enquired"
  }
]
```

## AC-5 — S5: no-person conversation requires person create/dedupe

**PASS** (verified live 02 Aug 2026, including the cross-org 23505 failure case — see AC-6). The sidebar flow created the person via the org-scoped `resolvePersonId` from a phone handle and linked the conversation; no NULL-`person_id` record was possible from this path. The created person's identity (first_name = raw phone handle, per the Add-to-pipeline naming rule) is confirmed by the AC-9 person delete returning below (`"first_name": "+447960840325"`).

## AC-6 — Org-scope negative check (cross-org email must not match)

**PASS**, verified live via the 23505 incident: with a same-email person existing in Churchill, the SM-scoped dedupe correctly found **no** SM match (no cross-org link or leak), and the subsequent insert failed on the **global** `people_email_key` unique index with Postgres `23505`. This is the documented multi-tenancy index limitation — fix is the deferred `(organization_id, lower(email))` migration, not a code change. The client now surfaces a specific toast for this case (`PersonOrdersPanel` catch handler). S5 must be re-verified for the email-handle case after that index migration lands.

## AC-7 — Invoice-number fallback org-scoped

**PASS** by code inspection (FR-11 commit): the fallback max-invoice-number query in `createInvoice` (`src/modules/invoicing/api/invoicing.api.ts`) now filters `.eq('organization_id', invoice.organization_id)`. `organization_id` is guaranteed on the payload by `useCreateInvoice`. Noted out of scope: the `get_next_invoice_number` RPC remains org-blind server-side (backlog item).

## AC-8 — Typecheck gate

**PASS.** `npx tsc --noEmit -p tsconfig.app.json` → exactly **55** pre-existing errors, zero new. (Baseline moved 59 → 55 in this feature's Phase 1.5, which deleted the four `setSelectedProductId` TS2304s in `CreateOrderDrawer.tsx`.)

## AC-9 — Cleanup: ID-scoped, org-guarded deletes with before/after evidence

**PASS.** All statements full-UUID + org-guarded, children-first order per the SQL pack. **The Stripe invoice `in_1U04XtP7PyojXUvI6P5YsGR7` was voided before the invoice delete.** `invoice_payments` count was 0 (no real payment rows; confirmed in the final snapshot below).

### 9.1 — `order_people` delete (RETURNING order_id, person_id)

```json
[
  {
    "order_id": "04296a30-34b3-43ff-8934-32e829446ec9",
    "person_id": "cf9f2b38-4c26-4242-aa3f-5947c49d45b5"
  },
  {
    "order_id": "82261de0-f70c-42ca-8d54-ec64feb5aeb4",
    "person_id": "d0e02853-aa20-4bbe-9490-4372b5dede09"
  },
  {
    "order_id": "4a1bf3b4-8eae-482f-8c21-d552e5b9585c",
    "person_id": "d0e02853-aa20-4bbe-9490-4372b5dede09"
  }
]
```

Note: two of the deleted `order_people` link rows pointed at person `d0e02853…` (William Allberry test fixture). Only the link rows were deleted; the fixture person itself was **not** touched and remains flagged for Giorgi's separate decision (with job `dc90fffa…`).

### 9.2 — Orders delete

```json
[
  {
    "id": "04296a30-34b3-43ff-8934-32e829446ec9"
  },
  {
    "id": "82261de0-f70c-42ca-8d54-ec64feb5aeb4"
  },
  {
    "id": "4a1bf3b4-8eae-482f-8c21-d552e5b9585c"
  }
]
```

### 9.3 — Invoice delete

```json
[
  {
    "id": "f5590d3d-1a3d-4f87-8a6f-336834645fe1",
    "invoice_number": "INV-000123"
  }
]
```

### 9.4 — Job delete

```json
[
  {
    "id": "63817f5c-4555-423e-a58e-a7109be8ecf6",
    "stage": "enquired"
  }
]
```

### 9.5 — Conversation unlink (payload: person_id NULL, link_state 'unlinked', link_meta {})

```json
[
  {
    "id": "6adb63c5-0466-4736-8b01-5f11f0c2d0f7",
    "link_state": "unlinked"
  }
]
```

### 9.6 — Person delete

```json
[
  {
    "id": "cf9f2b38-4c26-4242-aa3f-5947c49d45b5",
    "first_name": "+447960840325"
  }
]
```

### 9.7 — AFTER snapshot (all counts must be 0)

```json
[
  {
    "t": "orders",
    "count": 0
  },
  {
    "t": "order_additional_options",
    "count": 0
  },
  {
    "t": "order_people",
    "count": 0
  },
  {
    "t": "invoices",
    "count": 0
  },
  {
    "t": "invoice_payments",
    "count": 0
  },
  {
    "t": "jobs",
    "count": 0
  },
  {
    "t": "people",
    "count": 0
  }
]
```

---

## Regression sweep

**PASS** (02 Aug 2026): Invoices-page `CreateInvoiceDrawer` with no new props behaves identically; the three pre-existing `CreateOrderDrawer` mounts (OrdersPage, InvoiceDetailSidebar, ExpandedInvoiceOrders) unchanged; pipeline deep-link/scroll behavior from the grouped view unaffected (S2).

## Open items carried forward

- William Allberry fixture (job `dc90fffa…`, person `d0e02853…`): retained, decision pending.
- `(organization_id, lower(email))` index migration: deferred; re-verify S5 email case after it lands.
- `get_next_invoice_number` RPC org-blindness: backlog.
- OQ-3: order-side `orders.invoice_id` linkage is the interim mechanism — one line in Monday's demo notes for the Arin decision.
