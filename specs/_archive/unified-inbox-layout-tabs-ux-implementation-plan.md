# Unified Inbox — Layout & Tabs UX Update: Implementation Plan

**Branch:** feature/unified-inbox-layout-tabs-ux  
**Spec:** [specs/unified-inbox-layout-tabs-ux.md](unified-inbox-layout-tabs-ux.md)

## Summary
UI-only update: remove Unread tab, fixed 3-column layout (180px / 260px / 1fr), denser conversation cards, message bubbles capped at 75%. No data or API changes.

## Plan artifacts (absolute paths)
| Artifact | Path |
|----------|------|
| Research | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-layout-tabs-ux-plan\research.md` |
| Data model | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-layout-tabs-ux-plan\data-model.md` |
| Quickstart | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-layout-tabs-ux-plan\quickstart.md` |
| Tasks | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-layout-tabs-ux-plan\tasks.md` |

## Execution order
1. Phase 2: Remove Unread tab + filter logic
2. Phase 3: Layout grid + column scroll
3. Phase 4: Conversation card density
4. Phase 5: Bubble width cap
5. Phase 6: QA checklist
6. Phase 7: Commits as in tasks.md

## Guardrails
- No inbox data/query/DB changes.
- Preserve message-container-only scroll (no page jump).
- Keep unread badges and "Mark as Read" behavior.
