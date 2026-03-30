# Unified Inbox — Density & Header Polish (UI-only)

## Overview

**Goal:** Polish the Unified Inbox UI after the layout update by:
1. Making **conversation picker rows** denser (smaller fonts + smaller row height) to fit more items.
2. Replacing the **conversation header/contact area** above the message panel with a cleaner, more structured UI.
3. Improving the **tab picker** (All/Email/SMS/WhatsApp) to be wider and feel like a segmented control.

**Scope:** Visual polish only. No database, API, RLS, Edge Function, or query changes.

---

## Context

### Current state (post layout update)
- **Layout:** 3-column grid (People ~180px, Conversations ~260px, Conversation panel 1fr).
- **Tabs:** All | Email | SMS | WhatsApp (TabsList grid-cols-4).
- **Conversation list:** Compact cards with CardHeader, p-2.5, line-clamp-1 preview, small badges.
- **Conversation panel:** Contact header (Card with avatar, name, subject) + optional “Not linked” banner + message list (container scroll) + reply box.
- **Scroll:** Message list scroll only; no page jump (existing fix must remain).

### Non-goals (must not change)
- No database, API, RLS, Edge Function, or query changes.
- No changes to unread logic (badges/counts) or “Mark as Read” behavior.
- No changes to linking logic (linked/unlinked/ambiguous); only UI presentation.
- Do not regress scroll behavior: message list scroll only; no page jumping.
- No new features (keyboard nav, search changes, etc.)—visual polish only.

---

## Functional Requirements

### A) Conversation list density (conversation picker rows)

**Objective:** Convert conversation items from “card-like” to “compact list-row” feel; fit noticeably more rows per viewport without hurting scanability.

**Visual specs (authoritative)**

| Element | Spec |
|--------|------|
| Container | `p-2`; `rounded-md`; internal `gap-1.5`; reduce vertical separation between rows |
| Title (sender/phone/email) | `text-xs font-medium truncate` |
| Preview/subject | `text-[11px] text-muted-foreground truncate leading-tight` |
| Date/time | `text-[10px] text-muted-foreground` |
| Badges/pills | `text-[10px] px-1.5 py-0.5 rounded-sm`; reduce prominence vs title |
| Row style | `hover:bg-muted/30`; optional `border-b last:border-b-0` (lighter than full card borders) |
| Selected state | Clearly obvious but not bulky: `bg-muted/50` and/or `ring-1 ring-primary/30`; optional `border-l-2 border-l-primary` |

**Acceptance**
- [ ] Conversation rows are visibly shorter and denser.
- [ ] Preview text is exactly one line.
- [ ] Selected row remains clearly distinguishable.

---

### B) Conversation header/contact area redesign (above message panel)

**Current issue:** Header area lacks hierarchy; heavy “Not linked” banner; actions feel detached.

**Requirements**
- Replace with a compact, structured header.
- **Left:** Avatar + primary identifier (name/email/phone) + secondary line (channel + handle).
- **Status:** Show link state as a small pill near identity (e.g. “Not linked”, “Linked”, “Ambiguous”).
- **Right:** Primary action button (“Link person” when unlinked; “Change link” when linked/ambiguous).
- Keep header height compact (single header row).
- Header sticky within conversation panel without affecting overall page scroll: `sticky top-0 z-10 bg-background`.

**Visual specs**

| Element | Spec |
|--------|------|
| Avatar | `h-8 w-8` |
| Primary text | `text-sm font-medium truncate` |
| Secondary line | `text-xs text-muted-foreground` |
| Status pill | `variant="outline"` or subtle background; `text-[11px]` |
| Action button | `size="sm"`; label “Link person” when unlinked; “Change link” when linked/ambiguous |

**Acceptance**
- [ ] Header looks clean and consistent across Email/SMS/WhatsApp.
- [ ] “Not linked” is a pill, not a banner.
- [ ] Action button placement is consistent and aligned.
- [ ] No scroll regressions.

---

### C) Tabs polish (All / Email / SMS / WhatsApp)

**Requirements**
- Tabs wider, easier to click, look like a segmented control.
- Tabs container fills the conversation list column width.
- Each tab has consistent height and padding.

**Visual specs (authoritative)**

| Element | Spec |
|--------|------|
| Container | Segmented control style: `grid grid-cols-4 gap-1 bg-muted/40 p-1 rounded-lg` |
| Each tab | `h-8`; `text-xs font-medium` |
| Active tab | `bg-background shadow-sm` (or equivalent) |
| Inactive tab | Subtle; no heavy borders |
| Active state | Clearly visible |

**Acceptance**
- [ ] Tabs feel like a unified control (not spaced buttons).
- [ ] Click targets are larger and consistent.
- [ ] Layout doesn’t shift when switching tabs.

---

## Implementation Notes

### Files to touch (guidance)
| Area | File |
|------|------|
| Inbox page composition, tabs, conversation list rows | `src/modules/inbox/pages/UnifiedInboxPage.tsx` |
| Conversation view header, message panel | `src/modules/inbox/components/ConversationView.tsx` |

- Conversation list row: currently a `Card` + `CardHeader` in UnifiedInboxPage; apply compact list-row styles (may keep Card with new classes or use a simple div with border/hover).
- Conversation header: currently Card with avatar, title, subject, “Not linked” banner, and action in ConversationView; replace with single compact header row + status pill + action; remove or replace banner with pill.
- Tabs: TabsList + TabsTrigger in UnifiedInboxPage; restyle to segmented control (container + per-tab classes).

### Constraints
- Keep diffs minimal and UI-only.
- Follow existing shadcn/ui + Tailwind patterns in the codebase.

---

## Done when

- Conversation list rows are compact and readable (more items on screen).
- Conversation header has clear hierarchy, status pill, and aligned action.
- Tabs are wide segmented-control style.
- No behavior or scroll regressions.
- Build passes; no new lint/TS errors.
