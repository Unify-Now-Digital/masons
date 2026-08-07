# Quickstart: verifying Orders stage tabs

## 1. Type gate (before anything else)

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Pass = **exactly 55 errors, all pre-existing, zero new**. (Bare `npx tsc --noEmit` checks
nothing — solution tsconfig. `npm run build` passing proves nothing about types.)

During the migration, the *expected intermediate* errors are the compiler-guided sites listed
in plan.md's error inventory (TS2367 ×3 in orderColumnDefinitions.tsx; TS2345/TS2322 in
OrdersPage.tsx once `OrdersTab` typing is installed).

## 2. Visual verification (SM org)

```bash
npm run dev
```

Log in to the Sears Melvin org → Orders page. Check against the **pinned live-read counts**
(2026-08-07):

| Check | Expected |
|---|---|
| Landing tab | **Confirmed (8)** active by default |
| Tab strip | Enquired, Quoted, Invoiced under "BEFORE PAYMENT" label; Confirmed, In production, Fixed, Complete under "AFTER PAYMENT"; All + Unassigned unlabeled; strip scrolls horizontally with labels attached to their groups |
| Counts | Enquired 1 · Quoted 16 · Invoiced 2 · Confirmed 8 · In production 0 · Fixed 0 · Complete 0 · Unassigned 4 · All 31 |
| Sum invariant (SC-004) | stage tabs + Unassigned = All (27 + 4 = 31) |
| Invoiced tab rows | Stoddart, jalloh |
| Empty tabs | In production / Fixed / Complete visible with (0), selecting shows empty state (title + hint), not a bare table header |
| Unassigned | 4 rows, **all with TestPill** (live read: test_rows=4 — the spec's "~4 real" was stale) |
| Client badge vs tab | On every tab, badge never contradicts tab: Enquired/Quoted rows show grey "Enquiry"; Invoiced rows grey "Invoiced" (unpaid) or green "Customer" (paid); Confirmed+ rows green "Customer" when `paid_at` set; Unassigned rows grey "Unassigned" |
| Search + counts | Type a search term: counts on all tabs update from the same filtered list |
| Cemetery filter | With `?cemetery=` active, counts and rows stay consistent |

## 3. Exited badge

No SM row has `exit_reason` set (live read: exited=0 across all buckets), so this path can't be
verified against live data as-is. Options:
- Code review of the cell (grey `Badge` "Exited" rendered when `jobExitReason` non-null), or
- Disposable SM fixture per the established pattern (create → verify → approved DELETE …
  RETURNING id) — **requires explicit approval before any write**.

## 4. Regression spot-checks

- `?order=<id>` deep-link still opens the sidebar (untouched code path).
- Column presets / Columns dialog unaffected (localStorage `orders.columns.v1` is column state
  only — no tab state was ever persisted).
- Old bookmarks can't inject stale tabs: activeTab has no URL/localStorage source (plan R4).
