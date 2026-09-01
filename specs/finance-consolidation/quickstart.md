# Quickstart — Finance Consolidation verification

All checks on **staging** (`https://staging.unifynow.digital`), SM org unless stated. Giorgi runs gates and drives the browser (or Playwright MCP); each UI check names the specific record verified. Gates: `npm run gate`; tsc by **item-diff** vs `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt` with `--strip-trailing-cr`, never by count.

## Step 0 — PRE-COMMIT-1 ribbon baseline capture (blocks C1; ruled 2026-09-01)

On `/dashboard/finance` (Hub tab, today's build), record **exact rendered values**:

```text
Date/time (UTC+4): 2026-09-01 __:__  (localhost:8080 build against live DB)
Invoiced & unpaid : £17,019
Overdue           : £17,019   secondary count: "2 invoices"
```

These two are hub-derived and get re-fed from the unified row set in C2 (spec flagged tension 2). After C2, with no data changes in between, the rendered values MUST equal this capture (re-check the underlying rows haven't changed if they differ — payments land daily on SM). The order-side tiles (Total order balance, Collected this month, Expected this month) are NOT part of this contract.

## Targets (from spec — run after the commit named; all eight after C5)

- [ ] **T1 (after C2)** — Named SM overdue invoice: `INV-______`. Appears under exactly ONE aging tile; clicking that tile shows it; the other three tiles hide it; never dimmed.
- [ ] **T2 (after C4b)** — Void rows behind the "Show voided" toggle: toggle OFF → zero void rows anywhere, any tile. Toggle ON + **All** → every void row renders dimmed with a "Void" badge — the 4 SM `INV-WEB-` rows among them (SM: 8 void as of 2026-09-01, incl. INV-000111/118/119/130; Churchill: INV-000133). Toggle ON + any aging tile → still zero. No data modified (read-back not needed — UI-only).
- [ ] **T3 (after C2)** — Expand one named invoice's order sub-rows, then switch tiles twice and back: expansion, search text, and the `?invoice=` sidebar all survive; DevTools Network shows **zero** new list requests during switches.
- [ ] **T4 (after C3)** — Hide "Days overdue" + one money column via the picker → full browser reload → both still hidden (localStorage `'invoices_column_state'`). Then reset/re-show. Fresh profile (incognito): default = maximal column set, `daysOverdue` visible, no phantom `actions` entry in the picker.
- [ ] **T5 (after C2)** — Churchill: all four aging tiles empty/zero; **All** shows exactly 1 row, dimmed (the single non-deleted invoice, void). Nothing errors on a near-empty org.
- [ ] **T6 (after C5)** — External callers land correctly (redirect pre-exists; verification only): inbox `OrderContextSummary` "Open invoice" (`?invoice=` opens the sidebar), payments `OutstandingTab` navigate, sidebar-Hub `HubPage.tsx:62` navigate, Priority page finance route. Sidebar "Hub" nav still opens `/dashboard/hub` unchanged (out-of-scope module untouched).
- [ ] **T7 (after C5)** — Param handling on the merged page: `?invoice=<id>` (sidebar opens), `?focus=collect`, `?stripe=success`, `?pay=success` each behave as today. Name the invoice id used: `____________`.
- [ ] **T8 (after C2)** — Ribbon comparison: Invoiced & unpaid and Overdue equal the Step-0 capture (same data). Record both values again here: £________ / £________ ("____ invoices").

## Per-commit gate checklist (every one of C1–C5)

- [ ] tsc item-diff: 0 new items; shifted keys re-anchored **in the same commit** (per-file grep of the baseline before running)
- [ ] lint: ≤ 10 err / 19 warn (≤ 8 err from C1 onward)
- [ ] `vitest`: `invoiceTransform.test.ts` + `ensureStripeInvoice.test.ts` green
- [ ] Browser check for that commit per plan.md's per-commit table, record named

## Sanity invariants (any commit, 30 seconds)

- Tile counts always equal the row count the tile shows when clicked (single-classification guarantee).
- A paid invoice shows Remaining £0.00 everywhere (paid ⇒ 0 rule).
- No `INV-WEB-` row and no dimmed row ever appears under the four aging tiles.
