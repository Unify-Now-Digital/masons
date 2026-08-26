# Implementation Plan: Finance Gap-Fill — Progress Bars, Paid Fix, Overdue Aging

**Branch**: `feature/finance-gapfill-progress-bars-paid-fix-aging` | **Date**: 2026-08-26 |
**Spec**: `specs/finance-gapfill-progress-bars-paid-fix-aging/spec.md`
**Input**: Feature specification above + Giorgi's plan constraints (2026-08-26): hard sequence
US1 → US2 → US3; FR-007 slots anywhere (documentation-only); every AC respected as written;
each phase ends "STOP — wait for Giorgi"; gates named per phase; plan document only.

> **Artifact note (deviation from plan template, per instruction)**: this is a single plan
> document. Phase-0 research is folded in below (the spec's Step 0 audit *was* the research —
> every file:line in this plan was verified against source on 2026-08-26). No separate
> data-model.md/contracts/ (feature is read-only over one existing entity; the data model
> lives in the spec's Key Entities). `tasks.md` is deliberately NOT generated —
> `/speckit.tasks` runs only after Giorgi approves this plan.

## Summary

Three sequenced deliverables on the existing `/dashboard/finance` page, all read-only over
existing money data (AC-004): **US1** fixes the Paid-column lie for `status='paid'` invoices
with NULL `amount_paid` by adding a fallback rule at the single seam `computeTotals`
(`src/modules/invoicing/utils/invoiceAmounts.ts`), gated by a zero-row SELECT precondition on
both live orgs. **US2** extracts the Hub's inline progress bar into a shared
`PaymentProgressBar` (`src/shared/`, AC-002) and adds a per-row bar column to the live
Invoices table, percent computed from the fixed `computeTotals` output in pence end-to-end
(AC-005). **US3** sub-buckets the Hub Due-horizon Overdue segment into ≤7d / 7–30d / 30+d,
extending the existing segment pattern with existing click routing. **FR-007** produces a
documentation-only divergence note on the four order-line-label implementations.

## Technical Context

**Language/Version**: TypeScript ~5.x, React 18, Vite (SWC) — `vite build` does not typecheck
**Primary Dependencies**: TanStack React Query (existing hooks only), shadcn/Radix table
primitives, dnd-kit (existing column system), Supabase JS client (existing org-scoped reads)
**Storage**: Supabase Postgres via existing `invoices_with_breakdown` view — READ-ONLY this
cycle; the only production DB interaction is the FR-002 precondition SELECT, run by Giorgi in
the Dashboard SQL editor
**Testing**: no test runner in repo — gates are tsc item-diff, lint diff, and Giorgi's
browser verification (listed per phase)
**Target Platform**: web app, `/dashboard/finance` (Hub tab + Invoices tab), desktop + mobile
(<md column rules)
**Project Type**: web frontend feature slice across `src/modules/finance`,
`src/modules/invoicing`, `src/shared`
**Constraints**: AC-002 (bar in `src/shared/` — invoicing must not import finance, cycle risk
documented at `invoiceTransform.ts:34–36`); AC-004 (zero writes; age is display/filter only,
never routing beyond the existing segment-click pattern, never a write); AC-005 (pence
end-to-end: `amount` decimal pounds, `amount_paid`/`amount_remaining` bigint pence as JS
strings, `Number()` once, never mix units in one expression); AC-006 (reuse
`formatGbpDecimal`/`formatGbpPence`, no new formatters)
**Scale/Scope**: 2 live orgs (Churchill, Sears Melvin — both treated as live-money);
~6 source files touched across three phases + 1 new shared component + 1 audit note

### Research record (folded Phase 0 — verified 2026-08-26)

| Decision | Rationale / evidence |
|---|---|
| Fix seam is `computeTotals` (`invoiceAmounts.ts:21–37`), not finance helpers | Single decision point already feeding Paid column (`invoiceColumnDefinitions.tsx:313–326`), Remaining column (`:334–351`), `computeDerivedStatus` (`invoiceAmounts.ts:39–56`), and (post-US2) the bars |
| Bars read `amountPaidPence`/`totalPence` off `UIInvoice`, NOT `computePercentPaid` | A1: `computePercentPaid` (`finance.invoices.api.ts:64–71`) depends on `invoiceRemainingPence` (`invoiceRemaining.ts:65–80`) which carries the same paid-status blind spot — known-unfixed footnote, latent because Hub is pending-only (`isFinalizedPendingWithBalance`, `invoiceRemaining.ts:154`) |
| New table column needs DUAL registration | Render def in `invoiceColumnDefinitions.tsx` AND `invoicesColumns` in `src/shared/tableViewPresets/config/defaultColumns.ts:30` — the latter drives ColumnsDialog + default state (`getColumnDefinitions('invoices')`, `InvoiceWorkspace.tsx:810`) |
| Existing users' saved column state (localStorage `invoices_column_state`) lacks the new id | Safe by construction: visibility filter treats a missing key as visible (`InvoiceWorkspace.tsx:291`), and ids absent from the saved order sort last (`:293–299`) → new column appears at the end, visible, for existing users; no migration needed |
| US3 data source is `buildFinanceHubSummary` (`finance.hub.api.ts:85–113`) | Horizon populated per-row via `getInvoiceHorizonBucket` in one loop — aging sub-tally slots into the same loop, additively |
| US3 clicks reuse `handleHorizonNavigate` (`FinancePage.tsx:96–101`) | All three aging sub-buckets route exactly like today's Overdue segment (workspace Overdue tab). No new filter dimension — that's the deferred alternative |
| tsc gate format | Baseline `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt` = raw `error TS` lines from `tsc -p tsconfig.app.json`; regenerate current with the same `grep "error TS"` extraction and `diff --strip-trailing-cr` |

## Constitution Check

*Initial check (pre-design) and re-check (post-design): PASS — no violations, Complexity
Tracking empty.*

- **Dual router constraint**: PASS — no routing/navigation changes. US3 clicks go through the
  existing in-page `handleHorizonNavigate` state handler (tab + filter state, not routes).
- **Module boundaries**: PASS — `PaymentProgressBar` is promoted to `src/shared/` precisely
  because finance and invoicing both consume it and invoicing must not import finance.
  Finance edits stay in `src/modules/finance/`, invoicing edits in `src/modules/invoicing/`;
  no new cross-feature deep imports (finance→invoicing import at `FinancePage.tsx:13` is
  pre-existing and goes through the invoicing public surface).
- **Supabase + RLS**: PASS — zero new queries; all reads through existing org-scoped fetches.
  RLS remains the boundary (AC-003).
- **Secrets**: PASS — no edge-function changes. FR-007 *reads* three edge functions,
  changes nothing.
- **Additive-first**: PASS — fallback rule is a display-layer fallback (never overrides
  present consistent data, per the zero-row precondition); summary type extension is
  additive (`overdueAging` alongside untouched `horizon`); no schema changes, no writes
  (AC-004). The DB backfill alternative was considered and rejected in the spec (A3).

## Project Structure

### Documentation (this feature)

```text
specs/finance-gapfill-progress-bars-paid-fix-aging/
├── spec.md                  # spec (approved, amended ×3)
├── plan.md                  # this file
├── stripe-label-audit.md    # FR-007 deliverable (Phase A)
└── tasks.md                 # /speckit.tasks output — NOT YET generated
```

### Source Code (files touched, by phase)

```text
Phase B (US1):
  src/modules/invoicing/utils/invoiceAmounts.ts        # computeTotals fallback rule (only edit)

Phase C (US2):
  src/shared/components/PaymentProgressBar.tsx          # NEW — extracted bar (AC-002)
  src/modules/finance/pages/FinancePage.tsx             # swap attention-row inline bar (456–470)
  src/modules/invoicing/components/invoiceColumnDefinitions.tsx  # new bar column render def
  src/shared/tableViewPresets/config/defaultColumns.ts  # register column id (invoicesColumns)

Phase D (US3):
  src/modules/finance/utils/invoiceRemaining.ts         # add getOverdueAgingBucket (display-only)
  src/modules/finance/api/finance.hub.api.ts            # additive overdueAging tallies in summary
  src/modules/finance/pages/FinancePage.tsx             # Overdue segment sub-buckets UI + clicks

NOT touched (explicit): supabase/** (all four label implementations read-only per FR-007);
dormant InvoicesTab / InvoiceDrawer (flag-hidden; drawer swap OPTIONAL-deferred per A4);
src/modules/finance/utils/invoiceRemaining.ts remaining/percent helpers (known-unfixed
footnote — only the new aging helper is added, existing functions unedited).
```

**Structure Decision**: three vertical phases matching US1→US2→US3, each independently
verifiable in the browser, each ending at a hard STOP. FR-007 slots into Phase A (pure
documentation, zero source edits) so the audit note exists while the precondition is pending.

## Complexity Tracking

No constitutional violations — table intentionally empty.

---

## Phases

Every gate below, run and checked BEFORE the STOP. "tsc gate" and "lint gate" are defined
once here and referenced per phase:

**tsc gate (item-diff, not counts)**:

```bash
npx tsc --noEmit -p tsconfig.app.json | grep "error TS" > "$SCRATCHPAD/tsc-current-items.txt"
diff --strip-trailing-cr specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt "$SCRATCHPAD/tsc-current-items.txt"
```

Pass = empty diff (exit 0). Any `>` line is a new error → fix before STOP. (`--strip-trailing-cr`
required on Windows; `$SCRATCHPAD` = session scratchpad, never committed.)

**lint gate**: `npm run lint` — pass = no new errors/warnings vs the accepted 10-error /
19-warning baseline (25 Aug). Report exact counts at each STOP.

### Phase A — Preconditions + FR-007 audit note (no source edits)

1. **A0 (Giorgi, read-only check)**: verify (read-only) that `CLAUDE.local.md` lists
   Churchill ending `...ba9bc` — no edit needed. DB verification
   (`SELECT id, name FROM organizations`, 2026-08-26) confirmed `CLAUDE.local.md` is
   CORRECT; the divergent record was elsewhere and is fixed. Substitute UUIDs into the
   FR-002 SQL by copy-paste from `CLAUDE.local.md` only.
2. **A1 (Giorgi, blocking for Phase B)**: run the FR-002 precondition SQL (spec, User
   Story 1) in the Supabase Dashboard SQL editor, substituting both UUIDs from
   `CLAUDE.local.md` per A0. Read-only. Paste the raw output back into this session.
   - **Zero rows** → Phase B unblocked; output gets recorded in the implementation record.
   - **≥1 row** → FR-001 does NOT ship; Claude reports the rows and we re-spec.
3. **A2 (Claude, doc-only)**: write
   `specs/finance-gapfill-progress-bars-paid-fix-aging/stripe-label-audit.md` — the
   FR-007 divergence note: read `src/modules/orders/utils/orderLineLabel.ts` and the three
   edge functions (`stripe-create-invoice`, `stripe-create-invoice-payment-link`,
   `stripe-create-checkout-session`), answer with file:line evidence whether the four
   produce identical labels for the same order today, and list any drift. NO code changes
   to any of the four.

**Gates**: none (no source edits). Deliverables: audit note file + Giorgi's pasted SQL output.

**STOP — wait for Giorgi** (precondition verdict + audit note review).

### Phase B — US1: `computeTotals` fallback rule (blocked by A1 zero-row verdict)

1. Edit `computeTotals` (`src/modules/invoicing/utils/invoiceAmounts.ts:21–37`) — the only
   source edit this phase: when `invoice.status === 'paid'` and `totalPence` is resolvable,
   return `paidPence = totalPence`, `remainingPence = 0`. Pence end-to-end (AC-005); rule
   keys on status only, so pending/draft/overdue paths are byte-identical to today.
2. Verify inherited surfaces by reading, not editing (all consume `computeTotals` output):
   - Paid column → full total (100%) on paid rows (`invoiceColumnDefinitions.tsx:313–326`)
   - Remaining column → £0.00 (0%) (`:334–351`)
   - `computeDerivedStatus` → `'paid'` (remaining 0, paid > 0) → Status badge "Paid"
   - `StripePaymentLinkCell` `isPaid` (`invoiceColumnDefinitions.tsx:28–31`) — **intended
     behavior change to verify**: offline-paid rows now show the "Paid" text instead of
     Link/Full/Partial buttons (prevents collecting on already-collected invoices)
3. Surfaces deliberately UNCHANGED (state in the STOP report):
   - `isLocked` (`invoiceTransform.ts:85–86`) reads raw `amount_paid` — offline-paid
     invoices stay editable exactly as today (not in scope to change)
   - `InvoiceDetailSidebar` reads raw `invoice.amount_remaining`
     (`InvoiceDetailSidebar.tsx:107`) — collect-payment section stays hidden for NULL
     remaining, as today
   - Finance-module helpers (`invoiceRemainingPence`/`computePercentPaid`) — known-unfixed
     footnote, latent, untouched
4. Edge to confirm in code: zero-amount paid invoice (`totalPence === 0`) falls to
   `derivedStatus 'unknown'` → "Pending" badge — same as today, spec Edge Cases cover it.

**Gates before STOP**: tsc gate; lint gate; then **Giorgi's browser verification** (Finance →
Invoices tab, Paid tab and All tab):

- [ ] A previously-lying row (Paid badge + "£0.00 (0%)") now shows Paid = full total
      "(100%)" and Remaining "£0.00 (0%)" (US1-AS1)
- [ ] A Stripe-paid row (real `amount_paid`) renders identically to before (US1-AS2)
- [ ] A pending, partially-paid row is unchanged — partial amounts intact (US1-AS3)
- [ ] Offline-paid rows' Stripe column now reads "Paid" (no Link/Full/Partial buttons)
- [ ] Spot-check the detail sidebar on one paid row — no regression in its amounts section

**STOP — wait for Giorgi.**

### Phase C — US2: `PaymentProgressBar` + table bar column (blocked by Phase B approval)

1. Create `src/shared/components/PaymentProgressBar.tsx` (AC-002): props `percent`
   (0–100, pre-clamped number) + optional tone/track colors defaulting to the Hub geometry —
   h-1.5 rounded track `var(--g-red-dk)`, fill `var(--g-grn-dk)` (`FinancePage.tsx:458–469`).
   Purely presentational: no data fetching, no formatting, no currency text (AC-006 —
   adjacent text keeps existing column formatting).
2. Swap Hub Needs-attention rows (`FinancePage.tsx:456–470`) onto the component.
   Pixel-parity required (SC-003); the row keeps its existing `computePercentPaid` call —
   safe there (Hub is pending-only), only the visual swaps (A1).
3. Add bar column:
   - Render def in `invoiceColumnDefinitions.tsx`: id `paymentProgress`, percent =
     `amountPaidPence / totalPence * 100` clamped, from `computeTotals` output already on
     `UIInvoice` — NOT `computePercentPaid` (FR-003); `totalPence == null` → render "—"
     exactly like the Paid column (US2-AS4); pence end-to-end, no unit mixing (AC-005).
   - Register `{ id: 'paymentProgress', label: 'Progress', defaultWidth: ~140 }` in
     `invoicesColumns` (`defaultColumns.ts:30`) so ColumnsDialog + default state see it.
   - Header is a plain label div (no interactive controls) — if any control is ever added,
     Orders-header event discipline applies (click+pointerdown stopPropagation, FR-005).
   - Mobile: no `mobilePriority` → hidden <md by existing rules (US2-AS5).
   - Existing users: saved `invoices_column_state` lacks the id → column appears last,
     visible (verified fallback, `InvoiceWorkspace.tsx:291–299`). Acceptable per research;
     users can reorder/hide via ColumnsDialog.

**Gates before STOP**: tsc gate; lint gate; then **Giorgi's browser verification**:

- [ ] Invoices tab: every row shows a bar; a ~40%-paid pending row's fill matches its Paid
      column percent (US2-AS1)
- [ ] A paid row's bar is 100% (US2-AS2)
- [ ] Hub tab: Needs-attention bars look identical to before the swap — geometry, colors,
      percentages (US2-AS3 / SC-003, side-by-side vs a screenshot taken before Phase C)
- [ ] A row with unusable amounts shows "—" in the bar column, not an empty 0% bar (US2-AS4)
- [ ] Narrow window (<md): bar column hidden; Ref/Person/Amount/Status intact (US2-AS5)
- [ ] Columns dialog lists "Progress"; hide/show, drag-reorder, and resize all work (FR-005)

**STOP — wait for Giorgi.**

### Phase D — US3: Hub Overdue aging sub-buckets (blocked by Phase C approval)

1. `src/modules/finance/utils/invoiceRemaining.ts`: add `getOverdueAgingBucket(row, today)`
   → `'d7' | 'd7to30' | 'd30plus'` for rows already bucketed `overdue`; boundary days to
   the earlier bucket (`d ≤ 7`, `7 < d ≤ 30`, `d > 30`); unreliable due dates never reach it
   (guarded by the existing `overdue` bucketing via `isReliableDueDate`). Display-only
   helper; existing functions untouched.
2. `src/modules/finance/api/finance.hub.api.ts`: extend `FinanceHubSummary` additively —
   `overdueAging: { d7: HorizonSegmentSummary; d7to30: …; d30plus: … }` tallied in the same
   `buildFinanceHubSummary` loop (`:93–102`). Invariant (US3-AS3): the three sub-tallies sum
   exactly to `horizon.overdue` count and balance — assert by construction (tally both from
   the same row in the same iteration).
3. `FinancePage.tsx`: render three sub-buckets on/under the Overdue segment, extending the
   existing segment tile pattern (`:507–534` — same count + balance display, same
   zero-count disabled/dimmed treatment). Clicks call the existing
   `handleHorizonNavigate('overdue')` (`:96–101`) — identical routing to today's Overdue
   segment click, no new behavior class, display/filter only (AC-004; age never routes
   anywhere new, never writes).

**Gates before STOP**: tsc gate; lint gate; then **Giorgi's browser verification** (Hub tab):

- [ ] Overdue segment shows three sub-buckets; with live data, sub-counts + balances sum to
      the Overdue segment's own count + balance (US3-AS3)
- [ ] An invoice N days overdue sits in the right bucket — check one known invoice per
      bucket if available (US3-AS1; boundary rule: 7d → ≤7d bucket)
- [ ] Placeholder-due-date invoices appear in no aging bucket (US3-AS2)
- [ ] Clicking a non-empty sub-bucket opens the Invoices tab Overdue-filtered, exactly like
      the main Overdue segment; zero-count sub-buckets are disabled (US3-AS4)
- [ ] Other three horizon segments (Due 30 / Due later / No date) unchanged

**STOP — wait for Giorgi.**

### Phase E — Merge prep (blocked by Phase D approval)

1. Full-run gates: tsc gate + lint gate on the final tree; `npm run build` green (noting it
   proves transpile only, per CLAUDE.md build discipline).
2. Reconcile the spec: tick SC-001…SC-006 with evidence (incl. Giorgi's pasted precondition
   output in the implementation record and the FR-007 note path); confirm zero-writes
   claim (SC-004) — the diff must contain no `supabase/migrations/` entries and no
   INSERT/UPDATE/DELETE anywhere.
3. Final grep guard: no real org UUIDs anywhere in the diff
   (`grep -rnE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'` over changed
   files — expected empty).
4. Show Giorgi the summarized diff; on approval, PR `feature/finance-gapfill-progress-bars-
   paid-fix-aging` → `staging` per branching rules. No commit/push before that approval.

**STOP — wait for Giorgi** (merge decision).

## Progress Tracking

- [x] Phase 0 research — folded (Step 0 audit + this plan's research record); no unknowns
      remain, no NEEDS CLARIFICATION in Technical Context
- [x] Constitution Check (initial) — PASS
- [x] Phase 1 design — folded into Phases + Project Structure (single-doc plan per
      instruction; data model unchanged, in spec Key Entities)
- [x] Constitution Check (post-design) — PASS, Complexity Tracking empty
- [ ] Phase 2 `tasks.md` — NOT generated (awaits Giorgi approval + `/speckit.tasks`)
- [ ] Phases A–E execution — not started; A0/A1 are Giorgi actions
