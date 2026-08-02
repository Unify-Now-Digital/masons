# Quickstart: Verifying Orders Default View — Customers Only

**Date**: 2026-08-03 | **Plan**: [plan.md](./plan.md)

Read-only feature — no migration, no edge-function deploy, no data writes.

## 1. Typecheck (required before staging merge)

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Pass = 55 pre-existing errors, 0 new. (Bare `npx tsc --noEmit` checks nothing — solution tsconfig.)
`npm run build` does NOT typecheck; do not rely on it.

## 2. Manual verification (Sears Melvin, demo fixture)

```bash
npm run dev
```

Log in as a Sears Melvin user, open **Orders**, leave test-data mode OFF (default):

| # | Check | Expected |
|---|-------|----------|
| 1 | Default tab on load | **Customers** selected, no interaction needed |
| 2 | Customers row count | **6** — Barnett, Marshall, Henry, Campbell, Dean, Jalloh |
| 3 | Paid pill (P3) | Barnett, Marshall, Henry, Campbell show **Paid**; Dean, Jalloh do not |
| 4 | Client badge (P3) | All 6 show **Customer** (green); no row's badge contradicts its tab |
| 5 | Enquiries tab | Only orders whose job stage is `enquired`/`quoted` |
| 6 | Unassigned tab | **4** rows (7 unassigned minus 3 test) |
| 7 | All tab | Count = Customers + Enquiries + Unassigned |
| 8 | Old tabs gone | "All orders / In progress / Ready to install / Completed" row replaced |
| 9 | Search + cemetery filter | Still compose with the active tab |
| 10 | Test-data toggle ON | Unassigned grows to 7 (3 test rows appear with Test pill) |
| 11 | Pipeline board | Unchanged (jobsPipeline received a type-only export) |

Counts 2/6 were verified against production data on 2026-08-03 — re-verify just before the demo,
live data can move.

## 3. Live-derivation spot check (SC-004, optional)

In a **test org only** (never Churchill/Sears Melvin without approval): move a job from `quoted`
to `invoiced` via the pipeline board, refetch Orders — the order shifts Enquiries → Customers with
no order-row write.

## 4. Demo gating

Demo (2026-08-04) requires rows 1, 2, 5, 6, 7, 8 only (P1+P2). Rows 3–4 (badge/paid pill) are P3
polish and may land after.
