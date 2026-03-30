# Tasks: Global Drawer UI Refresh — All Drawers Across Core Modules

Branch: `feature/global-drawer-ui-refresh`  
Spec: `specs/global-drawer-ui-refresh.md`  
Modules in scope: Jobs, Orders, People, Companies, Products, Inscriptions, Payments, Invoicing, Workers

## Guardrails

- Presentation-only: no business logic / validation / schema / API changes.
- Keep form wiring intact (react-hook-form, submit handlers, field names).
- Sticky header/footer everywhere; only drawer body scrolls.
- Use shared primitives to avoid inconsistent one-off styling.

---

## Phase 0: Drawer inventory (done)

See `research.md` for the full checklist. All 20 drawers enumerated.

---

## Phase 1: Build shared Drawer UI system

Create shared components in `src/shared/components/drawer/`.

### 1.1 AppDrawerLayout

- [x] Create `AppDrawerLayout.tsx`
- [ ] Width: `w-[720px] max-w-[90vw]` desktop, full width on small screens
- [ ] Header (sticky): title, optional description, close button
  - `sticky top-0 z-20 bg-background/95 backdrop-blur border-b`
- [ ] Body (scrollable): `flex-1 min-h-0 overflow-auto`, default `space-y-4`
  - Optional inner container `max-w-[680px] w-full mx-auto`
- [ ] Footer (sticky): Cancel left, Primary right
  - `sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t`
- [ ] Props: `title`, `description?`, `footerPrimaryLabel`, `footerPrimaryDisabled`, `onPrimary`, `footerSecondaryLabel`, `onSecondary`, `children`

**Acceptance:** Component compiles and can wrap existing drawer content without behavior changes.

### 1.2 DrawerSection

- [x] Create `DrawerSection.tsx`
- [ ] Compact section container `p-4 space-y-3`
- [ ] Optional collapsible variant (Accordion-style)
- [ ] Section title `text-xs font-semibold tracking-wide text-muted-foreground`

### 1.3 DrawerGrid

- [x] Create `DrawerGrid.tsx`
- [ ] `cols=1|2|3` with responsive defaults
- [ ] Children have `min-w-0`; gap `gap-3`

### 1.4 Styling rules

- [ ] Document: labels `text-xs font-medium`, helper `text-[11px] text-muted-foreground`, inputs `h-9`
- [ ] Default body spacing `space-y-4`; avoid huge empty vertical blocks

**Acceptance:** Shared components compile; can wrap existing drawers without logic changes.

---

## Phase 2: Global migration — apply shared layout to ALL drawers

Migrate module-by-module. For each drawer:
- Replace ad-hoc header + footer with `AppDrawerLayout`
- Move actions into sticky footer
- Wrap content into `DrawerSection` blocks
- Convert obvious pairs to `DrawerGrid` 2-col/3-col layouts
- Collapse advanced/rare sections in long drawers (Notes, Additional Options)

### 2.1 Orders

- [ ] Migrate `CreateOrderDrawer.tsx`
- [ ] Migrate `EditOrderDrawer.tsx`
- [ ] Make "Additional Options" and "Notes" collapsible by default

### 2.2 Invoicing

- [ ] Migrate `CreateInvoiceDrawer.tsx`
- [ ] Migrate `EditInvoiceDrawer.tsx`
- [ ] Compact date fields in grids; sticky footer always visible

### 2.3 Jobs

- [ ] Migrate `CreateJobDrawer.tsx`
- [ ] Migrate `EditJobDrawer.tsx`
- [ ] Worker selection and dates in compact grids

### 2.4 People (customers)

- [x] Migrate `CreateCustomerDrawer.tsx`
- [x] Migrate `EditCustomerDrawer.tsx`
- [ ] 2-col grids for common pairs; address full width

### 2.5 Companies

- [x] Migrate `CreateCompanyDrawer.tsx`
- [x] Migrate `EditCompanyDrawer.tsx`
- [ ] Compact contact fields into grids

### 2.6 Products (memorials)

- [ ] Migrate `CreateMemorialDrawer.tsx`
- [ ] Migrate `EditMemorialDrawer.tsx`
- [ ] Grids for dimension/price/metadata pairs

### 2.7 Inscriptions

- [ ] Migrate `CreateInscriptionDrawer.tsx`
- [ ] Migrate `EditInscriptionDrawer.tsx`
- [ ] Section long text fields; compact meta fields

### 2.8 Payments

- [ ] Migrate `CreatePaymentDrawer.tsx`
- [ ] Migrate `EditPaymentDrawer.tsx`
- [ ] Primary actions in sticky footer

### 2.9 Workers

- [ ] Migrate `CreateWorkerDrawer.tsx`
- [ ] Migrate `EditWorkerDrawer.tsx`

**Acceptance per module:** Every drawer uses `AppDrawerLayout` + sticky footer; typography/spacing normalized; no logic changes.

---

## Phase 3: Consistency pass

- [ ] Ensure widths consistent (`w-[720px] max-w-[90vw]`)
- [ ] Ensure header/footer stickiness works in every drawer
- [ ] Remove old full-width bottom buttons
- [ ] Ensure `min-h-0` correct so only body scrolls

**Acceptance:** Drawers feel like one cohesive system.

---

## Phase 4: QA checklist

- [ ] All 20 drawers migrated (inventory fully checked off)
- [ ] Header sticky works; close works
- [ ] Footer sticky works; primary action always visible
- [ ] Only body scrolls; no page scroll
- [ ] No validation/behavior changes
- [ ] No layout overflow on small screens
- [ ] `npm run build` passes

---

## Commit plan

1. `ui(drawers): add shared AppDrawerLayout + DrawerSection + DrawerGrid`
2. `ui(drawers): migrate Orders drawers to shared layout`
3. `ui(drawers): migrate Invoicing drawers to shared layout`
4. `ui(drawers): migrate Jobs drawers to shared layout`
5. `ui(drawers): migrate People + Companies drawers to shared layout`
6. `ui(drawers): migrate Products + Inscriptions drawers to shared layout`
7. `ui(drawers): migrate Payments + Workers drawers + final consistency pass`
