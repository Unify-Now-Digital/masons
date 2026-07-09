# Implementation Plan: Inbox IA Unification

**Branch**: `feature/inbox-ia-unification` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/feature/inbox-ia-unification/spec.md` (also mirrored at `specs/inbox-ia-unification.md`)

## Summary

Collapse the inbox left panel's asymmetric segment/view hierarchy (`segment` URL param + `viewMode` localStorage state, board-vs-list layout fork) into a single URL-derived `view` param (`all | triage | customers`) plus an orthogonal `?board=1` toggle (default off). "To triage" is a filtered list view driven by the existing `inboxBuckets` ball-in-court/aging engine — never `enquiry_stage`. Legacy `?segment=enquiries` links and the `inbox.desktop.viewMode.v1` preference are normalized/migrated so nothing breaks. Frontend-only: no schema change, no db push, no edge-function change.

All current-state claims in this plan were **re-verified on disk this session**; the full inventory of `viewMode`/`segment`-keyed logic (V1–V14, S1–S6) is in [research.md](./research.md) §R2–R3, and the decisions (D1–D8) in §R4.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (Vite + SWC)
**Primary Dependencies**: React Router DOM v6 (`useSearchParams`), TanStack React Query (existing inbox hooks), shadcn/Tailwind UI
**Storage**: N/A (no schema change; localStorage keys `inbox.desktop.view.v2` new, `inbox.desktop.viewMode.v1` read-once legacy)
**Testing**: `npx tsc --noEmit` + `npm run lint` gates; manual matrix in [quickstart.md](./quickstart.md) against Sears Melvin (only org with volume; Churchill is live prod with 1 conversation — read-only smoke at most)
**Target Platform**: Web (desktop-first; mobile layout must not regress)
**Project Type**: Frontend feature refactor inside `src/modules/inbox/`
**Performance Goals**: No new queries; triage predicate is an in-memory filter over the already-built `bucketAndAgingByConversationId` map
**Constraints**: No schema change / no `db push`; no writes to Churchill or Sears Melvin data; do not regress shipped row/rail work; `EnquiryTriageRedirect` in `src/app/router.tsx` must keep working untouched
**Scale/Scope**: One 1,458-line page (`UnifiedInboxPage.tsx`), one new hook, minor edits to list components; ~20 gate sites remapped

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design — still passing.*

- **Dual router constraint**: PASS — no routes added/moved/renamed; `src/app/router.tsx` untouched (legacy `?segment=` handled by in-page param alias, research D5).
- **Module boundaries**: PASS — all changes inside `src/modules/inbox/` (new `hooks/useInboxView.ts`, edits to `pages/UnifiedInboxPage.tsx`, view-switch UI in the page or `components/`); no cross-feature imports.
- **Supabase + RLS**: PASS — no new data access; existing RLS-scoped hooks only. No policy/table changes.
- **Secrets**: PASS — no edge functions, no secrets.
- **Additive-first**: PASS — legacy URL param aliased (not broken), legacy localStorage key migrated and left in place for rollback (research D4). One deliberate gate widening (create-order panel in triage view, research D7) is called out as a capability-preservation measure, not a removal.

## Project Structure

### Documentation (this feature)

```text
specs/feature/inbox-ia-unification/
├── plan.md              # This file
├── spec.md              # Feature spec (canonical copy; original at specs/inbox-ia-unification.md)
├── research.md          # Phase 0 — verified state/effect inventory + decisions D1–D8
├── data-model.md        # Phase 1 — view-state model, gate bijection, no DB change
├── quickstart.md        # Phase 1 — validation matrix (Sears Melvin)
├── contracts/
│   └── view-state-contract.md  # URL/localStorage compat contract + invariants
└── tasks.md             # Phase 2 (/tasks command — NOT created by /plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── router.tsx                          # UNTOUCHED (EnquiryTriageRedirect keeps working via param alias)
└── modules/inbox/
    ├── hooks/
    │   └── useInboxView.ts                 # NEW — view/board derivation, legacy normalization, v1→v2 migration
    ├── pages/
    │   └── UnifiedInboxPage.tsx            # MODIFIED — gate remap (V1–V14, S1–S6), view-switch UI, triage filter
    ├── components/
    │   ├── InboxConversationList.tsx       # MINOR — reused for all/triage views (stuck pill unchanged)
    │   ├── CustomerThreadList.tsx          # UNCHANGED (existing 'stuck'→'all' coercion kept)
    │   └── EnquiryPipelineBoard.tsx        # UNCHANGED — mounted behind board toggle
    └── utils/inboxBuckets.ts               # UNCHANGED — triage predicate consumes existing AgingInfo
```

**Structure Decision**: Single-project frontend refactor, all inside the owning module per constitution; the only file outside `modules/inbox` that references the legacy param (`router.tsx`) is deliberately left alone.

## Phase 0: Research (complete → [research.md](./research.md))

Re-verified `UnifiedInboxPage.tsx` on disk; corrected/extended the spec's pointers:
- Effects the spec cited at "~204–213, ~573–644" are actually V2/V3 (`:209-219`) and V5–V7 (`:578-650`); full inventory is 14 `viewMode` sites + 6 `segment` sites.
- **Discovery**: `ListFilter` already includes `'stuck'` with a red-only `isStuck` signal and a "N stuck" pill — the triage predicate (D2) is a superset; existing pill is kept as a subset filter.
- **Discovery**: second legacy entry point `/dashboard/enquiry-triage` (router redirect) forwards `?conversation=` — compat matrix covers it.
- Decisions D1–D8 resolve: param scheme, triage predicate, default view (`customers`), v1→v2 storage migration, URL normalization matrix, gate bijection, create-order-panel widening, pill composition.

## Phase 1: Design (complete → [data-model.md](./data-model.md), [contracts/](./contracts/view-state-contract.md), [quickstart.md](./quickstart.md))

Core design: a `useInboxView` hook owns derivation + normalization + persistence; the page consumes `{ view, board }` and every legacy gate is remapped by the fixed bijection:

| Old gate | New gate |
|---|---|
| `viewMode === 'conversations'` | `view !== 'customers'` |
| `viewMode === 'customers'` | `view === 'customers'` |
| `segment === 'enquiries'` | `board` |
| *(exception D7)* `segment === 'enquiries'` on `EnquiryCreateOrderPanel` | `board \|\| view === 'triage'` |

Triage filtering slots into the existing `displayConversations` memo chain after pills/channel (intersection semantics, FR-005).

## Phase 2: Implementation approach (described for /tasks; tasks.md is generated by the /tasks command)

Ordered to keep each step shippable and `tsc`-clean:

1. **Hook first, no behavior change**: add `useInboxView.ts` (view/board derivation, D5 normalization, D4 storage migration) with the page still rendering from old vars; wire `view`/`board` in parallel and assert equivalence in dev.
2. **Mechanical gate remap**: replace `viewMode`/`segment` reads at V1–V14/S1–S6 per the bijection; delete `viewMode` state + `segment` derivation/setter; keep `listFilter` untouched. This is the orphan-risk step — the research inventory is the checklist, each site ticked individually.
3. **View-switch UI**: replace the segment tablist (`:1155-1184`) and Conversations/Customers tabs (`:1209-1243`) with one three-tab switch + board toggle button; preserve `role="tablist"`/`aria-selected` semantics and collapse buttons.
4. **Triage view**: apply D2 predicate when `view === 'triage'`; empty state for zero matches; stuck pill continues to work inside it.
5. **Create-order panel widening** (D7): S6 gate → `board || view === 'triage'`.
6. **Verification**: `npx tsc --noEmit`, `npm run lint`, full quickstart matrix on Sears Melvin, Churchill read-only smoke.

Rollback: single revert of the page/hook commits restores `segment`/`viewMode`; v1 localStorage key was never deleted (D4), so old code resumes cleanly.

## Complexity Tracking

No constitution violations to justify. The one deliberate behavior widening (D7, create-order panel in triage view) is a capability-preservation measure required by the spec's "no workflow capability is lost" and is flagged for review rather than silently included.

## Progress Tracking

- [x] Initial Constitution Check — PASS
- [x] Phase 0: research.md generated (on-disk re-verification + D1–D8)
- [x] Phase 1: data-model.md, contracts/view-state-contract.md, quickstart.md generated
- [x] Post-design Constitution Check — PASS (no new violations)
- [x] Phase 2 approach described (tasks.md deferred to /tasks command per template)
- [ ] tasks.md (/tasks)
- [ ] Implementation (/implement)
