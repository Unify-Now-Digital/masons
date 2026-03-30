# Implementation Plan: Improve Mason App Desktop Layout Responsiveness and UI/UX

**Feature spec:** [improve-mason-app-desktop-layout-ux.md](../improve-mason-app-desktop-layout-ux.md)  
**Branch:** `feature/improve-mason-app-desktop-layout-ux`

**Note:** `.specify/scripts/bash/setup-plan.sh` was not present; paths were set from user input: FEATURE_SPEC = spec above, SPECS_DIR = this folder, IMPL_PLAN = this file.

## Technical Context (from $ARGUMENTS)

- **Goal:** Implement a desktop-first layout and UI/UX improvement pass so:
  - main content expands correctly when the left sidebar collapses
  - table pages remain readable across desktop/laptop widths
  - right detail sidebars stay consistent
  - the app feels cleaner and more polished overall
- **Strategy:** Work phase by phase, starting with the global shell/foundation before page-specific polish.
- **Phases:** 0 (Research/audit), 1 (Global dashboard shell), 2 (Shared page structure), 3 (Table responsiveness), 4 (Right detail sidebars), 5 (UI/UX polish).
- **Deliverables:** implementation plan, tasks.md, identified files per phase, specific changes per module, QA checklist.

## Progress Tracking

| Phase   | Status    | Artifact(s)                          |
|---------|-----------|--------------------------------------|
| Phase 0 | COMPLETE  | research.md                          |
| Phase 1 | COMPLETE  | data-model.md, contracts/, quickstart.md |
| Phase 2 | COMPLETE  | tasks.md                             |
| Verify  | COMPLETE  | All artifacts generated, no ERROR states |

## Execution Summary

- **Phase 0:** Audit of dashboard shell (ReviewNavToolbar + App.tsx content wrapper), layout primitives, and table/sidebar pages documented in research.md. Root cause: content uses fixed `md:pl-[140px]` that does not respond to sidebar collapse (sidebar is 140px expanded, 40px collapsed).
- **Phase 1:** Layout structure model (data-model.md), component/layout contracts (contracts/), and quickstart for local run and QA (quickstart.md).
- **Phase 2:** Task list (tasks.md) for Phases 1–5 implementation plus QA checklist for sidebar expansion, table readability, right sidebar consistency, and no workflow regressions.
