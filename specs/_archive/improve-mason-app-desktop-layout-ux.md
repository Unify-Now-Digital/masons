# Improve Mason App Overall Layout Responsiveness and UI/UX for Desktop/Laptop Use

## Overview

Define and implement a consistent, scalable desktop-first layout system so the Mason App remains usable and polished across desktop/laptop screen sizes. The left sidebar already collapses into an icon rail; the main content area must expand correctly when the sidebar is minimized. Main table pages (Orders, Invoicing, People, Workers) should scale better, and right detail sidebars should remain stable and consistent.

**Context:**
- Mason App is desktop/laptop focused.
- Left sidebar collapses into icon rail mode, but the main content area does not expand properly when the sidebar is minimized.
- Main table pages need to scale better across desktop/laptop screen sizes and resolutions.
- Right detail panels should remain right sidebars on desktop.
- Tables should use horizontal scrolling rather than crushing columns.
- Visual direction: clean business SaaS / minimal.

**Goal:**
- Create a consistent, scalable desktop-first layout system across the app.
- Main content expands dynamically when the left sidebar collapses.
- Pages remain usable across different desktop/laptop widths.
- Tables are readable and horizontally scroll when needed.
- Right detail sidebars remain stable and polished.
- Overall UI/UX feels cleaner, more consistent, and more professional.

---

## Current State Analysis

### Dashboard Shell Layout

**Location:** `src/app/layout/` (e.g. dashboard shell, sidebar, main content wrapper)

**Current Structure:**
- Main dashboard layout with left sidebar (expandable/collapsible to icon rail).
- Main content area likely uses fixed or constrained widths that do not respond to sidebar state.
- Right detail sidebars (Orders, Invoicing) are fixed/absolute panels.

**Observations:**
- Sidebar expanded/collapsed widths may not correctly drive main content width.
- Main content may lack proper flexible layout rules (e.g. `flex-1`, `min-w-0`).
- Unnecessary width constraints can prevent content from using available space.

### Page Structure Across Modules

**Modules:** Orders, Invoicing, People, Workers

**Current Structure:**
- Each module has a page with header, toolbar/search/filter/actions, main content (table), and optional right detail sidebar.
- Spacing, alignment, and structure can differ between modules.

**Observations:**
- Inconsistent spacing and alignment between modules.
- No single shared page layout pattern for header / toolbar / content / sidebar.

### Table Layout

**Locations:** Orders table, Invoicing table, People table, Workers table

**Current Structure:**
- Data tables with configurable columns (e.g. column visibility/order).
- Tables may be forced to fit viewport by compressing columns.

**Observations:**
- Column crushing reduces readability.
- Horizontal scroll may not be enabled or styled consistently.
- Minimum column widths and action buttons need to remain usable.

### Right Detail Sidebars

**Locations:** OrderDetailsSidebar (Orders), InvoiceDetailSidebar (Invoicing), and equivalent in People/Workers if present.

**Current Structure:**
- Fixed or absolute right-side panels with header, content, and close.
- Some support outside-click-to-close and backdrop.

**Observations:**
- Width, spacing, sticky header/close behavior, and internal scrolling may differ.
- Consistency across modules will improve perceived quality.

---

## Recommended Layout and Structure Adjustments

### Global Layout Rules

**Dashboard Shell:**
- Use flex/grid so main content area has `flex-1` and `min-w-0` to allow shrinking and prevent overflow from blocking expansion.
- Sidebar expanded/collapsed widths must be the only horizontal constraint on the content area; no extra max-width on main content unless intentional.
- Ensure right sidebars do not break the main content flex layout (e.g. sidebars as siblings or in a wrapper that does not constrain the table area).

**Page-Level Structure:**
- Standardize: page header → toolbar/search/filter/actions row → main content area → optional right detail sidebar.
- Reduce inconsistent spacing and alignment (e.g. shared padding, gap, and max-width if any).

### Table Behavior

- Prevent table column crushing: set minimum widths on columns or table container so that horizontal scroll appears when needed.
- Use a scrollable wrapper (e.g. `overflow-x-auto`) around the table.
- Preserve readable minimum widths and keep action buttons usable.
- Reuse existing column visibility/order controls where they exist.

### Right Sidebars

- Standardize width, internal spacing, sticky header/close, internal scrolling, and outside-click-to-close behavior.
- Keep desktop right-sidebar pattern; ensure they feel consistent across Orders, Invoicing, People, Workers.

### UI/UX Polish

- Spacing rhythm: consistent padding/gaps on pages, cards, and forms.
- Typography: clear hierarchy for titles, labels, and secondary text.
- Buttons: consistent styling and reasonable label lengths.
- Cards, tables, and sidebars: consistent borders, shadows, and backgrounds where appropriate.
- Loading and empty states: add or clean up where missing or inconsistent.

---

## Implementation Approach

### Phase 1: Global dashboard shell
- Audit and refactor the main dashboard layout shell.
- Ensure sidebar expanded/collapsed widths correctly affect main content width.
- Main content must use proper flexible layout rules:
  - flex/grid structure
  - flex-1
  - min-w-0
  - no unnecessary width constraints
- Ensure right sidebars do not break content layout.

### Phase 2: Shared page structure
- Standardize page layout across modules:
  - page header
  - toolbar/search/filter/actions row
  - main content area
  - right detail sidebar
- Reduce inconsistent spacing and alignment between modules.

### Phase 3: Table responsiveness
- For Orders, Invoicing, People, Workers:
  - prevent table column crushing
  - support horizontal scroll
  - preserve readable minimum widths
  - keep actions usable
- Reuse existing Columns controls where possible.

### Phase 4: Right detail sidebars
- Keep desktop right-sidebar pattern.
- Standardize:
  - width
  - spacing
  - sticky header/close behavior
  - internal scrolling
  - outside click close behavior
- Ensure sidebars feel consistent across modules.

### Phase 5: UI/UX polish
- Improve spacing rhythm across pages, cards, and forms.
- Improve typography hierarchy for titles, labels, and secondary text.
- Standardize action button styling and label lengths.
- Improve visual consistency of cards, tables, and sidebars.
- Add/clean loading and empty states where needed.

### Safety Considerations
- Layout and CSS-only changes where possible; avoid changing core workflow logic.
- Test with sidebar expanded and collapsed on multiple desktop widths.
- Verify right sidebars still open/close and scroll correctly after refactors.

---

## What NOT to Do

- Do not redesign core workflows; improve layout and UI/UX consistency only.
- Do not target mobile/tablet in this pass; desktop/laptop only.
- Do not remove the right sidebar interaction model.
- Do not over-compress table columns; use horizontal scroll for dense tables instead.
- Do not introduce new navigation or routing changes unless required for layout.

---

## Open Questions / Considerations

- Confirm exact sidebar width values (expanded vs icon rail) and whether they are defined in one place (e.g. CSS variables or theme).
- Whether to introduce a shared “PageLayout” or “TablePageLayout” component for Phase 2, or standardize via layout wrappers and spacing tokens only.
- Whether People and Workers modules already have right detail sidebars; if not, Phase 4 may only apply to Orders and Invoicing for now.

---

## Acceptance Criteria

- When the left sidebar collapses, the content area expands correctly on all major pages.
- Orders, Invoicing, People, and Workers tables remain readable across desktop/laptop sizes.
- Right detail sidebars remain usable and visually consistent.
- Pages look more polished and aligned with a clean SaaS UI.
- No major workflow regressions.
