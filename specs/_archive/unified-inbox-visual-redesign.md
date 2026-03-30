# Unified Inbox: Visual-Only Redesign

## Overview

Visual-only redesign of the Unified Inbox to match a cleaner SaaS layout (reference screenshot). No changes to data flow, queries, React Query keys, scroll guard, auto-read, or realtime subscriptions.

**Context:**
- Four-column structure (People | Conversations | Conversation | Orders) is retained.
- Reference design emphasizes hierarchy, spacing, surfaces, and consistent panel styling.
- Composer and suggestion chip should feel integrated rather than floating.

**Goal:**
- Cleaner panels: rounded corners, subtle borders, consistent padding.
- Conversation header: avatar + name + subline + actions.
- Tabs: pill-style.
- Orders panel: dark accent header at top.
- Composer: modern, integrated “dock” at bottom of conversation panel (sticky); suggestion chip inside composer area.
- People column: restyle only; collapsible behavior unchanged.

---

## Current State Analysis

### Layout Structure

**Four columns (unchanged structurally):**
- People (collapsible)
- Conversations list
- Conversation (thread + composer)
- Orders panel

**Observations:**
- Panel styling may be flat or inconsistent.
- Conversation header may not follow avatar + name + subline + actions pattern.
- Tabs may be standard underline or default style.
- Orders panel may lack a distinct header treatment.
- Composer and suggestion chip may feel visually disconnected.

### Out of Scope (Do Not Change)

- Data flow, API calls, query keys.
- Scroll guard and auto-read logic.
- Realtime subscriptions.
- Column structure (four columns kept).
- People column collapsible behavior (only restyle).

---

## Visual Redesign Requirements

### Panels (All Four Columns)

- Rounded corners on panel containers.
- Subtle borders (e.g. border-muted or similar).
- Consistent padding within panels.

### Conversation Header

- Layout: avatar + name + subline + actions (e.g. channel, status, or action buttons).
- Visual hierarchy clear; matches reference “clean SaaS” look.

### Tabs

- Pill-style tabs (e.g. All / Email / SMS / WhatsApp or equivalent).
- No change to tab logic or routing; styling only.

### Orders Panel

- Dark accent header at top of the Orders panel (background and text contrast).
- Rest of panel content styling consistent with other panels.

### Composer

- Treated as a clean “dock” at the bottom of the conversation panel.
- Sticky so it stays visible while scrolling the thread.
- Modern, integrated look (not floating or disconnected).
- Suggestion chip integrated into the composer area (no awkward floating).

### People Column

- Restyle only (rounded, borders, padding).
- Collapsible behavior and functionality unchanged.

---

## Implementation Approach

### Phase 1: Panel Surfaces

- Apply rounded corners, subtle borders, and consistent padding to the four column containers (People, Conversations, Conversation, Orders).
- Ensure hierarchy and spacing are consistent across panels.

### Phase 2: Conversation Header

- Restructure conversation header to: avatar + name + subline + actions.
- Use existing data (e.g. person name, channel, last message preview); no new queries.

### Phase 3: Tabs and Orders Header

- Restyle inbox tabs to pill style.
- Add dark accent header to the Orders panel (top bar with appropriate contrast).

### Phase 4: Composer Dock and Suggestion Chip

- Make composer a sticky “dock” at bottom of conversation panel.
- Integrate suggestion chip into the composer area (visually part of the dock, not floating above).
- Preserve existing composer behavior (reply text, send, channel select, reply-to).

### Phase 5: People Column Restyle

- Apply same panel surface treatment to People column.
- Verify collapsible behavior unchanged.

### Safety Considerations

- No changes to props, state, or event handlers that affect data or scroll/read logic.
- Visual-only: CSS/Tailwind and layout structure (e.g. flex/grid) only where needed for the dock and header.
- Manual QA: confirm scroll guard, auto-read, and realtime behavior unchanged.

---

## What NOT to Do

- Do not change data flow, queries, React Query keys, or API calls.
- Do not change scroll guard, auto-read logic, or realtime subscriptions.
- Do not change the four-column structure (no new columns, no removal).
- Do not change People column collapsible logic; only restyle.
- Do not add new features or change business logic.

---

## Acceptance Criteria

- [ ] Panels: cleaner look with rounded corners, subtle borders, consistent padding.
- [ ] Conversation header: avatar + name + subline + actions, matching reference.
- [ ] Tabs: pill style.
- [ ] Orders panel: dark top header (accent).
- [ ] Composer: modern, integrated dock at bottom; sticky; suggestion chip integrated into composer area (no awkward floating).
- [ ] People column: restyled; collapsible behavior unchanged.
- [ ] No regressions: scroll guard, auto-read, subscriptions, and data flow unchanged.

---

## Open Questions / Considerations

- Reference screenshot: ensure design tokens (colors, radius, spacing) are available or defined (e.g. Tailwind or CSS variables) to match the reference.
- Dark accent: confirm exact color (e.g. slate-800, zinc-900) for Orders header to match reference.
