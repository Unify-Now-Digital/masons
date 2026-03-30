# Global Drawer UI Refresh — Compact, Consistent, User-Friendly

## Overview

**Goal:** Redesign the UI of *all drawers* (create/edit flows) to be:
- More compact (less vertical whitespace, more information per screen)
- More user-friendly (clear sections, sticky actions, better hierarchy)
- Consistent across modules (Orders, Invoices, People, etc.)

Applies to: all right-side drawers / sheets used for create/edit (e.g., Create Order, Create Invoice, Create Person, Edit variants, etc.).

**Scope:** Presentation and layout only. No business logic, schema, API, or validation changes.

---

## Context

### Current state
- Drawers vary in layout, spacing, and structure across modules.
- Some drawers use large vertical gaps and full-width-only fields.
- Header/footer are not always sticky; users may need to scroll to reach Create/Save.
- No shared layout system for drawers.

### Non-goals (must not change)
- No business logic changes.
- No schema/API/RLS changes.
- No changes to validation rules or required fields (only presentation).
- No major workflow changes (fields remain available; reorganizing into sections is OK).
- Do not introduce new dependencies unless already in repo (shadcn/ui is OK).

---

## Standard Drawer Layout System (authoritative)

All drawers must use the same structure.

### 1) Sticky header
- Title (e.g., “Create New Order”)
- One-line description (optional)
- Close button
- Header must be sticky: `sticky top-0 z-20 bg-background/95 backdrop-blur border-b`

### 2) Scrollable body
- Only the body scrolls, not the whole page.
- Body uses compact spacing:
  - Replace large gaps with `space-y-4` (not `space-y-8`)
  - Inputs grouped in rows using 2–3 column grids where appropriate

### 3) Sticky footer action bar
- Footer always visible with primary action + secondary action.
- Footer sticky: `sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t`
- Buttons:
  - Left: Cancel (secondary)
  - Right: Primary action (Create/Save)
- Primary button must not span full width unless mobile.

**Acceptance**
- [ ] User can always see “Create/Save” without scrolling to the bottom.
- [ ] Header/footer remain visible while body scrolls.

---

## Compact Form Layout Rules (authoritative)

### Spacing & typography
- Labels: `text-xs font-medium`
- Helper text: `text-[11px] text-muted-foreground`
- Inputs: consistent height (prefer `h-9`)
- Reduce section padding to `p-4` (not oversized)

### Field layout
- Prefer 2-column layout for common pairs:
  - First/Last name
  - City/Country
  - Dates side-by-side
  - Cost/Status
- For very wide fields (notes, address): full width
- Use `min-w-0` and proper wrapping for long values

### Required fields
- Required indicator in label (existing) stays
- Validation messages should be tight and near the field

**Acceptance**
- [ ] Forms feel denser and faster to scan.
- [ ] Less empty space, fewer “long blank bands”.

---

## Sectioning for Long Drawers (authoritative)

For long forms (Orders, Invoices):
- Use collapsible sections (Accordion) OR clear section headers with compact separators.

### Recommended sections
- **Order:** Type, People, Deceased & Location, Costs, Additional Options, Notes
- **Invoice:** Person, Orders, Amount/Status, Important Dates, Payment Info, Notes

### Rules
- First section open by default.
- Advanced/rare sections collapsed by default (e.g., Additional Options, Notes).

**Acceptance**
- [ ] Users can complete common tasks without endless scrolling.

---

## Drawer Width & Responsiveness (authoritative)

- Drawer width should be consistent across app:
  - Desktop: `w-[720px] max-w-[90vw]` (or nearest equivalent)
  - Smaller screens: full width
- Content should not look “stretched”:
  - Use max-width containers inside body where needed (`max-w-[680px]`)

**Acceptance**
- [ ] Drawers don’t feel overly wide or overly narrow; consistent across modules.

---

## Visual Polish (authoritative)

- Use subtle borders and separators:
  - Section divider: `border-t` or muted header line
- Avoid giant empty panels:
  - Remove unnecessary large paddings/margins
- Keep button row clean and aligned

**Acceptance**
- [ ] Drawer looks modern, compact, and consistent with the rest of the app.

---

## Implementation Approach

1) **Create a shared wrapper component**
   - `AppDrawerLayout` (or similar)
   - Handles: header, scroll container, footer actions, sizing

2) **Create helper components**
   - `DrawerSection`
   - `DrawerGrid` (2-col/3-col)

3) **Migrate drawers incrementally**
   - Start with 3 drawers:
     - Create Order
     - Create Invoice
     - Create Person
   - Then apply same pattern to remaining drawers

---

## Done When

- [ ] Create Order / Create Invoice / Create Person drawers match new compact standard
- [ ] At least 80% of remaining drawers use the shared layout component
- [ ] Header/footer sticky behavior works everywhere
- [ ] No logic changes; build passes
