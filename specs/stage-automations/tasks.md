# Tasks: Stage Automations — order-created → quoted, invoice-created → invoiced

**Input**: Design documents from `specs/stage-automations/` (plan.md, spec.md, research.md, data-model.md, contracts/autoAdvanceJobStage.md, quickstart.md)

**Ground rules for every task** (from /tasks seed + plan):
- **One concern per commit; Giorgi commits.** Claude Code never runs `git add`/`commit`/stage anything.
- **Per-edit approval**: each file edit is shown as a diff and approved before the next.
- **tsc gate after every unit**: `npx tsc --noEmit -p tsconfig.app.json` → exactly 55 pre-existing errors, zero new. (`npm run build` proves nothing about types.)
- **Both orgs are LIVE — there is no test org.** All runtime testing on Sears Melvin via the disposable-job pattern (quickstart §1); **no Stripe objects ever** (Mason-only invoices); cleanup SQL requires Giorgi's explicit per-change approval.
- **Do not modify** `moveJobStage`, the boards, `fetchActiveJobs`, or anything in `src/modules/jobsPipeline/api/jobsPipeline.api.ts`.

**Unit → commit mapping** (seed sequencing): Unit 1 = T101–T103 (one commit), Unit 2 = T201–T204 (one commit), Unit 3 = T301–T306 (testing + cleanup, no product-code commit; T301's temp-code removal folds into whichever commit is open if not already clean).

**Parallelism**: none. Two of the three call-site edits share `useOrders.ts`, every edit needs individual approval, and testing is a strictly ordered single-fixture sequence on live data — no `[P]` tasks in this feature.

---

## Phase 1: Setup

- [x] **T001** Verify clean start: `git status` (working tree clean, branch `feature/stage-automations`), then run `npx tsc --noEmit -p tsconfig.app.json` and confirm the 55-error baseline **before any edit** — a drifted baseline stops the feature until re-baselined with Giorgi.

---

## Phase 2: Unit 1 — Foundational: core function + public surface (BLOCKS everything) 🎯

**Goal**: `autoAdvanceJobStage` exists, typed so only `'quoted' | 'invoiced'` are representable, exported through the module surface. No caller wired yet.

- [x] **T101** Create `src/modules/jobsPipeline/api/autoAdvanceStage.api.ts` — exactly the plan D1 implementation:
  - `export type AutoAdvanceTargetStage = 'quoted' | 'invoiced';`
  - `export async function autoAdvanceJobStage(args: { organizationId: string; jobId: string; targetStage: AutoAdvanceTargetStage }): Promise<boolean>` issuing the single atomic guarded UPDATE:
    `.from('jobs').update({ stage: targetStage }).eq('id', jobId).eq('organization_id', organizationId).is('exit_reason', null).in('stage', earlierStages as unknown as string[]).select('id')`
    with `earlierStages = BEFORE_PAID_STAGES.slice(0, BEFORE_PAID_STAGES.indexOf(targetStage))`; throw on `error`; return `(data ?? []).length > 0`.
  - Imports: `supabase` from `@/shared/lib/supabase`, `BEFORE_PAID_STAGES` from `../types/jobsPipeline.types`. Doc comment: NOT moveJobStage — no adjacency, jumps expected, D4 gate satisfied by construction (contract file is normative).
- [x] **T102** Edit `src/modules/jobsPipeline/index.ts` — append the three public exports (plan D2): `autoAdvanceJobStage`, `type AutoAdvanceTargetStage` (both from `./api/autoAdvanceStage.api`), and `jobsPipelineKeys` from `./api/jobsPipelineKeys`. Nothing else changes.
- [x] **T103** Unit-1 tsc gate: `npx tsc --noEmit -p tsconfig.app.json` → 55/zero-new. → **Giorgi commit #1** (core function + exports).

**Checkpoint**: module compiles with the automation available but inert (zero callers).

---

## Phase 3: Unit 2 — the three call sites

**Goal**: all three creation mutations fire the automation from their onSuccess, with FR-010 containment. Shared call-site pattern (plan D3): inside the `job_id` branch, `void autoAdvanceJobStage({ organizationId, jobId, targetStage }).then(advanced => { if (advanced) invalidate jobsPipelineKeys.active(organizationId) + jobsPipelineKeys.afterPaid(organizationId); }).catch(err => console.warn('[jobsPipeline] auto-advance failed (creation succeeded)', err));` — never `await`ed, never rethrown, **no toast**.

- [x] **T201** [US2] Edit `src/modules/orders/hooks/useOrders.ts` — `useCreateOrder`'s onSuccess: inside the existing `if (data.job_id)` branch (line ~211, after the `ordersKeys.byJob` invalidation), add the D3 pattern with `targetStage: 'quoted'`. Add module import `import { autoAdvanceJobStage, jobsPipelineKeys } from '@/modules/jobsPipeline';` (public surface only — no deep import).
- [x] **T202** [US3] Same file — `useCreateOrderFromQuote`'s onSuccess (line ~231) currently has **no** `job_id` branch: add `if (data.job_id) { … }` containing (a) `queryClient.invalidateQueries({ queryKey: ordersKeys.byJob(data.job_id, organizationId) })` for parity with `useCreateOrder`, and (b) the D3 pattern with `targetStage: 'quoted'`. No-`job_id` conversions never enter the branch (FR-011).
- [x] **T203** [US1] Edit `src/modules/invoicing/hooks/useInvoices.ts` — `useCreateInvoice`: change `onSuccess: ()` to `onSuccess: (data)` (api returns the full `Invoice` row; type carries `job_id`). After the existing invalidations, add `if (data.job_id) { … }` containing (a) `queryClient.invalidateQueries({ queryKey: jobsPipelineKeys.invoiceSummaries(organizationId) })` unconditionally within the branch (card totals + D4-gate summary move even on stage no-op), and (b) the D3 pattern with `targetStage: 'invoiced'`. Import `autoAdvanceJobStage, jobsPipelineKeys` from `@/modules/jobsPipeline`.
- [x] **T204** Unit-2 tsc gate: 55/zero-new; `npm run lint` on the two touched files. → **Giorgi commit #2** (three call sites).

**Checkpoint**: US1/US2/US3 code-complete; US4 (multi-fire) is emergent — both call sites exist, forward-only UPDATE guarantees convergence (data-model.md concurrency table).

---

## Phase 4: Unit 3 — hand-test matrix on SM (disposable-job pattern)

**Goal**: every acceptance scenario exercised against live SM with one tracked, disposable fixture; everything created gets deleted; zero Stripe objects.

- [x] **T301** Temp exposure for console testing: add the quickstart §2 dev-only block to `src/main.tsx` (`if (import.meta.env.DEV)` → `window.autoAdvanceJobStage`). Marked TEMPORARY; **must be removed in T305 — it never ships and is never committed**.
- [x] **T302** Fixture (quickstart §1): in SM via UI **Add to pipeline**, create the disposable job ("ZZ Stage-Automation Test"); start a scratch tracking note (`specs/stage-automations/.test-run-ids.md` or scratchpad) recording `job.id` + person/conversation ids **iff freshly created**. Every subsequent created row's id goes in this note.
- [x] **T303** Core matrix (quickstart §2, rows 1–11) — rows 1–10 passed live 2026-08-07; row 11 verified via `@ts-expect-error` scratch file (tsc stayed at 55 = the bad target genuinely fails to compile): sequenced single-job run — forward advances, idempotent/backward/at-target no-ops, drag-resets (manual-move regression), exit→no-op→reopen, Churchill-org-UUID guard (returns `false`, writes nothing), random-UUID, and the editor-level `'confirmed'` compile error. Post-paid guard is verified structurally (earlierStages can never contain a post-paid stage) — **do not** run against any real post-paid SM job.
- [x] **T304** E2E matrix (quickstart §3) — passed 2026-08-07 with three noted deviations: repeat-invoice-on-invoiced and invoice-on-exited are UI-prevented paths (guards verified at the function level in T303 rows 4/7 instead); quote-conversion row skipped (no quote fixture; T202 is pattern-identical to live-verified T201, tsc-vouched): linked order → Quoted; repeat-order no-op; **Mason-only** invoice → Invoiced (verify no Stripe fields on the row — if the drawer path would force a Stripe object, STOP and flag Giorgi); repeat-invoice no-op; jump `enquired→invoiced`; US4 combined drawer submit → net Invoiced; invoice-on-exited no-op; no-`job_id` order silence; quote-conversion row if practical (else note skip); FR-010 offline check (creation survives, `console.warn` only, no toast).
- [x] **T305** Remove the T301 temp block from `src/main.tsx`; confirm `git diff` on main.tsx is empty; final tsc gate 55/zero-new.
- [x] **T306** Cleanup — done 2026-08-07 with RETURNING-id evidence (4 order_people, 5 orders, 3 invoices, 1 job; read-backs zero). Two Phase-A deviations: (1) every drawer invoice creates a live Stripe invoice — no Mason-only path exists; 3 Stripe invoices voided by Giorgi in the Stripe dashboard; (2) one untracked invoice from the no-job order flow caught by the A3 reference check and added to the manifest. Original task text: (quickstart §4): from the tracking note, draft the exact reference-check SELECTs + org-guarded DELETEs (explicit ids only, children first: options → orders → invoices → job → freshly-created person/conversation only) → **show to Giorgi, wait for explicit approval** → run → read-back SELECTs all zero rows → paste outputs into the tracking note as evidence, then dispose of the note.

**Checkpoint**: all spec acceptance scenarios pass on live SM; SM contains zero test residue; Stripe untouched.

---

## Phase 5: Polish & merge readiness

- [x] **T401** Full-suite gates — tsc 55/zero-new; all four feature files eslint-clean (full-repo lint's 10 errors/16 warnings are pre-existing, none in touched files). Original task text: Full-suite gates: `npx tsc --noEmit -p tsconfig.app.json` (55/zero-new) + `npm run lint`; walk quickstart §6 exit checklist end-to-end.
- [ ] **T402** Demo prep (quickstart §5): stage a fresh SM job in Enquired for the Friday call with Arin (this one is the demo prop — created just before the call, cleaned up after the same way as T306, or kept if Arin wants it).
- [ ] **T403** Update docs: mark plan.md Progress Tracking Phase 2 complete; note the DB-trigger hardening follow-up (non-UI insert paths) wherever follow-ups are tracked. Giorgi commits any doc changes; **staging merge only after T401 is fully green** (Giorgi's call).

---

## Dependencies & execution order

```text
T001 → T101 → T102 → T103 ──→ T201 → T202 → T203 → T204 ──→ T301 → T302 → T303 → T304 → T305 → T306 ──→ T401 → T402 → T403
        (Unit 1, commit #1)          (Unit 2, commit #2)              (Unit 3, live testing + cleanup)        (polish/merge)
```

- Strictly linear — no parallel tasks (shared files, per-edit approval, single live fixture).
- T303 (core matrix) intentionally runs **after** Unit 2 is wired only in this ordering because the temp exposure (T301) needs a dev server anyway; if Giorgi prefers the plan's stricter "core hand-test before any hook" sequencing, run T301–T303 between T103 and T201 — both orderings are valid, T303 tests the function directly either way. Ask at the T103 checkpoint.
- **Stop conditions**: baseline ≠ 55 (T001/any gate) · drawer forces Stripe objects (T304) · any untracked reference at cleanup (T306) · any request to write SM data outside the tracked fixture → stop and ask Giorgi.

## Requirement traceability

| Requirement | Implemented | Verified |
|---|---|---|
| FR-001 (order → quoted) | T201, T202 | T304 #1–2, #11 |
| FR-002 (invoice → invoiced) | T203 | T304 #3–6 |
| FR-003/FR-004 (module ownership, unrepresentable targets) | T101, T102 | T103, T303 #11 |
| FR-005–FR-008 (org-scope, exited, post-paid, forward-only) | T101 predicates | T303 #1–10 + structural note |
| FR-009 (guarded UPDATE + invalidations) | T101 + T201–T203 | T304 board-refresh observations |
| FR-010 (failure isolation) | D3 pattern in T201–T203 | T304 #12 |
| FR-011 (job_id-gated firing) | T201–T203 branches | T304 #10 |
| FR-012 (manual moves untouched) | no edits to moveJobStage/boards | T303 #6, drag-resets |
| SC-006 (tsc 55/zero-new) | — | T001, T103, T204, T305, T401 |
```
