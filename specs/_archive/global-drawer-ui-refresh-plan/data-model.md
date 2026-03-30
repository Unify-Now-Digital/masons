# Data model (no schema changes)

This feature is **presentation-only**. No database, API, or schema changes.

## Existing form data flow (unchanged)

- Drawers use `react-hook-form` with zod schemas (e.g. `orderFormSchema`, `invoiceFormSchema`).
- Field names, validation rules, and submit handlers remain unchanged.
- Only layout, spacing, and structure change (sticky header/footer, sections, grids).

## New shared components (UI only)

- `AppDrawerLayout` — wrapper for header, scrollable body, sticky footer; no data handling.
- `DrawerSection` — layout container for form sections; no data handling.
- `DrawerGrid` — grid layout for fields; no data handling.
