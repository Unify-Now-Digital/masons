# Feature Specification: Order Name Display (deceased vs customer)

**Feature Branch**: `feature/order-name-display`
**Created**: 2026-10-12
**Status**: Draft
**Input**: Order-name investigation 2026-10-12 (CC read-only + Giorgi live counts Q1–Q4, Step 0a/0b). Supersedes PR #26 (arin/order-deceased-phase1-2, to be closed).

## Convention (R-1, canonical)

`orders.customer_name` = **deceased**. `orders.person_name` = **living customer** (snapshot of the primary `order_people` person; `person_id` is the link).
Evidence: column comments `20260106003849:15-16`; every Mason writer (CreateOrderDrawer, EditOrderDrawer via `upsertOrderPeople`, OrderFormInline/CreateInvoiceDrawer, quote conversion); AI prefill; `orderTransform.ts:63-71`. `invoices.customer_name` is a different column and means the living person — unaffected.

## Rulings (Giorgi, 2026-10-12)

- R-1 Canonical convention = Mason's (above).
- R-2 Data: no write on the 29 archived equal-name rows. The 3 live ones (#141, #179, #245) are corrected by staff in the UI; no SQL.
- R-3 No partner orders exist in either org → no sequencing constraint; this ships independently of SearsMelvin.
- R-4 Partner writer (`../SearsMelvin/functions/api/partner-orders.js:470,474`) and the `create_quote` revert path → Arin, SearsMelvin prevention items (backlog).
- R-5 Revolut surname matching is out of this spec (backlog).
- R-6 `revolut-sync-transactions` tenant scoping logged as F-054.
- R-7 PR #26 to be closed as superseded.
- R-8 Missing `archived_at IS NULL` filters on the touched order reads are out of this spec (backlog: count archived orders that still carry money owed or a live permit status before any filter is added; separate spec/commit).
- R-9 The hub recent-payments org guard (`hub.api.ts:214-216`, embed without `!inner`) is F-056, fixed in its own commit on this branch. FR-005 does not change that query's guard.
- R-10 US5 (`detect-order-extras` prompt name) is cut. The function has no tenant scoping (F-055), and the prompt fix moves into the F-055 fix.
- R-11 MatchModal search quotes and escapes user text inside the PostgREST `or()` filter (FR-005).

## Live facts (2026-10-12)

- SM 32/48 orders equal-name; Churchill 0/1. All 32 from pre-cutover `create_quote` (wrote the submitter into both columns). 29 archived, 3 live.
- No structured deceased source exists for the 32; order `inscription_text` on 18/32; `activity_logs` prior name 0.
- Zero partner orders. Mason-written orders follow the convention.
- Live (unarchived) orders: Churchill 1, 0 with empty `person_name`. SM 19, 2 with empty `person_name` (1 recoverable via `person_id`).
- The Q2 provenance classifier (quote enquiry or quote token) over-matched 2 Mason-created orders (#272, #276) later linked to a quote enquiry. `create_quote` has inserted no orders since the cutover (position check = 0 and case-insensitive regex check = false, both 2026-10-12).

## User Scenarios & Testing

### User Story 1 — Permit chase emails address the right people (P1)

Customer chase drafts open "Dear {customer}" and refer to "{deceased}'s memorial"; cemetery chase drafts name the deceased. Today both are swapped for every Mason order — outbound email.

**Independent Test**: Permit tracker, SM, an order in `form_sent`/`customer_completed`/`pending` with distinct names: customer draft greets the customer and names the deceased; cemetery single + multi drafts name the deceased; card shows deceased in the meta line and the customer as the main name. Same order via the inbox conversation's cemetery chase draft: identical names.

**Acceptance Scenarios**:
1. Given an order with customer "A" and deceased "B", When the customer chase draft is built, Then it reads "Dear A" and "B's memorial".
2. Given the same order, When the cemetery single draft is built, Then subject and body name B; the multi-order draft bullet names B.
3. Given an order with no deceased name, When any draft is built, Then the existing fallback ("the deceased") is used — never the customer's name.
4. Given an order with no customer name, When the customer draft is built, Then the greeting falls back per FR-002, never to the deceased.

### User Story 2 — Order sidebar shows and edits each name under the right label (P1)

The "Customer Information" card shows the customer and no longer hosts an edit input bound to the deceased column. A labelled "Deceased" row shows `customer_name` and is the inline-edit target for it.

**Independent Test**: Orders page, open an SM order with distinct names: card shows customer; "Deceased" row shows deceased; Edit → the input labelled "Deceased name" saves `customer_name`; customer is not editable inline (changed via EditOrderDrawer people picker, unchanged). #141/#179/#245 show the customer name in both rows until staff correct them (expected, R-2).

### User Story 3 — Money and triage surfaces name the payer (P2)

Balance-chase, recent payments, priority actions ("Chase customer"), reconciliation, invoice expanded rows (under "Person"), reporting recent activity, and the payments match search show/search the **customer**; the deceased appears only where labelled.

**Independent Test**: Hub balance-chase card for an SM order with balance: name = customer. Priority page row with "Chase customer": name = customer. Finance → expand an invoice: order row under "Person" = customer. Reconciliation "Customer" column = customer. Match modal: searching the customer's surname finds the order; searching the deceased's surname also finds it.

### User Story 4 — Lists, search and inbox context show both names clearly (P2)

Pipeline order rows and universal search show the customer as the main name and "Deceased: {name}" as the subline whenever a deceased name exists — no equality hiding. The inbox order summary card shows the customer, with the deceased labelled.

**Independent Test**: Pipeline (SM), universal search for an order number, inbox conversation with a linked order: customer main, "Deceased: X" sub. An equal-name live row (#141) shows the name twice — intentional; it surfaces the staff correction (R-2).

### User Story 5 — CUT (R-10)

The `detect-order-extras` prompt naming the deceased as the customer (`index.ts:244-247`) moves into the F-055 fix.

## Requirements

- **FR-001** Two canonical helpers in `src/modules/orders/utils/orderNames.ts`, exported from the orders barrel: `orderCustomerName(o)` → trimmed `person_name` or null; `orderDeceasedName(o)` → trimmed `customer_name` or null. Every surface touched by this spec reads names only through them (edge functions keep a local equivalent; Deno cannot import `src/`). Vitest cases: distinct, equal, empty-string, whitespace, null.
- **FR-002** Customer fallback: if `person_name` is empty, the surface shows its existing placeholder ("—" where none exists). No `people` join is added (2 of 20 live orders affected). Never fall back to `customer_name`.
- **FR-003** Permit module (US1): `permitTracker.api.ts:28-29` stops mapping `person_name` → `deceased_name`; `PermitCard.tsx:33,42,51`; `chaseTemplates.ts:39,45,48,66,69,94-95,100-103,120-128`; `ConversationView.tsx:164-167` (feeds `ConversationThread.tsx:630`); `permitChase.api.ts:184` + `PermitChasePage.tsx:468` ("Customer" column = customer; row/card titles :267,:407 per A-12). Vitest on `chaseTemplates` (pure functions) for scenarios 1–4.
- **FR-004** `OrderDetailsSidebar.tsx:369-381` (US2): Customer card shows `orderCustomerName` read-only; new labelled "Deceased" row bound to `customer_name` for view and inline edit. Inline save payload unchanged in shape (`customer_name` only).
- **FR-005** Money/triage (US3): `hub.api.ts:181,199,238` (+ `HubPage.tsx:337,386`); `priority.api.ts:111,152,172,220,238,272,306`; `useReporting.ts:391`; `ExpandedInvoiceOrders.tsx:172`; `ReconciliationTab.tsx:158`; `MatchModal.tsx:61,68,101,131` — search `or(person_name.ilike, customer_name.ilike)` + order number, placeholder "Search by customer, deceased or order number". The user's term is double-quoted inside `or()` with `"` and `\` escaped per PostgREST rules, never interpolated raw (R-11). Vitest cases on the filter builder cover a comma, parentheses, a dot, an apostrophe (O'Brien), a hyphen, a double quote and a backslash. Each select that lacks `person_name` adds it at the query layer; org guards are not changed by this spec (the hub recent-payments guard is F-056, R-9).
- **FR-006** Lists/inbox (US4): `PipelinePage.tsx:190-194`; `UniversalSearch.tsx:152-155` (search keys :63-64 unchanged); `OrderContextSummary.tsx:105` → `InboxOrderSummaryCard.tsx:58-59` gets customer + labelled deceased.
- **FR-007** CUT (R-10): moved into the F-055 fix.
- **FR-008** No writer, schema, view, RLS or edge-function change, and no edge deploy. No data write (R-2). Revolut functions untouched (R-5).
- **FR-009** Tab panels / Radix rules per CLAUDE.md unaffected; new sidebar row uses existing tokens.

## Ambiguous surfaces — defaults ACCEPTED (Giorgi, 2026-10-12)

| # | Surface | Today | Ruling (accepted default) |
|---|---|---|---|
| A-1 | `DeleteOrderDialog.tsx:57-58` | "delete the order for {deceased}" | "delete order ORD-N for {customer} (deceased: {deceased})", omitting missing parts |
| A-2 | `InvoiceDetailSidebar.tsx:885`; `CreateInvoiceDrawer.tsx:585`; `EditInvoiceDrawer.tsx:213` | `{deceased} - {type}` unlabelled | Keep deceased as the order identifier (invoice already names the customer); render "Deceased: {name} · {type}" |
| A-3 | Order pickers `CreateJobDrawer.tsx:268`; `Create/EditInscriptionDrawer.tsx:147/148` | deceased | No change — deceased is the natural key for a job/inscription |
| A-4 | `proofReview.api.ts:219` → `ProofReviewPage.tsx:195,236,408` | deceased under field `customerName` | No visual change; rename field to `deceasedName` |
| A-5 | `hub.api.ts:116` `sampleCustomers` → `HubPage.tsx:146` | deceased | Customer (staff contact triage) |
| A-6 | Logistics/map popups `useScheduleData.ts:76`; `orderMapTransform.ts:56`; `OrderInfoPanel.tsx:54` | deceased, unlabelled | No change (identifies the grave on site); out of spec |
| A-7 | Payments `OutstandingTable.tsx:74`, `ExtrasTable.tsx:94` ("Order" column) | deceased | "ORD-N · {customer}" |
| A-8 | `UnmatchedPaymentsTable.tsx:80` "Best match" | deceased, from stored Revolut `match_candidates` JSON | Out — data comes from Revolut matching (R-5) |
| A-9 | Equal-name hiding `PipelinePage.tsx:192`, `UniversalSearch.tsx:155` | hides sub when equal | Remove hiding (FR-006) |
| A-10 | `ChaseModal.tsx:34-35` pills | literal, never substituted | Out — backlog |
| A-11 | Jobs/logistics `jobs.customer_name` (`EditJobDrawer.tsx:149,206-211`, `jobTransform.ts:36`, `useScheduleData.ts:133`) | deceased labelled "Customer" | Out — column absent from generated `jobs` Row; verify module is live first (backlog) |
| A-12 | `PermitChasePage.tsx:267,407` row/card titles | deceased, unlabelled | Deceased as title (permit is per grave), customer as subline |
| A-13 | `finance.api.ts:167-228` | dead hooks | Out — backlog |

## Out of scope

Writers and the partner portal (R-4); data correction (R-2); Revolut matching (R-5) and F-054; jobs/logistics `jobs.customer_name` (A-11); `order_deceased` table (PR #26, R-7); `archived_at` filtering on the touched reads (R-8); hub recent-payments org guard, F-056 (R-9, own commit); `detect-order-extras`, F-055 (R-10).

## Success Criteria

- SC-001 Zero reads of `customer_name` as customer or `person_name` as deceased in the FR-003..FR-006 files (grep at review: `person_name` appears only via `orderCustomerName`/selects; `customer_name` only via `orderDeceasedName`/selects/search keys).
- SC-002 chaseTemplates + orderNames + MatchModal filter-builder vitest green; gate tsc item-diff 0 new, lint not above baseline.
- SC-003 Browser verify on staging per US1–US4, naming the SM order checked for each, using an order with distinct customer/deceased names.

## Dependencies / operational

- Staff correct #141, #179, #245 deceased names in EditOrderDrawer (R-2; source: inscription text / conversation). Independent of this release.
