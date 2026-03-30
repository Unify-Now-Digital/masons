# Contract: App Shell Layout

## Purpose
Define how the global app shell (left sidebar + content area) must behave so that main content expands correctly when the sidebar collapses.

## Requirements

1. **Sidebar width source of truth**
   - Expanded width: 140px (e.g. `w-[140px]` or `14rem`).
   - Collapsed width: 40px (e.g. `w-10` or `2.5rem`).
   - These values must be defined in one place (e.g. CSS variables, shared constants, or the sidebar component) and used for both the sidebar and the content offset.

2. **Content area offset**
   - The wrapper that contains the router/main content must have left padding (or margin) equal to the current sidebar width.
   - When sidebar is expanded: content offset = 140px.
   - When sidebar is collapsed: content offset = 40px.
   - Transition (if any) should be smooth and not block layout.

3. **Content area flex behavior**
   - The main content container (e.g. the div that wraps `AppRouter` or the dashboard main) must:
     - Use `flex-1` (or equivalent) so it takes remaining width.
     - Use `min-w-0` so flex children can shrink and overflow is handled correctly (e.g. horizontal scroll inside tables).
   - No arbitrary max-width on the main content wrapper that would prevent using full remaining space (unless explicitly required for readability).

4. **Desktop-only**
   - Behavior applies to desktop viewport (e.g. `md:` and up). Mobile can keep current behavior (e.g. overlay drawer).

## Files affected
- `src/app/App.tsx` — content wrapper and optionally provider for sidebar state.
- `src/app/layout/ReviewNavToolbar.tsx` — sidebar; may need to expose state or be wrapped by a layout provider.

## Acceptance
- With sidebar expanded, content area starts at 140px from the left.
- With sidebar collapsed, content area starts at 40px from the left (content visibly expands).
- Resizing viewport or toggling sidebar does not leave content stuck or overflow hidden incorrectly.
