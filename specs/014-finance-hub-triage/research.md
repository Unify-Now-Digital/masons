# Research: Finance Hub — Outstanding Invoice Triage

## R1 — Single source of truth for remaining balance

**Decision**: Extract `invoiceRemainingPence()`, `isInvoiceOwed()`, and `formatInvoiceRemaining()` into `src/modules/finance/utils/invoiceRemaining.ts`. All hub aggregates, the Invoices table remaining column (`FinancePage` ~572), and the detail drawer remaining row (~694–698) MUST call these helpers — no inline ternary remaining logic.

**Rationale**: Spec FR-005 / AC-004 require zero divergence between hub and drawer. The current duplicated ternary (`amount_remaining != null ? formatGbpPence : formatGbpDecimal(amount)`) is the exact drift risk the client flagged.

**Alternatives considered**:
- Import from `src/modules/invoicing/utils/invoiceAmounts.ts` — rejected (cross-module deep import; finance module owns Finance surfaces).
- Duplicate helper in `finance.invoices.api.ts` — rejected (utils file keeps API thin and testable).

### Unit rules (locked)

| Field | Storage unit | Helper handling |
|-------|--------------|-----------------|
| `amount` | GBP **pounds** (decimal) | Convert to pence via `Math.round(amount * 100)` when deriving remaining |
| `amount_paid` | **pence** (bigint) | Parse as integer pence |
| `amount_remaining` | **pence** (bigint) | Preferred source when non-null |

**Remaining pence algorithm**:
1. If `amount_remaining != null` → `max(0, Number(amount_remaining))`.
2. Else if `amount` is finite → `max(0, round(amount * 100) - paidPence)` when `amount_paid > 0`, else `round(amount * 100)`.
3. Else → `0`.

**Display**: `formatInvoiceRemaining(row)` → `formatGbpPence(invoiceRemainingPence(row))` when owed; `—` or zero handling matches existing paid-column placeholder rules for fully paid rows.

**Owed predicate**: `isInvoiceOwed(row) := invoiceRemainingPence(row) > 0`.

---

## R2 — Hub population query

**Decision**: Fetch candidate rows with server predicate `status = 'pending'` plus org/soft-delete guards; **client-side** filter to `isInvoiceOwed(row)` using the shared helper.

**Rationale**: User directive: population is `status='pending'` AND remaining > 0 via helper. Fully paid rows that still carry `pending` status but `amount_remaining = 0` (manual/offline mark-paid) must drop out client-side — a SQL `amount_remaining > 0` filter alone would miss rows where remaining is null but amount still shows full balance incorrectly, and would incorrectly include zero-remaining pending rows.

**Query source**: Same view as Invoices tab — `invoices_with_breakdown`.

**Server filters (every hub fetch)**:

| Filter | Value |
|--------|-------|
| `organization_id` | active org (from `useOrganization()` only) |
| `deleted_at` | `IS NULL` |
| `status` | `'pending'` |
| `amount` | `>= 5` GBP (test/seed floor; see R4) |

**Client filter after fetch**: `rows.filter(isHubEligibleInvoice)` then `isInvoiceOwed`.

**Alternatives considered**:
- Server `amount_remaining.gt.0` only — rejected (null remaining unpaid invoices would be excluded; diverges from drawer fallback rules).
- Fetch all statuses and filter client-side — rejected (unnecessary payload; draft/paid/cancelled excluded at SQL).

---

## R3 — Unreliable due-date threshold

**Decision**: A due date is **unreliable** when it is missing/empty OR `due_date >= '2100-01-01'` (ISO date string compare). Unreliable invoices belong only in the **No reliable date** horizon bucket and MUST NOT count as overdue or in due-within-30 / due-later buckets.

**Rationale**: User-provided concrete rule replaces spec assumption placeholder. Production data uses far-future placeholder dates that must not inflate “due later” or appear overdue decades away.

**Helper**: `isReliableDueDate(dueDate: string | null | undefined): boolean`.

**Horizon assignment** (applied only to owed + pending rows):

| Bucket | Rule |
|--------|------|
| **Overdue** | reliable date AND `due_date < today` |
| **Due within 30 days** | reliable date AND `today <= due_date <= today+30` |
| **Due later** | reliable date AND `due_date > today+30` |
| **No reliable date** | NOT reliable |

**Overdue flag (attention list)**: `isInvoiceOwed` AND reliable date AND `due_date < today` — same calendar rule as existing `isPastDue()` / `getDisplayStatus()` but only when date is reliable.

**Alternatives considered**:
- Relative threshold (issue_date + N years) — rejected (user fixed 2100-01-01 cutoff).
- Server-side PostgREST horizon filters — rejected for “no reliable date” (OR missing OR >= 2100); client-side bucket on hub dataset is simpler and matches triage UX.

---

## R4 — Test / seed and website-draft exclusion

**Decision**: Layered exclusion on hub dataset:

1. **SQL**: `amount >= 5` GBP (`MIN_HUB_INVOICE_AMOUNT_GBP`) — test/seed floor; **do not** filter on `is_test` (column unpopulated in production).
2. **SQL**: `status = 'pending'` excludes `draft` and `cancelled` website drafts (unfinalized/abandoned website-origin).
3. **Client**: `isHubEligibleInvoice(row)` = finalized pending with balance (`status === 'pending'` + `isInvoiceOwed`) + amount floor; includes finalized website-origin (e.g. `INV-WEB-*`) when pending with real balance.

**Rationale**: Spec FR-016 — must not depend on `is_test`. Amount floor is production-safe without row deletion or seed markers.

**Hub vs Invoices tab**: Hub ALWAYS applies amount floor regardless of `useTestDataMode` — triage figures must reflect real receivables. Invoices tab keeps existing behaviour unless follow-up task aligns them.

**Alternatives considered**:
- `is_test = false` SQL filter — rejected (excludes nothing in production).
- Hub respects `showTestData` toggle — rejected (misleading triage totals for operators).
- New DB column `is_website_draft` — rejected (out of scope; draft status covers v1).

---

## R5 — Horizon → Invoices tab routing

**Decision**: Add `FinanceInvoiceHorizonFilter` union (`'overdue' | 'due-30' | 'due-later' | 'no-date' | null`) as React state on `FinancePage`. Clicking a horizon segment sets `tab = 'invoices'`, `statusFilter = 'unpaid'`, and `horizonFilter` to the segment. `InvoicesTab` applies client-side horizon filter atop the unpaid query result using the same bucket helpers as the hub.

**Rationale**: PostgREST cannot express “due >= 2100 OR null” cleanly in one filter pill; client-side filter on shared bucket functions guarantees hub counts match routed table.

**Alternatives considered**:
- Separate query per horizon — rejected (duplicate fetch, count drift risk).
- URL query params — deferred (not required v1; in-page state sufficient).

---

## R6 — Attention list ordering and flags

**Decision**:

| Flag | Rule |
|------|------|
| **PARTIAL** | `amount_paid > 0` AND `isInvoiceOwed` |
| **OVERDUE** | `isInvoiceOwed` AND reliable due date AND past due |

**Sort priority** (descending):
1. PARTIAL + OVERDUE
2. OVERDUE only
3. PARTIAL only
4. Other owed (neither flag)

Within tier: ascending `due_date` (unreliable dates last).

**Rationale**: Matches spec FR-006–FR-009 and client fear (deposit taken, overdue second payment).

---

## R7 — Headline aggregates

**Decision**: Compute from hub filtered set (pending + owed + exclusions):

| Figure | Calculation |
|--------|-------------|
| Total outstanding | `sum(invoiceRemainingPence) / 100` GBP |
| Unpaid count | `count(owed rows)` |
| Total overdue | `sum(remaining pence)` where OVERDUE flag |

**Rationale**: Zero tolerance SC-002 — sums must equal attention-list + drawer remaining values.

---

## R8 — Existing Finance surfaces

**Decision**: Add `'hub'` as first tab and default `useState<Tab>('hub')`. Keep top order-based ribbon tiles (`useFinanceTotals`) unchanged. Keep Balance-chase / AI changes / Recent payments tabs unchanged.

**Rationale**: Spec AC-005; hub is additive invoice triage layer.

---

## R9 — Refactor `computePercentPaid`

**Decision**: Update `computePercentPaid` in `finance.invoices.api.ts` to derive total from `invoiceRemainingPence + paidPence` when owed, reusing the shared helper.

**Rationale**: Prevents progress bar drift from separate total math.
