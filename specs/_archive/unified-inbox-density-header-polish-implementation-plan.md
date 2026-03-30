# Unified Inbox — Density & Header Polish: Implementation Plan

**Branch:** feature/unified-inbox-density-header-polish  
**Spec:** [specs/unified-inbox-density-header-polish.md](unified-inbox-density-header-polish.md)

## Summary
UI-only polish: (A) denser conversation list rows, (B) compact conversation header with status pill and sticky placement, (C) segmented-control style tabs. No DB/API/scroll behavior changes.

## Plan artifacts (absolute paths)
| Artifact | Path |
|----------|------|
| Research | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-density-header-polish-plan\research.md` |
| Data model | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-density-header-polish-plan\data-model.md` |
| Quickstart | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-density-header-polish-plan\quickstart.md` |
| Tasks | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-density-header-polish-plan\tasks.md` |

## Execution order
1. Phase 2: Tabs polish (segmented control)
2. Phase 3: Conversation list density
3. Phase 4: Conversation header redesign (sticky + status pill)
4. Phase 5: QA checklist
5. Phase 6: 3 commits as in tasks.md

## Guardrails
- No DB/API/query/logic changes.
- Preserve unread badges and Mark as Read; preserve message-list-only scroll.
