# Implementation Plan: Inbox Sidebar Multi-Tabs (PersonOrdersPanel)

**Branch**: `feature/inbox-sidebar-multi-tabs` | **Date**: 2026-08-25 | **Spec**: `specs/inbox-sidebar-multi-tabs/spec.md`
**Input**: Feature specification + plan-time directives from Giorgi (2026-08-25): assumptions
a–d approved; lint baseline corrected to 10 errors / **19** warnings; tabs primitive check;
JSX-relocation-only rule for the Orders move; one-concern-per-commit plan with per-commit gate
predictions; both returns accounted for explicitly.

## Summary

Convert the inbox right-column sidebar (`PersonOrdersPanel`) into a four-tab panel — Orders
(default, existing content moved verbatim), Contact, Finances, History — using the existing
shadcn/Radix Tabs primitive with `forceMount` + class-based hiding so every panel stays
mounted (AC-002). Zero data-layer changes: all three new tabs re-present data the panel's
existing hooks already hold. The job-probe block (`:47-105`) is untouched (C1), the early
return (`:227-237`) renders no tabs (C3), drawers stay at panel root (C5), and the tab strip
sits below the existing header, clear of the page-level collapse overlay (C6).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite (SWC)
**Primary Dependencies**: existing only — `@radix-ui/react-tabs` via
`src/shared/components/ui/tabs.tsx` (**already present — no new primitive file, no new
dependency; directive 2's "add the file" branch is moot**), shadcn `Badge`/`Skeleton`,
lucide-react icons, Tailwind gardens-* tokens
**Storage**: N/A — no new queries, hooks, or query keys (AC-008); consumes existing
React-Query caches (`useCustomer`, `useOrdersByPersonId`, `useOrdersByJobId`,
`useJobsByPersonId`/`useConversationsJobs`)
**Testing**: manual quickstart script (`quickstart.md`) + gate commands; no test infra exists
for this surface
**Target Platform**: desktop web only (right column is `hidden lg:flex` at page level)
**Project Type**: web frontend, single feature-module change (`src/modules/inbox`)
**Performance Goals**: no additional network requests ever; tab switch is pure
CSS-visibility toggling (SC-002)
**Constraints (immovable)**: C1–C6 from the spec, restated as AC-001…AC-006; directive 3:
the Orders move is JSX relocation inside `PersonOrdersPanel`'s existing returns — **no
extraction that moves hooks, state, refs, or drawers**; new components only for new content,
props-only, no data hooks inside them
**Scale/Scope**: 1 file modified (`PersonOrdersPanel.tsx`), 3 files added (tab bodies),
4 commits

## Constitution Check

- **Dual router constraint**: PASS — no routing/navigation changes; no `src/app/` or
  `src/pages/` edits.
- **Module boundaries**: PASS — all changes inside `src/modules/inbox/components/`; imports
  only from `@/shared/*`, the `@/modules/jobsPipeline` barrel (`formatStageLabel`,
  `type JobStage` — both already exported), and the same `orders`/`customers` paths the panel
  already imports from. `ConversationJobSummary` is not barrel-exported and is NOT deep-
  imported — the History tab declares a structural subset (existing `PickerJob` precedent).
  No new barrel exports.
- **Supabase + RLS**: PASS (vacuous) — zero data-access changes; RLS posture untouched.
- **Secrets**: PASS (vacuous) — no edge functions, no keys.
- **Additive-first**: PASS — purely additive UI; the only "move" is JSX relocation within one
  component's return. Rollback = revert the commit(s); each commit leaves the panel fully
  functional.

Re-checked after Phase 1 design: still PASS on all five. **Complexity Tracking: empty — no
violations to justify.**

## Project Structure

### Documentation (this feature)

```text
specs/inbox-sidebar-multi-tabs/
├── spec.md                                  # feature spec (moved from the flat path the /specify script created)
├── plan.md                                  # this file
├── research.md                              # Phase 0 — decisions R1–R10
├── data-model.md                            # Phase 1 — entities + new client state
├── quickstart.md                            # Phase 1 — manual verification script
├── contracts/
│   └── components.md                        # Phase 1 — component APIs + render structure
└── tasks.md                                 # Phase 2 — /tasks command output (not this plan)
```

### Source Code (repository root)

```text
src/modules/inbox/components/
├── PersonOrdersPanel.tsx        # MODIFIED — tab shell + Orders JSX relocation (only file touched in commit 1)
├── InboxContactTab.tsx          # NEW — commit 2 (presentational, props-only)
├── InboxFinancesTab.tsx         # NEW — commit 3 (presentational, props-only)
└── InboxHistoryTab.tsx          # NEW — commit 4 (presentational, props-only)

src/shared/components/ui/tabs.tsx  # EXISTS — used as-is, className overrides at call site, file NOT edited
```

**Structure Decision**: feature-scoped components stay in `src/modules/inbox/components/`
beside the panel; nothing is promoted to `src/shared/` (single consumer). No other directory
is touched.

## Render Structure (directive 5 — both returns)

Authoritative diagram in `contracts/components.md`; the two-return contract:

1. **Early return `:227-237`** — byte-identical. Renders when `!personId && !effectiveJob`.
   No tab strip, no Tabs root, no new markup (C3). The new `activeTab` `useState` is declared
   with the existing hooks above both returns, so hook count/order is identical on both paths.
2. **Main return** — root div `:240` and header `:242-257` unchanged. The body div `:259` is
   replaced by `Tabs` (root, `flex-1 min-h-0 flex flex-col`) containing the `TabsList` strip
   and four `forceMount` `TabsContent` panels, every one carrying the current body's exact
   scroll classes plus `mt-0 data-[state=inactive]:hidden` and **no display utility**
   (research R2 — keeps both the class and Radix's `hidden` attribute effective). The Orders
   panel receives children `:260-327` **verbatim** — the skeleton/error/empty ternary,
   `summaryRef` div + `OrderContextSummary`, `jobAction`, orders list, `unassignedSection`.
   Drawers `:330-346` remain siblings of `Tabs` inside the root div (C5).

`jobAction`, `unassignedSection`, `displayOrder`, and both drawer JSX blocks are **not**
extracted into new components — directive 3. The only new components are the three new tab
bodies, which receive props and call no data hooks.

## Tab wiring (data already in scope at the call sites)

| Tab | Props passed from PersonOrdersPanel | All pre-existing values? |
|---|---|---|
| Contact | `hasLinkedPerson={effectivePersonId != null}`, `person={person}` (`:75-76`) | Yes |
| Finances | `orders={[...jobOrders, ...unassignedOrders]}`, `isLoading={isLoading}` (`:50, :53, :86`) | Yes |
| History | `jobs={jobsQuery.data}` (`:61`) | Yes |

## Commit Plan (directive 4 — one concern per commit, P1→P4)

Each commit is gate-checked before the next starts and is independently revertable (reverting
commit N restores a fully working N−1 state). Predictions per project protocol — stated
before apply, verified after.

| # | Commit (concern) | Files | tsc prediction | lint prediction |
|---|---|---|---|---|
| 1 | Tab shell in PersonOrdersPanel; Orders body moved verbatim into forceMounted Orders panel; Contact/Finances/History panels render placeholder empty-state shells inline (no new files yet) | `PersonOrdersPanel.tsx` (M) | **54** (0 new — JSX-only change, existing types) | **10 err / 19 warn** (0 new — no new files, no new exports) |
| 2 | Contact tab body | `InboxContactTab.tsx` (A), `PersonOrdersPanel.tsx` (M — replace placeholder with component) | **54** | **10 / 19** (single component export per file; props interface is type-only → `react-refresh/only-export-components` silent) |
| 3 | Finances tab body | `InboxFinancesTab.tsx` (A), `PersonOrdersPanel.tsx` (M) | **54** | **10 / 19** (same reasoning) |
| 4 | History tab body | `InboxHistoryTab.tsx` (A), `PersonOrdersPanel.tsx` (M) | **54** | **10 / 19** (`SidebarHistoryJob` is a type-only export — lint-silent) |

Gate commands per commit:
`npx tsc -p tsconfig.app.json --noEmit` (= 54) and `npm run lint` (= 10/19). If any measured
number deviates from the predicted one, stop and report before committing (diff-approval
protocol). Baselines re-measured once on the branch before commit 1; if the fresh
measurement differs from 54 or 10/19, the measured number becomes the gate and the deviation
is reported first.

Commit-1 placeholder note: the three placeholder panels in commit 1 reuse the final empty-
state markup (icon + one line) so commit 1 is shippable on its own; commits 2–4 swap each
placeholder for the real component. Deliberate, flagged here so the transient inline markup
isn't mistaken for scope creep.

## Verification mapping

| Acceptance item | Verified by |
|---|---|
| Orders tab pixel-equivalent | quickstart SC-001 step 1 (side-by-side vs `staging`) |
| No refires / no count churn / drawer survives / no selection reset | quickstart SC-002 steps 2–3 (devtools + network) |
| Contact correctness + unlinked empty state | quickstart SC-003 |
| Finances totals match summary card | quickstart SC-004 |
| History order/stage/exit correctness, no event language | quickstart SC-005 |
| C3 (no tabs in early return) | quickstart SC-001 step 4 |
| C6 (collapse-button clearance) | quickstart SC-001 step 5 |
| Gates | per-commit commands above |

## Progress Tracking

- [x] Phase 0 — research.md (decisions R1–R10; no NEEDS CLARIFICATION remaining — all spec
      assumptions approved by directive 1, lint baseline corrected to 19 warnings)
- [x] Phase 1 — data-model.md, contracts/components.md, quickstart.md
- [x] Constitution check — PASS pre- and post-design; Complexity Tracking empty
- [ ] Phase 2 — tasks.md via /tasks (not part of /plan per template)
- [ ] Implementation (4 commits) — not started
- [ ] Gates verified per commit — not started

No ERROR states. Ready for /tasks.

---

## Post-implementation correction note (2026-08-26)

The Scale/Scope line and Commit Plan table above describe the planned commits 1–4
(`f69c523`, `54e4543`, `12d81fe`, `5a0fdbc`) and were accurate for them; they are left
unedited as the record of the plan. Final shipped state differs:

- **Files modified: 2** — `PersonOrdersPanel.tsx` and `UnifiedInboxPage.tsx` (the latter the
  authorized AC-008 deviation, commit `c99fc76`). Files added: 3 (as planned).
- **Source commits: 7** — the planned 4 plus three live-request polish commits
  (`1e08522` strip labels; `c99fc76` header removal + control consolidation; `c55a055`
  contact editing via EditCustomerDrawer reuse).
- Tab-wiring table: `InboxContactTab` additionally receives `onEdit` (`c55a055`).
