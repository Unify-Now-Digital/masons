# Tasks — Finance Consolidation

**Branch**: `feature/finance-consolidation` | **Date**: 2026-09-01 | **Plan**: `plan.md` (approved 2026-09-01, C1-ordering correction applied)
Script-free per precedent. One task group per commit (AC-F3); groups run strictly in order. Roles per CLAUDE.md: CC proposes diffs with grep evidence + predicted counts and applies **only after approval**; Giorgi runs every gate, every git command, every browser verify.

**Checkpoint legend** (every group ends with the same four, in order):
① **Approve** — CC shows the full diff + predictions (tsc item delta, lint delta, files, blast radius); Giorgi approves or amends. Conditional approvals block until explicit go.
② **Gate** — Giorgi: `npm run gate`; tsc item-diff vs baseline (`--strip-trailing-cr`), shifted keys re-anchored **in this same commit**, 0 new items; lint ≤ 10/19 (≤ 8 err from C1 on); the two util test files green.
③ **Commit** — Giorgi, explicit paths only (listed per group), message his.
④ **Verify** — Giorgi, staging browser, the named checks for the group; record the specific record/card checked.

---

## T000 — Step 0: ribbon baseline capture ⛔ BLOCKS C1 (Giorgi)

- [ ] On today's staging `/dashboard/finance` (Hub tab), fill quickstart.md Step 0: **Invoiced & unpaid** £value, **Overdue** £value + "N invoices" secondary count, timestamp (UTC+4).
- Done when: the three blanks in quickstart.md are filled (CC applies the edit on Giorgi's dictation, or Giorgi edits directly). No C1 diff is proposed before this.

---

## Group C1 — Data unification + remaining helper

**FRs**: FR-015, FR-017, FR-019 | **Quickstart after**: per-commit browser check only (no numbered target)
**Files**: `useInvoices.ts`, `invoicing.api.ts`, `finance.api.ts`, `invoiceRemaining.ts`, `invoiceTransform.ts`, `invoiceAmounts.ts`, `invoiceColumnDefinitions.tsx`, `CreateInvoiceDrawer.tsx`, `EditInvoiceDrawer.tsx`, `OrderFormInline.tsx`
**Expected baseline shifts** (plan.md table): `finance.api.ts(174,15)`; `invoicing.api.ts(49,10)` shift-or-resolve; drawer/OrderFormInline items (5) iff OQ1 edits land above them; `InvoiceWorkspace(87,29),(621,31)` iff consumption edit sits above. Preset-layer 3 untouched.

- [ ] **T101** (CC, read-only) Resolve OQ1: `grep -n computeTotals` across the three drawer files + repo-wide — state match count per file **before** proposing the rewire.
- [ ] **T102** (CC, read-only) Resolve OQ2: read `INVOICES_LIST_SELECT` (`invoicing.api.ts:34`); append the enumerated field list to data-model.md §1.
- [ ] **T103** (CC, read-only) Resolve OQ5: grep the `useInvoices` query-key literal; state every invalidation site + count — confirms the keep-the-key contract or forces a contract amendment **before** any edit.
- [ ] **T104** (CC) Propose the C1 diff per `contracts/unified-fetch-hook.md` + `contracts/bucket-helpers.md`: unified fetch (same key, **fetch order stays `created_at desc`** — ruled), `deleted_at IS NULL` + lint fix in `fetchFinanceTotals`, paid⇒0 fold, sole `isVoidedStripeInvoice`, `computeTotals` + inline re-derivation retired, drawers rewired.
- [ ] ①②③ Commit C1 (paths above). ④ Verify: page renders as today, both tabs; SM invoice **list identical** (same rows, same order); Remaining unchanged except paid-with-null-Stripe rows now £0.00 (name one such row if any exists, else state none found).

---

## Group C2 — Tile filter + All + due-horizon deletion (the merge)

**FRs**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-014 | **Quickstart after**: **T1, T3, T5, T8**
**Files**: `FinancePage.tsx`, `InvoiceWorkspace.tsx`, `finance.hub.api.ts`
**Expected baseline shifts**: `InvoiceWorkspace(621,31)`; `(87,29)` stable unless prop-plumbing lands above :87. All others stable.

- [ ] **T201** (CC, read-only) Resolve OQ6: read FinancePage's `InvoiceWorkspace` import line; if it's a new-style deep import, route via the module surface; note outcome in plan.md's constitution section.
- [ ] **T202** (CC) Propose the C2 diff per `contracts/table-filter-props.md` + `bucket-helpers.md`: single flow (ribbon → tiles+All → table), status tabs + `activeTab` predicate removed, due-horizon UI deleted with all five dependents re-derived (`buildFinanceSummary`, `classifyRowForFilter`), enquiry-hiding applied page-side before rows pass down, loading/error/empty states for the unified fetch, **no `key` on the workspace ever**.
- [ ] ①②③ Commit C2 (paths above). ④ Verify: **T1** (named SM overdue invoice, one tile), **T3** (expansion + sidebar + zero network on tile switch), **T5** (Churchill near-empty), **T8** (ribbon equals Step-0 capture — if it differs, check for interim data changes before treating as a miss).

---

## Group C3 — Table columns + defaults + Days overdue + progress bar

**FRs**: FR-006, FR-007, FR-008, FR-009 | **Quickstart after**: **T4**
**Files**: `invoiceColumnDefinitions.tsx`, `defaultColumns.ts`
**Expected baseline shifts**: none (`InvoiceWorkspace(621,31)` only if availableColumns wiring edits above it). Preset-layer 3 untouched — `defaultColumns.ts` holds no items.

- [ ] **T301** (CC, read-only) Resolve OQ3: read `columnState.ts` serialized shape; confirm unknown/stale ids (e.g. phantom `actions` in returning browsers) load without crash — if not, the diff must include tolerance.
- [ ] **T302** (CC, read-only) Resolve OQ4: read `FinancePage.tsx:534-545` + `isReliableDueDate`; confirm the Days-overdue cell can reuse it per `contracts/days-overdue-cell.md`.
- [ ] **T303** (CC) Propose the C3 diff: `PaymentProgressBar` ported into the Paid column, `daysOverdue` column (hideable, default visible, verbatim Hub text, date math shared with `getOverdueAgingBucket`), `defaultColumns.ts` synced (drop `actions`, add real set), maximal defaults.
- [ ] ①②③ Commit C3 (paths above). ④ Verify: **T4** (picker persistence across reload; incognito default = maximal, no phantom `actions`).

---

## Group C4 — Sort + search + enquiry toggle + void dim/badge

**FRs**: FR-010, FR-011, FR-012, FR-013, FR-018 | **Quickstart after**: **T2**
**Files**: `InvoiceWorkspace.tsx`, `invoiceColumnDefinitions.tsx`
**Expected baseline shifts**: `InvoiceWorkspace(621,31)` (search edits above it); `(87,29)` stable.

- [ ] **T401** (CC) Propose the C4 diff: client sort machinery with due-date-asc default (header-click stays out — backlog), amount added to the search predicate, "Show enquiry invoices" toggle (prefix match, default hidden, applied pre-bucketing per spec A-1), void rows dimmed under All only, badge fix at `invoiceColumnDefinitions.tsx:386-399` (display status wins).
- [ ] ①②③ Commit C4 (paths above). ④ Verify: **T2** (the 4 SM INV-WEB void rows: toggle/tile matrix, dim, "Void" badges), plus sort order spot-check (first row = earliest due date among visible) and one amount search hit.

---

## Group C5 — Deletions + subtitle

**FRs**: FR-016, FR-020, FR-021, FR-022 | **Quickstart after**: **T6, T7** + full regression T1–T5
**Files**: `FinancePage.tsx`, DELETE `InvoicingPage.tsx`, `invoicing/index.ts` (export line), DELETE `useFinanceInvoices.ts`, DELETE `finance.invoices.api.ts`, DELETE `useFinanceHub.ts` (iff consumer-free — grep first), `PageShell.tsx:57`
**Expected baseline shifts**: `InvoiceWorkspace` items only if dead-prop removal touches above them; deleted files hold no baseline items. Baseline may shrink; lint may shrink.

- [ ] **T501** (CC, read-only) Pre-deletion greps: confirm zero remaining references to each deleted symbol/file (`HubTab`, `InvoicesTab`, `InvoiceDrawer`, `TabButton`, `BalanceChaseTab`, `ExtrasTab`, `PaymentsTab`, AI banner, `useFinanceInvoices`, `fetchFinanceHubInvoices`, `InvoicingPage`, `SHOW_SECONDARY_FINANCE_TABS`) — count stated per symbol, expected 0 outside the deleted code itself. Sidebar-Hub exclusion re-checked: `src/modules/hub/`, `Sidebar.tsx:43-44`, `router.tsx:69`, `PriorityPage` untouched in the diff.
- [ ] **T502** (CC) Propose the C5 diff: dead components/state out of `FinancePage`, file deletions, `PageShell.tsx:57` subtitle rewritten (no balance-chase/AI mention).
- [ ] ①②③ Commit C5 (explicit paths incl. deletions). ④ Verify: **T6** (four external callers + Priority route + sidebar Hub untouched), **T7** (`?invoice=`, `?focus=collect`, `?stripe=success`, `?pay=success` — name the invoice id), regression pass over T1–T5.

---

## Group C6 — Docs

**FRs**: none | **Files**: `docs/backlog.md`, `docs/findings.md`, `docs/handoff.md`
**Baseline**: n/a (docs only).

- [ ] **T601** (CC) Propose docs diff: backlog += flag-gated tabs deleted (git retains; commit hash), real enquiry-marker column (shared-schema, portal team; note interaction with the Awaiting-Arin enquiry-invoice purge), header-click sorting; strike the P1 finance-consolidation product line; handoff updated **as a diff in place** with commit list, tripwire state, and quickstart results incl. the Step-0/T8 ribbon values (values only — no customer names/emails, no real UUIDs).
- [ ] ①③ Approve + commit C6 (no gate delta expected; Giorgi may still run it).

---

## Standing rules for every group

- Before any `replace_all`: `grep -A` the literal, expected match count per edit stated (indent trap).
- tsc baseline: per-file grep of `tsc-baseline-items.txt` for every edited file **before** running tsc; re-anchor line-shifted keys in the same commit; **never add items**; item-diff, never counts.
- Tripwire continues across implementation: predictions stated before applies; currently **2/3** — one more miss ⇒ propose stopping, deliver what's complete.
- Any live-data claim (e.g. "no paid-with-null-Stripe row exists on SM") is checked via supabase-ro before being asserted in a verify record.
