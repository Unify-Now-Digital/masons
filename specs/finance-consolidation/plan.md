# Implementation Plan: Finance Consolidation

**Branch**: `feature/finance-consolidation` | **Date**: 2026-09-01 | **Spec**: `specs/finance-consolidation/spec.md`
**Input**: Feature spec + plan-time directives from Giorgi (2026-09-01): research F2-only with §cites and open questions listed not guessed; client-side shapes only in data-model; contracts = the hand-offs between the six commits; FR→commit map 1:1 with per-commit baseline-shift expectations; quickstart = the eight verification targets incl. pre-commit-1 ribbon baseline capture; constitution check run honestly; script-free per the inbox-sidebar-multi-tabs precedent (spec-kit's setup script rejects `feature/*` branches and would create a second directory).

## Summary

Merge the Finance page's Hub and Invoices tabs into one view — summary ribbon, aging tiles (≤7d / 7–30d / 30+d / Not yet due / **All**) as the only filter, one maximal-column invoice table — fed by a single `invoices_with_breakdown` fetch, with remaining unified on `invoiceRemainingPence` (paid ⇒ 0), due-date-asc default sort, amount search, enquiry-prefix toggle, void dim + badge fix, and deletion of the tab shell plus all flag-gated dead surfaces. Six commits, one concern each; state survives filtering because the table is mounted once and never key-remounted.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite (SWC)
**Primary Dependencies**: existing only — TanStack Query, shadcn/Radix, Tailwind, `PaymentProgressBar` (ported, not new), shared `tableViewPresets`. **No new dependency, no new module id.**
**Storage**: none new — read-only view `invoices_with_breakdown`; localStorage `'invoices_column_state'`. **No schema change (AC-F4).**
**Testing**: no DOM test env (F2 §11) — staging browser verification per quickstart.md + gates; `invoiceTransform.test.ts` and `ensureStripeInvoice.test.ts` must stay green.
**Target Platform**: desktop web, `/dashboard/finance`
**Project Type**: web frontend; two feature modules touched (`finance`, `invoicing`) + `shared/tableViewPresets` config + one layout file
**Performance Goals**: exactly one list request per load (SC-001); filter changes = zero refetches, zero remounts (SC-002)
**Constraints (immovable)**: AC-F1 tsc item-diff re-anchored same-commit, never added to; AC-F2 lint ≤ 10 err/19 warn; AC-F3 six commits in order; AC-F5 gates + named records. Money units per CLAUDE.md (pence strings → `Number()`, never ×100).
**Scale/Scope**: ~10 files modified, 4+ deleted, 1 new hook file, 6 commits. Live data is small (SM 25 invoices, Churchill 24 — F2 §3), so client-side bucketing is proportionate.

## Constitution Check

*Run honestly per directive; strains stated, FRs not softened.*

- **Dual router constraint**: PASS — no route added/moved/renamed; `/dashboard/invoicing` redirect pre-exists (verification only). `src/app/` + `src/pages/` untouched.
- **Module boundaries**: **STRAINED, pre-existing, deepened knowingly.** `FinancePage` (modules/finance) already composes `InvoiceWorkspace` (modules/invoicing); C2 adds tile-filter props across that boundary, and the canonical money helpers live in `modules/finance/utils/invoiceRemaining.ts` while their heaviest consumers are invoicing components. This is today's architecture (CLAUDE.md itself names `invoiceRemaining.ts` canonical); promoting the helpers or the table to `src/shared/` is real work that is **not** in scope. Import goes via the module public surface if it already does (OQ6 — checked at C2, not silently deep-imported anew).
- **Supabase is source of truth / RLS**: PASS — read paths only; every fetch org-guarded at the query layer; no policy/table change.
- **Secrets server-side**: PASS — no edge-function or key work.
- **Additive-first / minimise regressions**: **INTENTIONAL VIOLATION, ruled.** C5 deletes `HubTab`/`InvoicesTab`/`InvoiceDrawer`/`InvoicingPage`/`useFinanceInvoices` and the flag-gated `BalanceChaseTab`/`ExtrasTab`/`PaymentsTab`/AI banner (off since 2026-07-19). Ruled by Giorgi in the spec (FR-020/021); git history retains; rollback = revert C5. Behavioural surfaces that matter are preserved-by-reimplementation (ribbon values byte-identical — quickstart step 0 baseline; expansion/sidebar unchanged — FR-005).

## Project Structure

### Documentation (this feature)

```text
specs/finance-consolidation/
├── spec.md            # written 2026-09-01, rulings applied
├── plan.md            # this file
├── research.md        # Phase 0 — F2-sourced, §-cited, OQ1–OQ6 open
├── data-model.md      # Phase 1 — client-side shapes only
├── quickstart.md      # Phase 1 — 8 verification targets + step-0 baseline capture
├── contracts/         # Phase 1 — unified-fetch-hook, bucket-helpers, table-filter-props, days-overdue-cell
└── tasks.md           # Phase 2 — /tasks output (NOT created by /plan)
```

### Source Code (files per commit; line refs are F2's — re-verify on shift)

```text
C1  src/modules/invoicing/hooks/useInvoices.ts            # unified fetch (same query key)
    src/modules/invoicing/api/invoicing.api.ts            # filters only — fetch order stays created_at desc (all ordering is FR-012's, C4; ruled 2026-09-01)
    src/modules/finance/api/finance.api.ts                # deleted_at IS NULL; :95-96 lint fix
    src/modules/finance/utils/invoiceRemaining.ts         # paid⇒0 fold; sole isVoidedStripeInvoice
    src/modules/invoicing/utils/invoiceTransform.ts       # duplicate predicate → import
    src/modules/invoicing/utils/invoiceAmounts.ts         # computeTotals retired
    src/modules/invoicing/components/invoiceColumnDefinitions.tsx  # inline re-derivation :364-367 removed
    src/modules/invoicing/components/{CreateInvoiceDrawer,EditInvoiceDrawer}.tsx,
    src/modules/orders/…/OrderFormInline.tsx              # computeTotals consumers rewired (OQ1 grep first)
C2  src/modules/finance/pages/FinancePage.tsx             # single flow; tiles+All; due-horizon UI out
    src/modules/invoicing/components/InvoiceWorkspace.tsx # status tabs out; tile props in
    src/modules/finance/api/finance.hub.api.ts            # summary engine re-fed / superseded by buildFinanceSummary
C3  src/modules/invoicing/components/invoiceColumnDefinitions.tsx  # progress bar in Paid; daysOverdue col
    src/shared/tableViewPresets/config/defaultColumns.ts  # sync; drop phantom 'actions'; maximal defaults
C4  src/modules/invoicing/components/InvoiceWorkspace.tsx # sort impl; amount search; enquiry toggle; void dim
    src/modules/invoicing/components/invoiceColumnDefinitions.tsx  # badge fix :386-399
C5  src/modules/finance/pages/FinancePage.tsx             # dead components/state deleted
    src/modules/invoicing/pages/InvoicingPage.tsx (DELETE), src/modules/invoicing/index.ts (export line)
    src/modules/finance/hooks/useFinanceInvoices.ts (DELETE), src/modules/finance/api/finance.invoices.api.ts (DELETE)
    src/modules/finance/hooks/useFinanceHub.ts (DELETE if consumer-free after C2)
    src/components/layout/PageShell.tsx                   # :57 subtitle rewrite
C6  docs/{backlog,findings,handoff}.md                    # backlog lines: deleted flag-gated tabs; portal enquiry column; header-click sort
```

**Structure Decision**: existing module layout; zero new directories; one new file at most (none if the unified hook stays inside `useInvoices.ts`).

## FR → Commit map (AC-F3; each FR exactly once)

| Commit | Concern | FRs |
|---|---|---|
| **C1** | Data unification + remaining helper (+ data-layer hygiene rides here: FR-019 is `finance.api.ts` work, same concern surface) | FR-015, FR-017, FR-019 |
| **C2** | Tile filter + All + due-horizon deletion; the merge itself; state-survival guarantee born here | FR-001, FR-002, FR-003, FR-004, FR-005, FR-014 |
| **C3** | Table columns + defaults + Days overdue + progress bar | FR-006, FR-007, FR-008, FR-009 |
| **C4** | Sort + search + enquiry toggle + void dim/badge | FR-010, FR-011, FR-012, FR-013, FR-018 |
| **C5** | Deletions + subtitle (files whose last references dropped in C2) | FR-016, FR-020, FR-021, FR-022 |
| **C6** | Docs | — (backlog/findings/handoff; no FR) |

All FR-001…FR-022 mapped; none twice. Note: FR-005/FR-008 are preservation requirements — mapped to the commit that creates their risk (C2 remount risk; C3 defaultColumns sync risk).

## Per-commit tsc baseline plan (AC-F1 — re-anchoring planned, not discovered)

Baseline items in scope (F2 §12): `finance.api.ts(174,15)`; `invoicing.api.ts(49,10)`; `CreateInvoiceDrawer.tsx(338,55),(425,55)`; `EditInvoiceDrawer.tsx(100,7),(115,9),(149,22)`; `InvoiceWorkspace.tsx(87,29),(621,31)`; `OrderFormInline.tsx(83,7)`. Conditional (preset layer): `tableViewPresets.api.ts(31,15),(41,37)`, `PresetsTab.tsx(65,7)` — **expected untouched all six commits** (`defaultColumns.ts` holds no baseline items).

| Commit | Items expected to LINE-SHIFT (re-anchor same commit) | Expected stable |
|---|---|---|
| C1 | `finance.api.ts(174,15)` (edits at :58-62 and :95-96 above it); `invoicing.api.ts(49,10)` (edit is *at/inside* :36-50 — may shift **or resolve**; resolving shrinks the baseline, allowed); `CreateInvoiceDrawer(338,55),(425,55)`, `EditInvoiceDrawer(100,7),(115,9),(149,22)`, `OrderFormInline(83,7)` **iff** the OQ1 rewiring edits land above those lines — grep decides at commit time; `InvoiceWorkspace(87,29),(621,31)` iff the hook-consumption edit sits above them | preset-layer 3 |
| C2 | `InvoiceWorkspace(621,31)` (tab strip :535-542 + predicate :428-432 removed above it); `(87,29)` stable unless prop-plumbing edits land above :87 | drawers, `finance.api.ts`, preset-layer |
| C3 | none expected (`invoiceColumnDefinitions.tsx` + `defaultColumns.ts` hold no items); `InvoiceWorkspace(621,31)` only if availableColumns wiring edits above it | all |
| C4 | `InvoiceWorkspace(621,31)` (search :433-435 edits above it); `(87,29)` stable | drawers, preset-layer |
| C5 | `InvoiceWorkspace(87,29)/(621,31)` if dead-prop removal touches above; deleted files hold **no** baseline items (verified against §12 list) | drawers, `finance.api.ts` |
| C6 | none (docs only) | all |

Procedure every commit: `grep` the baseline file for each edited source file **before** `tsc`, item-diff with `--strip-trailing-cr`, re-anchor shifted keys in the same commit, **never add items** (line-shift trap per memory: keys are `file(line,col)` — edits above an item masquerade as NEW+RESOLVED).

**Lint plan (AC-F2)**: C1 removes the 2 errors at `finance.api.ts:95-96` → ≤ 8 err from C1 on. C5's deletions may remove counted items (shrink fine). No commit may add any. `invoiceColumnDefinitions.tsx:18` warning expected to persist (count-only baseline covers it).

## Per-commit gate + verify predictions

| Commit | tsc item-diff | lint | Browser check (staging, named record) |
|---|---|---|---|
| C1 | 0 new; shifts per table above | −2 err | Page renders as today (both tabs); SM invoice list identical; Remaining column values unchanged except paid-with-null-Stripe rows now £0.00 |
| C2 | 0 new | 0 delta | Quickstart targets 1, 3, 5, 8-compare; ribbon values = step-0 capture |
| C3 | 0 new | 0 delta | Targets 4 + column set vs FR-007; fresh-profile default = maximal |
| C4 | 0 new | 0 delta | Targets 2 + sort order + amount search + void badge on the Churchill void row |
| C5 | 0 new; baseline may shrink | ≤ baseline | Full page regression: targets 1–5, 6 (external callers), 7 (params) |
| C6 | n/a | n/a | n/a |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Additive-first: C5 deletes shipped-but-dead UI (flag-gated tabs, InvoiceDrawer, InvoicingPage) | Product ruling (spec FR-020/021, ruled 2026-09-01); dead code is a maintenance and confusion cost the merge is meant to end | "Park behind the flag" keeps unreachable code whose mount points C2 removes anyway; git retains everything |
| Module boundary: finance↔invoicing coupling deepened (tile props) | The merged page *is* both modules' surfaces composed; helpers already canonical in finance per CLAUDE.md | Promoting table/helpers to `src/shared/` is a real refactor with its own blast radius — out of scope, noted for backlog if the coupling grows again |

## Phase 2 approach (for /tasks)

tasks.md derives one task group per commit C1–C6 in AC-F3 order, each carrying: its FRs, files, OQ resolutions due (OQ1/OQ2/OQ5 → C1; OQ6 → C2; OQ3/OQ4 → C3), expected baseline shifts from the table above, the quickstart targets it must pass, and Giorgi's gate/commit/verify checkpoints (CC applies only after diff approval; Giorgi runs gates and git).

## Progress Tracking

- [x] Phase 0: research.md (F2-sourced, OQ1–OQ6 open, none guessed)
- [x] Phase 1: data-model.md, contracts/ (4), quickstart.md
- [x] Constitution check: run honestly — 1 intentional violation (additive-first, ruled), 1 strain (module boundary, pre-existing) — both in Complexity Tracking
- [x] Phase 2: tasks.md (2026-09-01; one group per commit, T000 ribbon capture blocks C1)
- No ERROR states; no NEEDS CLARIFICATION markers (all unknowns are enumerated OQs with owners and timing)
