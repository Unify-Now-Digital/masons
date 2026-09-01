# Phase 0 Research — Finance Consolidation

Sourced **entirely** from the F2 investigation report (`~/.claude/plans/task-f2-finance-snazzy-squid.md`, 2026-09-01). No re-investigation performed. Citations are F2 section numbers. Anything F2 does not answer is an Open Question below — to be resolved by grep at implementation time, not guessed here.

## Decisions (with F2 evidence)

| # | Decision | Rationale | Source |
|---|---|---|---|
| R1 | One fetch from `invoices_with_breakdown` (org, `deleted_at IS NULL`, `is_test` per toggle) feeds tiles + table | Today three list queries hit the same view with divergent filters; only the table filters `is_test` — tiles and table can disagree | F2 §1 |
| R2 | Unified hook reuses/extends the existing `useInvoices` query-key family rather than adding a parallel key | Existing mutation invalidation sites keep working unchanged (CLAUDE.md person-keyed-probe rule untouched); no dual-cache drift | F2 §1 + CLAUDE.md frontend rules |
| R3 | Remaining unifies on `invoiceRemainingPence` with `status='paid'` ⇒ 0 folded in; `computeTotals` + inline re-derivation retired; `isVoidedStripeInvoice` single-homed in `invoiceRemaining.ts` | Documented divergence: paid rows with null Stripe amounts → `computeTotals` says 0, `invoiceRemainingPence` says full amount. Ruled: paid ⇒ 0 wins (spec FR-017) | F2 §1 |
| R4 | Tiles stay client-side over the unified row set; `buildFinanceHubSummary` logic survives as the aggregate engine, re-fed | No RPC exists anywhere; all tile math is already client-side | F2 §2 |
| R5 | "All" = no filter (paid included, void dimmed); the four tiles keep hub-eligibility (`isHubEligibleInvoice`: pending, not void, ≥£5, owed) and `getOverdueAgingBucket` partitions | Status tabs (five, incl. Paid) are removed; without this reading, Paid/void rows become unreachable | F2 §2, premise corrections |
| R6 | Due-horizon UI deleted; its five dependents re-derived: Not-yet-due tile (`horizon.due30+dueLater`), Overdue ribbon secondary count, `overdueAging` partitions, `allHorizonZero` empty-state, tile-activation successor to `handleHorizonNavigate` | Deleting the section is not deleting the computation | F2 §2 |
| R7 | Enquiry predicate = `invoice_number LIKE 'INV-WEB-%'` string prefix; no column exists (`invoice_type` = {NULL,'full'}, `billing_party` all NULL) | Only discriminator; portal-owned. Live: SM 5 (4 non-deleted, all void), Churchill 0. Backlog: real column (portal team) | F2 §3 |
| R8 | Void handling all client-side; badge bug = badge uses `derivedStatus` while transform rewrites display status to `'void'` | Fix at `invoiceColumnDefinitions.tsx:386-399` to respect display status | F2 §4 |
| R9 | `fetchFinanceTotals` raw-`invoices` leg gains `deleted_at IS NULL` (35/49 live-org rows are soft-deleted); lint errors `finance.api.ts:95-96` removed | Hygiene; the affected values are unrendered today, so zero visible change expected | F2 §4, §12 |
| R10 | Column picker: keep shared `tableViewPresets` with module id `'invoices'` (already mounted) + localStorage `'invoices_column_state'`; DB `table_view_presets` layer stays dead | DB layer is org-shared (violates per-user), dead at both call sites (arity bug), and reviving drags in 3 baseline tsc items | F2 §5 |
| R11 | `defaultColumns.ts` sync: drop phantom `'actions'`; the real Actions column is bolted on outside the system — leave that as-is | Known drift documented; only the invoices side is in scope | F2 §5 |
| R12 | Sort: implement client sorting, default due-date asc; `sortable` flags today are decorative; fetch order is `created_at desc` | New machinery, not a default swap. Hub's triple-sort (SQL → `compareAttentionList` → component overwrite) is replaced wholesale | F2 §6 premise, §9 |
| R13 | Search: extend client predicate to amount (today customer + number only, `InvoiceWorkspace.tsx:433-435`); stays client-side, no URL sync/debounce added | Carry-over + one addition | F2 §8 |
| R14 | State survival needs no forceMount: single mounted table + prop-driven filtering; never key-remount. Must-survive: `expandedInvoices`, `?invoice=` sidebar + `focusCollectPayment` (keep URL-driven), columnState (localStorage), search text, active tile | The tab split's unmount problem evaporates in a merged view | F2 §10 |
| R15 | Hub features with no home, resolved: Days-overdue line → new hideable column; PARTIAL pill → **lost, ruled 2026-09-01** (Status "Partially paid" covers); priority ordering → replaced by due-date asc; flag-gated tabs → deleted; loading/error/empty states → rebuilt for the unified fetch | Each F2 §7 item has an explicit fate; nothing silently disappears | F2 §7 |
| R16 | Verification = staging browser + gates; no DOM test env exists; the two pure-util test files must stay green | Component tests impossible without new infra | F2 §11 |
| R17 | tsc baseline: 10 certain items in touched files (+3 conditional in the preset layer, expected untouched — `defaultColumns.ts` holds none); re-anchor per line-shift protocol in the same commit | Item-diff, never counts | F2 §12 |
| R18 | External callers: nothing to build — redirect ships; 4 navigate() callers + Priority routes are verification-only | | F2 §6 |

## Open Questions (F2 does not answer; resolve by grep at implementation time)

| # | Question | Needed by | Resolution method |
|---|---|---|---|
| OQ1 | Exact call sites of `invoiceAmounts.computeTotals` in `CreateInvoiceDrawer.tsx` / `EditInvoiceDrawer.tsx` / `OrderFormInline.tsx` (F2 §12 lists the files as certain-touched but not the consumer lines) | C1 | `grep -n computeTotals` before edit; predicted-match-count stated then |
| OQ2 | Full field list of `INVOICES_LIST_SELECT` (`invoicing.api.ts:34`) — F2 confirms money fields + notes `intended_deposit_pence` absent, but doesn't enumerate the rest | C1 (data-model completeness) | Read the constant at C1 |
| OQ3 | Exact shape of the persisted `'invoices_column_state'` record (`columnState.ts` schema) — §5 describes behaviour, not the serialized shape | C3 | Read `columnState.ts` at C3 |
| OQ4 | Whether `isReliableDueDate` (unused import, `FinancePage.tsx:45`) is the same predicate the Hub row text uses at `:534-545`, hence reusable for the Days-overdue cell | C3 | Read those lines at C3 |
| OQ5 | Every invalidation site of the `useInvoices` query key (to confirm R2's "reuse the key" keeps all mutations correct) | C1 | `grep -n` the key literal; count stated before edit |
| OQ6 | Whether `FinancePage` imports `InvoiceWorkspace` via `@/modules/invoicing` public surface or a deep import (constitution module-boundary note) | C2 | Read the import line at C2 |

## Alternatives rejected

- **Server-side bucketing (RPC/view change)** — no RPC exists today, AC-F4 forbids schema change, row counts are tiny (SM 25, Churchill 24 total; F2 §3). Client-side is proportionate.
- **Reviving `table_view_presets` for persistence** — rejected per R10.
- **Keeping `useFinanceInvoices` for tile counts** — it exists only for the deleted tab label (F2 §7); retired.
- **forceMount tab machinery for state survival** — premise was false and the merged view makes it moot (F2 §10).
