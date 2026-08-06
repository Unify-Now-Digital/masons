# Quickstart: Stage Automations — hand tests, E2E matrix, demo script

> **⚠️ There is no test org — both orgs (Churchill, Sears Melvin) are LIVE.** All testing runs on
> **Sears Melvin** using a **disposable test job** created through the UI, exercised, then deleted
> with the standard reference-check → org-guarded DELETE → read-back pattern. Every row created
> during testing (job, orders, invoices, any inline-created person/options) is tracked by id and
> removed in the same cleanup. Any direct SQL against SM (including cleanup DELETEs) is shown to
> Giorgi as exact statements and run only with his explicit per-change approval, per the
> multi-tenancy guardrails.

Verification commands:

```bash
npm run dev                                # dev server
npx tsc --noEmit -p tsconfig.app.json      # gate: 55 pre-existing errors, zero new
npm run lint
```

## §1 Disposable fixture (SM, UI-only writes)

1. In SM, create **one disposable test job** via the UI **Add to pipeline** flow (clearly named
   test person, e.g. "ZZ Stage-Automation Test"). Job starts at `enquired`.
2. Record in a scratch note: `job.id`, and the `person.id`/`conversation.id` **only if the flow
   created them fresh** (pre-existing rows are never deleted in cleanup).
3. Stage resets between test steps use **board drags** (adjacent moves, both directions on the
   before-paid axis) — this doubles as a regression check that `moveJobStage` is untouched.
   Note: manual drag *into* Invoiced is D4-gated (needs a linked invoice); dragging *out* of
   Invoiced backward is not gated.
4. **No Stripe objects, ever**: all test invoices must be Mason-only rows — no checkout session,
   no payment link. If a drawer path would create a Stripe object unconditionally, STOP and flag
   to Giorgi instead of proceeding; cleanup must never touch the live Stripe account.

## §2 Phase A — core function by hand (before any hook is wired)

Temporary dev-only exposure (removed before commit — it never ships):

```ts
// main.tsx, TEMPORARY:
if (import.meta.env.DEV) {
  import('@/modules/jobsPipeline').then((m) => {
    (window as any).autoAdvanceJobStage = m.autoAdvanceJobStage;
  });
}
```

Logged into SM, with the disposable job `J` from §1 (single job, sequenced — resets via board
drags). Check the returned boolean **and** the job card's column after each call:

| # | State of J | Call | Expect return | Expect stage after |
|---|---|---|---|---|
| 1 | `enquired` | target `'quoted'` | `true` | `quoted` |
| 2 | `quoted` | target `'quoted'` | `false` (at target — idempotent) | `quoted` |
| 3 | `quoted` | target `'invoiced'` | `true` | `invoiced` |
| 4 | `invoiced` | target `'invoiced'` | `false` (at target) | `invoiced` |
| 5 | `invoiced` | target `'quoted'` | `false` (backward) | `invoiced` |
| 6 | reset: drag `invoiced → quoted → enquired` | — | drags succeed (manual moves regression) | `enquired` |
| 7 | exit J via Exit modal (`lost`) | target `'quoted'` | `false` (exited) | `enquired`, still exited |
| 8 | reopen J via UI | — | J back on board at `enquired` | `enquired` |
| 9 | `enquired` | target `'quoted'` with **Churchill org UUID** | `false` (org guard; no write) | `enquired` |
| 10 | — | random UUID as `jobId` | `false` (not found) | — |
| 11 | — | target `'confirmed'` typed in editor | **TS compile error** (unrepresentable) | — |

**Post-paid guard (FR-007)** needs no live-job test: `earlierStages` is structurally
`['enquired']` or `['enquired','quoted']` — a post-paid stage can never match the `.in('stage', …)`
predicate. Verify by code inspection; do not run the function against any real post-paid SM job.

**Remove the temporary exposure** once the matrix passes (before Giorgi commits Unit 1).

## §3 Phase C — E2E matrix through the UI (SM, disposable job J; track every created id)

Sequence matters — each step leaves J where the next needs it, with drag-resets between:

| # | Scenario (spec ref) | J starts at | Steps | Expect |
|---|---|---|---|---|
| 1 | US2-1: order → quoted | `enquired` | create an order linked to J (conversation sidebar flow); record order id | J → **Quoted** column, no manual drag |
| 2 | US2-3: repeat order no-op | `quoted` | create a second linked order; record id | J unchanged at `quoted` |
| 3 | US1-1: invoice → invoiced | `quoted` | CreateInvoiceDrawer on J, **Mason-only path** (no Stripe); record invoice id | J → **Invoiced**; card shows invoice total; invoice row has no Stripe fields set |
| 4 | US1-3: repeat invoice no-op | `invoiced` | second Mason-only invoice; record id | invoice created, J unchanged |
| 5 | reset | `invoiced` | drag back to `enquired` | manual moves still work |
| 6 | US1-2: jump `enquired → invoiced` | `enquired` | Mason-only invoice via drawer; record id | J jumps two steps to `invoiced` |
| 7 | reset | `invoiced` | drag back to `enquired` | — |
| 8 | US4: combined drawer submission | `enquired` | drawer with **inline order + invoice** in one submit (Mason-only); record both ids | both rows created; J ends at **Invoiced** regardless of fire order |
| 9 | US1-4: invoice on exited job | any | exit J (`lost`); Mason-only invoice; reopen J | invoice created; stage unchanged while exited |
| 10 | US2-2: order without `job_id` | — | plain order from Orders page (no job link); record id | order created; no stage activity, no console noise beyond normal |
| 11 | US3: quote → order conversion | per availability | convert a quote whose order carries J's id (skip with a note if no quote fixture is practical — path shares `createOrder` + the same onSuccess branch) | linked: J → `quoted`; unlinked: no-op |
| 12 | FR-010: creation survives advance failure | any | devtools **offline** immediately after submit (or verify `.catch` path via console) | order/invoice row exists; only a `console.warn`; no error toast |

## §4 Cleanup (mandatory — SM is live)

Standard pattern, exact SQL shown to Giorgi for approval before anything runs:

1. **Reference-check** — enumerate everything pointing at the tracked ids:
   ```sql
   select id, job_id, invoice_id from orders   where organization_id = :sm and job_id = :job;
   select id, job_id               from invoices where organization_id = :sm and job_id = :job;
   -- plus: any additional-option rows for tracked orders; payments MUST be zero rows
   -- (Mason-only invoices, nothing was payable); untracked references → STOP, ask Giorgi.
   ```
2. **Org-guarded DELETEs**, children first, tracked ids only (no blanket `where job_id` deletes —
   every id explicit): option rows → orders → invoices → job → then person/conversation **only if
   §1 recorded them as freshly created**.
   ```sql
   delete from orders   where organization_id = :sm and id in (:tracked_order_ids);
   delete from invoices where organization_id = :sm and id in (:tracked_invoice_ids);
   delete from jobs     where organization_id = :sm and id = :job;
   ```
3. **Read-back** — every SELECT from step 1 re-run returns zero rows; paste the outputs into the
   session notes (evidence discipline: "ran" ≠ "rows affected").

## §5 Friday demo script (Arin)

1. Pipeline board open, a job visible in **Enquired**.
2. Open its conversation → Create Invoice from the drawer → submit.
3. Switch to the board: the card has jumped to **Invoiced** — "Task 2 already done: invoice created, stage moved itself."
4. Optional encore: second invoice on the same job → nothing moves (safe, idempotent); a confirmed job never gets dragged back.

## §6 Exit checklist before staging merge

- [ ] §2 matrix passed and temp exposure removed
- [ ] §3 matrix passed on SM disposable job
- [ ] §4 cleanup executed with approval; read-backs all zero rows, outputs recorded
- [ ] Zero Stripe objects created at any point
- [ ] `npx tsc --noEmit -p tsconfig.app.json` → 55 errors (baseline), zero new
- [ ] `npm run lint` clean for touched files
- [ ] Giorgi reviewed per-edit diffs and committed (Claude Code does not `git add`/`commit`)
