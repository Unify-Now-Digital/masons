# Quickstart: verifying the After-payment tab

**Date**: 2026-08-06 | **Plan**: [plan.md](plan.md)

Manual verification walkthrough. Run the relevant section after each commit unit; run all
of it before merging to `staging`. Live orgs are read-only from the browser as a normal
user — the move/exit walkthroughs that *change* data must be done in a test org (IDs in
`CLAUDE.local.md`), **never** in Churchill or Sears Melvin without Giorgi driving.

## Gate 0 — typecheck (after every commit unit)

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Pass = exactly the 55 pre-existing baseline errors, zero new. (`vite build` proves nothing.)

## Gate 1 — before-paid board parity (after the StageBoard extraction commit)

1. `git diff staging -- src/modules/jobsPipeline/hooks/useJobsPipeline.ts src/modules/jobsPipeline/api/jobsPipeline.api.ts`
   — `useJobsPipeline.ts` diff must be **empty**; `jobsPipeline.api.ts` must show no change
   to `fetchActiveJobs`.
2. `npm run dev`, open Pipeline as Sears Melvin: before board still shows
   enquired 21 / quoted 17 / invoiced 2 (06 Aug distribution), column headers still read
   Enquired / Quoted / Invoiced, invoice totals still show on invoiced cards, the
   "Needs a linked invoice" disabled state still appears on quoted cards without invoices.
3. Exited tab + due-dormant badge unchanged.

## P1 — the demo path (Friday)

As **Sears Melvin**:
1. Pipeline page shows three tabs: Before payment (40), After payment (8), Exited.
2. After payment tab: four columns Confirmed / In production / Fixed / Complete;
   8 cards under Confirmed — Barnett, Marshall, Henry, Campbell, Hazrati, Lindsey, Faith,
   Dean; other three columns show 0.
3. Cards open their linked conversation in the Inbox on click (same as before board).
4. No card shows the "Not marked paid" warning (all 8 are paid).

As **Churchill**: After payment tab shows the empty state (no error, no blank screen).

Page subtitle no longer says the page is before-payment-only.

## P2 — moves (test org only)

Seed a test-org job at `confirmed` (and one at `quoted` for the cross-axis check).
1. Forward: confirmed → In production → Fixed → Complete; each move persists across reload.
2. Complete column cards show no forward arrow; Confirmed column cards show **no back
   arrow** (FR-009 — no backward exit from the after axis).
3. Back: complete → fixed → in_production → confirmed all work.
4. Cross-axis rejection (API level, e.g. via devtools/console): `invoiced → confirmed` and
   `confirmed → invoiced` both throw `Invalid stage move` with no DB write.
5. Buttons disabled while a move is pending.
6. After any move, the Before/After tab counts update without a manual refresh.

## P3 — exits (test org only)

1. From the After payment tab, exit a job: modal offers **On hold** and **Cancelled** only
   (no Lost/Closed/Dormant, no wake-date field ever appears).
2. Confirm Cancelled: job leaves the after board, appears in Exited with an exit date.
3. Reopen it from Exited: it returns to the **After payment** board at its stored stage.
4. From the Before payment tab, exit a job: still offers Lost / Closed / Dormant only, and
   Dormant still requires a wake date (regression check).
5. FR-005 dark path: in the test org, set a job to stage `confirmed` with `paid_at` NULL
   (SQL in test org only). It renders in Confirmed with an amber "Not marked paid" pill —
   it does not vanish.

## Merge checklist

- [ ] Gate 0 clean on the final state
- [ ] Gate 1 parity holds
- [ ] P1 walkthrough passes on both live orgs (read-only)
- [ ] P2 + P3 pass in a test org
- [ ] SC-002 spot check: Before count + After count + Exited list = org's total job count
- [ ] One concern per commit; Giorgi staged and committed everything himself
