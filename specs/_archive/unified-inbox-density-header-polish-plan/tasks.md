# Tasks: Unified Inbox — Density & Header Polish (UI-only)

**Branch:** feature/unified-inbox-density-header-polish  
**Spec:** specs/unified-inbox-density-header-polish.md

---

## Phase 0 — Guardrails
- [X] UI-only styling/layout. No DB/API/query/logic changes.
- [X] Preserve unread badge/count and Mark as Read behavior.
- [X] Preserve scroll behavior (message list scroll only; no page jump).

---

## Phase 1 — Identify files (done in research.md)
- [X] **UnifiedInboxPage.tsx** — tabs, conversation list rows
- [X] **ConversationView.tsx** — conversation header, message panel (sticky header)

---

## Phase 2 — Tabs polish → segmented control (Spec C)

### Task 2.1: Segmented control container and tabs [X]
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- Wrap TabsList (or replace styling) with segmented control style:
  - Container: `grid grid-cols-4 gap-1 bg-muted/40 p-1 rounded-lg w-full`
  - Each tab (TabsTrigger): `h-8 text-xs font-medium`
  - Active: `bg-background shadow-sm` (or equivalent)
  - Inactive: subtle; no heavy borders
- Ensure tab state and filtering logic unchanged (same `activeTab`, same filters useMemo).
- Ensure no layout shift when switching tabs (consistent height/padding).

### Check
- Tabs fill conversation list column width and look like one control.
- Active tab is clearly visible.

---

## Phase 3 — Conversation list density (Spec A)

### Task 3.1: Compact list-row styling [X]
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- Container: `p-2`, `rounded-md`, internal `gap-1.5`; reduce vertical separation between rows (e.g. `space-y-2` or similar).
- Typography:
  - Title (primary_handle): `text-xs font-medium truncate`
  - Preview: `text-[11px] text-muted-foreground truncate leading-tight` (1 line)
  - Date: `text-[10px] text-muted-foreground`
- Badges: `text-[10px] px-1.5 py-0.5 rounded-sm`
- Row: `hover:bg-muted/30`; optional `border-b last:border-b-0`
- Selected: `bg-muted/50` and/or `ring-1 ring-primary/30`; optional `border-l-2 border-l-primary` (keep clearly distinguishable).

### Check
- More rows fit in viewport; preview is single line; selected row clearly highlighted.

---

## Phase 4 — Conversation header redesign (Spec B)

### Task 4.1: Compact header row + status pill [X]
**File:** `src/modules/inbox/components/ConversationView.tsx`
- Remove the full-width “Not linked to a person” / “Choose person” banner.
- Replace header area with a single compact row:
  - Left: Avatar `h-8 w-8` + primary identifier `text-sm font-medium truncate` + secondary line (channel + handle) `text-xs text-muted-foreground`
  - Status pill near identity: “Not linked” / “Linked” / “Ambiguous” — `variant="outline"` or subtle; `text-[11px]`
  - Right: action button `size="sm"` — “Link person” when unlinked; “Change link” when linked or ambiguous.
- Make this header row sticky within the conversation panel:
  - `sticky top-0 z-10 bg-background` on the header wrapper (so only the message list below scrolls; no whole-page scroll change).

### Task 4.2: Sticky scope [X]
- Ensure sticky is applied to a wrapper that is inside the scrollable conversation panel column (UnifiedInboxPage’s third column), not the document. Message list remains the only scrollable area; no new window scroll.

### Check
- Header looks clean for Email/SMS/WhatsApp; status is a pill; action aligned; no scroll regressions.

---

## Phase 5 — QA checklist (manual)

- [X] Tabs are segmented-control style; no layout shift.
- [X] Conversation rows denser; smaller fonts; single-line preview.
- [X] Selected + hover states work and are not too heavy.
- [X] Header redesigned; status pill shown; action button correct.
- [X] Sticky header works; no scroll regressions.
- [X] No TS/lint errors; build passes.

---

## Phase 6 — Commit plan (3 commits)

1. **Commit 1:** `ui(inbox): segmented tabs polish` — UnifiedInboxPage tabs only.
2. **Commit 2:** `ui(inbox): denser conversation rows` — UnifiedInboxPage conversation list items only.
3. **Commit 3:** `ui(inbox): redesign conversation header (sticky + status pill)` — ConversationView header only.

---

## Output for /implement
- Minimal UI-only diffs.
- No behavior or data/logic changes outside the specified polish.
