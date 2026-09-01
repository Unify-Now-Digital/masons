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

- [x] **T1 (after C2)** — Named SM overdue invoice: id not recorded. Appears under exactly ONE aging chip (C4c: chips in the table toolbar); clicking that chip shows it; the other three chips hide it; never dimmed.
- [x] **T2 (after C4b)** — Void rows behind the "Show voided" toggle: toggle OFF → zero void rows anywhere, any tile. Toggle ON + **All** → every void row renders dimmed with a "Void" badge — the 4 SM `INV-WEB-` rows among them (SM: 8 void as of 2026-09-01, incl. INV-000111/118/119/130; Churchill: INV-000133). Toggle ON + any aging tile → still zero. No data modified (read-back not needed — UI-only).
- [x] **T3 (after C2)** — Expand one named invoice's order sub-rows, then switch chips twice and back: expansion, search text, and the `?invoice=` sidebar all survive; DevTools Network shows **zero** new list requests during switches.
- [x] **T4 (after C3)** — Hide "Days overdue" + one money column via the picker → full browser reload → both still hidden (localStorage `'invoices_column_state'`). Then reset/re-show. Fresh profile (incognito): default = maximal column set, `daysOverdue` visible, no phantom `actions` entry in the picker.
- [x] **T5 (after C2; reworded C6 — pre-C4b text said "All shows exactly 1 row, dimmed")** — Churchill: all four aging chips zero; toggle OFF → **All** empty too; toggle ON → exactly 1 dimmed row (the single non-deleted invoice, void). Nothing errors on a near-empty org.
- [x] **T6 (after C5)** — External callers land correctly (redirect pre-exists; verification only): inbox `OrderContextSummary` "Open invoice" (`?invoice=` opens the sidebar), payments `OutstandingTab` navigate, sidebar-Hub `HubPage.tsx:62` navigate, Priority page finance route. Sidebar "Hub" nav still opens `/dashboard/hub` unchanged (out-of-scope module untouched).
- [x] **T7 (after C5)** — Param handling on the merged page: `?invoice=<id>` (sidebar opens), `?focus=collect`, `?stripe=success`, `?pay=success` each behave as today. Invoice id used: not recorded.
- [x] **T8 (after C2)** — Ribbon comparison: Invoiced & unpaid and Overdue equal the Step-0 capture (same data). Recorded: £17,019 / £17,019 ("2 invoices") — equal to Step-0.

## Amendment 1 targets (2026-09-02; live figures as of 2026-09-02 — re-check day-of, payments land daily)

- [x] **T9 (after C7)** — Stat filters + reconcile gap. (a) Click **Invoiced & unpaid**: stat renders selected, all chips deselect, table = exactly the union of the four chips' row sets (SM: 2 rows, both overdue); click again → All. (b) **Overdue**: same union of the three overdue buckets (SM: same 2 rows). (c) **Collected this month**: rows with `paid_at` in the current month (Sept as of 2026-09-02: 0 rows); caption reads "incl. order-level payments"; **reconcile check**: stat £ minus the listed rows' payments must equal order-level payments only (currently £0 — zero matched `order_payments` exist in either org). (d) **Expected this month**: filter applies cleanly to an empty set (no `installation_date` exists in either org) — empty state, no error; stat £0 with the new upper bound. (e) **Confirmed orders** (C7b): SM value **£41,194** (`total_order_value` sum, A1-2 ruled), caption **"9 confirmed orders"**; click → Orders page opens on the Confirmed tab and its tab badge also reads 9. Churchill: £0 / "0 confirmed orders". Mutual-exclusion spot-check: chip → stat → chip never leaves two things selected.
- [x] **T10 (after C8, at 1280 AND 1440; reworded C6 for C9c)** — Toolbar = the Invoices card header (C9c): heading + chip row + controls share the header line. Chip row ends with the "Show voided" chip-toggle (outline off / filled on; toggling still moves the All count exactly as T2). Search: icon only → click expands + focuses → typing filters → blur with text stays open → clear + blur collapses. Columns icon-only with tooltip on hover. **No Export button.** Create Invoice unchanged. At tight widths the controls wrap below the heading full-width, chips (incl. the voided chip) above the right-hand group, no truncation.
- [x] **T11 (after C9; reworded C6 for C9b)** — Pagination. With Show voided ON (SM = 13 rows): size 10 → "1–10 of 13", Next → "11–13 of 13", no filler rows. Viewport-fitted layout (C9b): the page itself never scrolls at 1440 or 1280 — rows scroll inside the card, the header row sticks under scroll, the pager stays visible (card height is viewport-set; the old "identical card height both pages" check is superseded). Expand a row, change page → it returns collapsed; column state + search text survive. Size 10 survives a full reload (localStorage `invoices_page_size`). Any chip/stat/search/toggle change → back to page 1. Deep link `?invoice=<id of a row on page 2>` → lands on page 2 with the sidebar open; id: UNRECORDED (Giorgi ruling 2026-09-02). Default size 25 → single page ("1–13 of 13").

## Per-commit gate checklist (every one of C1–C5)

- [ ] tsc item-diff: 0 new items; shifted keys re-anchored **in the same commit** (per-file grep of the baseline before running)
- [ ] lint: ≤ 10 err / 19 warn (≤ 8 err from C1 onward)
- [ ] `vitest`: `invoiceTransform.test.ts` + `ensureStripeInvoice.test.ts` green
- [ ] Browser check for that commit per plan.md's per-commit table, record named

## Sanity invariants (any commit, 30 seconds)

- Tile counts always equal the row count the tile shows when clicked (single-classification guarantee).
- A paid invoice shows Remaining £0.00 everywhere (paid ⇒ 0 rule).
- No void (dimmed) row ever appears under the four aging chips (the INV-WEB- predicate was retired in C4b).

## Outcomes (recorded C6, 2026-09-02)

- Step 0 captured 2026-09-01: £17,019 / £17,019 "2 invoices".
- T1 ✓ 2026-09-01 (after C2) — named invoice id not recorded.
- T2 ✓ 2026-09-02 (C4b matrix) — SM 8 void rows (4 INV-WEB- + INV-000111/118/119/130); Churchill INV-000133.
- T3 ✓ 2026-09-01 — zero list requests across chip switches; expansion + sidebar + search survived.
- T4 ✓ 2026-09-01 (after C3) — persistence across reload; incognito default maximal, no phantom 'actions'.
- T5 ✓ 2026-09-02 — Churchill empty everywhere with toggle off; one dimmed row under All with toggle on.
- T6 ✓ 2026-09-02 (after C5) — four external callers + Priority route + sidebar Hub untouched.
- T7 ✓ 2026-09-02 — all four params behaved; invoice id not recorded.
- T8 ✓ 2026-09-01 — ribbon equalled the Step-0 capture (£17,019 / £17,019 "2 invoices").
- T9 ✓ 2026-09-01/02 (after C7 + C7b) — SM £41,194 / "9 confirmed orders"; unpaid = overdue union = 2 rows; collected 0 rows; expected empty-clean; reconcile gap £0; mutual exclusion held.
- T10 ✓ 2026-09-02 (after C8, re-checked after C9c) — 1280 + 1440.
- T11 ✓ 2026-09-02 (after C9, re-run under the C9b layout) — "1–10 of 13"/"11–13 of 13"; deep-link page jump worked; invoice id UNRECORDED (Giorgi ruling 2026-09-02).
