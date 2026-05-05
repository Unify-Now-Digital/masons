# Implementation Plan: Inquiries Pipeline Board

**Branch**: `007-inquiries-pipeline` | **Date**: 2026-05-06 | **Spec**: `specs/007-inquiries-pipeline/spec.md`  
**Input**: Feature specification from `specs/007-inquiries-pipeline/spec.md`

## Summary

Build a read-mostly Inquiries Pipeline module that presents organization-scoped enquiry records as a three-lane Kanban board with SQL-computed stage values and a detail panel. The implementation centers on one SECURITY DEFINER RPC (`get_inquiries_pipeline`) that performs membership checks, computes stage precedence (`order_created` > `quoted` > `new`), applies channel/date filters, and returns all board/detail payload fields in one call per filter change.
Route registration for /inquiries lives in src/app/router.tsx. Sidebar entry lives in src/components/layout/Sidebar.tsx. Legacy src/pages/ is not modified.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), SQL/PLpgSQL (Supabase migration/RPC)  
**Primary Dependencies**: React 18, React Router v6, TanStack React Query, Supabase JS client, shadcn UI primitives  
**Storage**: PostgreSQL (Supabase, RLS-enabled multi-org schema)  
**Testing**: `npm run lint`, targeted frontend tests if present, SQL verification queries in Supabase SQL editor  
**Target Platform**: Web app (Vite + React)  
**Project Type**: Single frontend + Supabase backend  
**Performance Goals**: One RPC call per filter change; initial board usable within 3s for at least 200 enquiries  
**Constraints**: Read-only v1 scope, no write-path changes, no drag/drop or manual stage edits, preserve existing routing architecture  
**Scale/Scope**: One new top-level module, one RPC, one migration, sidebar navigation update, loading/empty/error states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Dual router constraint**: PASS. `src/app/` and `src/pages/` both exist; plan keeps coexistence and only adds a route integration.
- **Module boundaries**: PASS. New UI/data code is contained under `src/modules/inquiries/` with shared pieces only in `src/shared/` if needed.
- **Supabase + RLS**: PASS. Data access remains organization-scoped; RPC includes explicit membership check due to SECURITY DEFINER.
- **Secrets**: PASS. No new privileged external integrations or frontend secret usage; no edge function required.
- **Additive-first**: PASS. Additive migration with new RPC only; no destructive schema changes.

## Phase 0: Research Plan

1. Confirm stage computation approach and deterministic precedence implementation strategy in SQL.
2. Resolved during planning: status discovery showed no `paid` value in `quotes.status`; Paid stage dropped from v1 scope.
3. Confirm safe and performant quote-link heuristic (`customer_id` to `person_id`, created_at guard, most recent match).
4. Validate frontend integration patterns for module layout, query key factory, and route/sidebar insertion.

Research output is recorded in `specs/007-inquiries-pipeline/research.md`.

## Phase 1: Design Plan

1. Produce `data-model.md` with pipeline row shape, filter inputs, derived fields, and sectioned detail payload.
2. Define RPC contract in `contracts/get-inquiries-pipeline.md` including inputs, output shape, stage semantics, and error contract.
3. Produce `quickstart.md` covering implementation order and verification steps for SQL + frontend.
4. Run agent context update script to sync planning context.

## Post-Design Constitution Check

- **Dual router constraint**: PASS (route added through existing app router, legacy pages untouched).
- **Module boundaries**: PASS (feature-local organization under `src/modules/inquiries/`).
- **Supabase + RLS**: PASS (membership validation in RPC, existing RLS preserved).
- **Secrets**: PASS (no new secret-bearing code paths).
- **Additive-first**: PASS (new RPC and frontend module only).

## Project Structure

### Documentation (this feature)

```text
specs/007-inquiries-pipeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── get-inquiries-pipeline.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── router.tsx          # Inquiries route registered HERE
│   └── ...
├── pages/
│   └── NotFound.tsx
├── modules/
│   ├── inbox/
│   ├── orders/
│   └── inquiries/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── types/
│       └── index.ts
└── shared/
    └── components/ui/

supabase/
└── migrations/
    └── <timestamp>_get_inquiries_pipeline.sql
```

**Structure Decision**: Use existing feature-module + Supabase migration architecture; no new top-level apps/services.

## Complexity Tracking

No constitution violations identified; complexity exception log not required.
