# Implementation Plan: Unified Inbox Visual Redesign

## Input

- **Feature spec:** `specs/unified-inbox-visual-redesign.md`
- **Hard decisions:** Orders header `bg-slate-900 text-white`; page background `bg-muted/30`; panel surfaces `bg-background border border-border/60 rounded-xl shadow-sm`; tabs pill style `rounded-full`; active row `bg-muted/60` + left border accent `border-primary`; no logic changes.

---

## 1. Files and components

| Area | File | Component / section |
|------|------|----------------------|
| Layout + panels | `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Page layout, four-column grid, panel wrappers, tabs, conversation list |
| People | `src/modules/inbox/components/PeopleSidebar.tsx` | People column (collapsible); restyle only |
| Conversation list + tabs | `UnifiedInboxPage.tsx` | TabsList / TabsTrigger; conversation Cards (list rows) |
| Conversation view | `src/modules/inbox/components/ConversationView.tsx` | Wrapper for header + thread; container classes |
| Header + thread | `src/modules/inbox/components/ConversationHeader.tsx` | Avatar + name + subline + actions |
| | `src/modules/inbox/components/ConversationThread.tsx` | Message list (scroll), composer dock, suggestion chip |
| Orders | `src/modules/inbox/components/PersonOrdersPanel.tsx` | Dark header block, order list, detail |
| All tab | `src/modules/inbox/components/AllMessagesTimeline.tsx` | Panel surface consistency |

---

## 2. Markup-only changes per component

### UnifiedInboxPage

- Add page background: wrap main content in `bg-muted/30`.
- Apply panel surface to each of the four column wrappers: `bg-background border border-border/60 rounded-xl shadow-sm` while keeping existing `min-h-0 min-w-0 overflow-hidden` (and flex/grid) so scroll behavior is unchanged.
- **Tabs:** Style TabsList and TabsTrigger as pills: `rounded-full` and appropriate padding/gap; active state styling.
- **Conversation list:** Active row `bg-muted/60` and left border accent `border-primary`; inactive hover `hover:bg-muted/30`. Keep list container `flex-1 min-h-0 overflow-auto`.

### PeopleSidebar

- Restyle root container(s) with panel surface (or rely on parent column wrapper). Keep collapsed/expanded layout and all `overflow-y-auto` and selection logic.

### ConversationHeader

- Keep structure: avatar + displayName + secondaryLine + Badge + action Button. Adjust spacing and typography for clearer hierarchy (avatar + title + subline + actions). Keep sticky and border-b.

### ConversationThread

- **Card:** Panel surface `rounded-xl border border-border/60 shadow-sm`; keep `min-h-0` and flex structure.
- **Scroll container (must preserve):** The div with `ref={scrollContainerRef}` keeps `flex-1 min-w-0 overflow-y-auto overflow-x-hidden` and remains the only scrollable message area.
- **Composer:** Turn into a sticky dock: wrap composer block in a sticky footer (e.g. `sticky bottom-0 bg-background border-t`). Keep `ref={composerRef}` and all behavior.
- **Suggestion chip:** Move into the composer header row (same row as “Replying to” and/or channel select), so it sits in the top row of the dock instead of above the textarea. Keep loading/error and `setReplyText` on click.

### PersonOrdersPanel

- Add a dark header block at top: `bg-slate-900 text-white` with title “Orders” and count badge (e.g. “(3)”). Rest of panel unchanged. Card can use same panel surface (rounded-xl, border).

### ConversationView / AllMessagesTimeline

- ConversationView: Keep root `min-h-0 min-w-0 overflow-hidden`; add or align panel styling only if needed.
- AllMessagesTimeline: Apply same panel surface to its container so All tab matches other panels; keep internal scroll and min-h-0.

---

## 3. Scroll guard: elements that must keep min-h-0 / overflow

- **UnifiedInboxPage:** Column wrappers: `min-h-0 min-w-0 overflow-hidden`. Conversation list scroll: `flex-1 min-h-0 overflow-auto`.
- **ConversationView:** Root: `min-h-0 min-w-0 overflow-hidden`.
- **ConversationThread:** Card and CardContent: `min-h-0 overflow-hidden`. **Message list div (ref=scrollContainerRef):** `flex-1 min-w-0 overflow-y-auto overflow-x-hidden` — do not remove or change.
- **PeopleSidebar / PersonOrdersPanel / AllMessagesTimeline:** Keep existing `overflow-y-auto` and flex/min-h-0 so internal scroll continues to work.

---

## 4. QA checklist (no regressions)

- [ ] Message list scrolls; scroll position stable.
- [ ] Auto-read: opening a conversation with unread still marks as read.
- [ ] Realtime: new messages and conversation updates still appear.
- [ ] Four columns intact; responsive behavior unchanged.
- [ ] People sidebar collapse/expand and selection unchanged.
- [ ] Tabs filter conversations correctly; no wrong or duplicate data.
- [ ] Composer: reply, channel select, reply-to, suggestion chip, send all work.
- [ ] Orders: person selection, order list, order detail work; no console errors.

---

## 5. Artifacts

| Artifact | Path |
|----------|------|
| Research | `specs/unified-inbox-visual-redesign-plan/research.md` |
| Data model | `specs/unified-inbox-visual-redesign-plan/data-model.md` |
| Quickstart | `specs/unified-inbox-visual-redesign-plan/quickstart.md` |
| Tasks | `specs/unified-inbox-visual-redesign-plan/tasks.md` |
| This plan | `specs/unified-inbox-visual-redesign-plan/plan.md` |

---

## Progress

- [X] Phase 0: Panel surfaces (UnifiedInboxPage, PeopleSidebar)
- [ ] Phase 1: Tabs and conversation list
- [ ] Phase 2: Conversation header
- [ ] Phase 3: ConversationThread composer dock and suggestion chip
- [ ] Phase 4: Orders panel dark header
- [ ] Phase 5: ConversationView / AllMessagesTimeline and QA
