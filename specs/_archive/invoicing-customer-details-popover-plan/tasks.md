# Tasks: Invoicing Customer Details Popover

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Create shared component directory | Create | `src/shared/components/customer/` | High | None | 1 |
| 1.2 | Move CustomerDetailsPopover component | Move | `src/shared/components/customer/CustomerDetailsPopover.tsx` | High | 1.1 | 1 |
| 1.3 | Update Orders module import | Update | `src/modules/orders/components/SortableOrdersTable.tsx` | High | 1.2 | 1 |
| 1.4 | Delete old component file | Delete | `src/modules/orders/components/CustomerDetailsPopover.tsx` | High | 1.3 | 1 |
| 1.5 | Verify Orders module still works | Verify | - | High | 1.4 | 1 |
| 2.1 | Identify customer display locations | Verify | `src/modules/invoicing/pages/InvoicingPage.tsx` | High | None | 2 |
| 2.2 | Update Invoices list/table | Update | `src/modules/invoicing/pages/InvoicingPage.tsx` | High | 1.2, 2.1 | 2 |
| 2.3 | Update Invoice detail sidebar | Update | `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` | Medium | 1.2, 2.1 | 2 |
| 3.1 | Verify popover behavior | Verify | - | Medium | 2.2 | 3 |
| 3.2 | Verify styling consistency | Verify | - | Medium | 2.2 | 3 |
| 3.3 | Verify accessibility | Verify | - | Medium | 2.2 | 3 |
| 4.1 | Test Orders module | Verify | - | High | All | 4 |
| 4.2 | Test Invoicing list | Verify | - | High | All | 4 |
| 4.3 | Test Invoice detail | Verify | - | Medium | All | 4 |
| 4.4 | Test performance | Verify | - | High | All | 4 |
| 4.5 | Test edge cases | Verify | - | Medium | All | 4 |
| 4.6 | Build & lint validation | Verify | - | High | All | 4 |

---

## Phase 1: Refactor CustomerDetailsPopover to Shared Location

### Task 1.1: Create Shared Component Directory

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/shared/components/customer/` (new directory)

**Description:**
Create shared component directory for customer-related reusable components.

**Acceptance Criteria:**
- [ ] Directory `src/shared/components/customer/` created
- [ ] Directory structure matches existing `src/shared/components/ui/` pattern

**Validation:**
- Directory exists
- Structure matches existing patterns

---

### Task 1.2: Move CustomerDetailsPopover Component

**Type:** MOVE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** 
- **From:** `src/modules/orders/components/CustomerDetailsPopover.tsx`
- **To:** `src/shared/components/customer/CustomerDetailsPopover.tsx`

**Description:**
Move CustomerDetailsPopover component from Orders module to shared location.

**Acceptance Criteria:**
- [ ] Component file copied to new location
- [ ] All imports still work (should remain the same)
- [ ] Component code unchanged
- [ ] No syntax errors

**Validation:**
- Component file exists at new location
- All imports resolve correctly
- TypeScript compiles

---

### Task 1.3: Update Orders Module Import

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.2  
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Description:**
Update Orders module to import CustomerDetailsPopover from shared location.

**Acceptance Criteria:**
- [ ] Import changed from local to shared location
- [ ] Import path: `@/shared/components/customer/CustomerDetailsPopover`
- [ ] Orders module still compiles
- [ ] No TypeScript errors

**Validation:**
- Import updated correctly
- No compilation errors
- Component still accessible

---

### Task 1.4: Delete Old Component File

**Type:** DELETE  
**Priority:** High  
**Dependencies:** 1.3  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Delete the old component file from Orders module after verifying shared component works.

**Acceptance Criteria:**
- [ ] Old file deleted
- [ ] Orders module still works
- [ ] No broken imports

**Validation:**
- File removed
- Orders module compiles
- No import errors

---

### Task 1.5: Verify Orders Module Still Works

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** 1.4

**Description:**
Test that Orders module popover still works after refactor.

**Test Scenarios:**
- [ ] Click customer name in Orders table → popover opens
- [ ] Person data loads correctly
- [ ] Fallback works when person_id null
- [ ] "Linked"/"Unlinked" badge displays correctly
- [ ] "Open Person" button works
- [ ] Messages section displays

**Validation:**
- All Orders scenarios pass
- No regressions
- Build passes

---

## Phase 2: Invoicing MVP Integration (Option A)

### Task 2.1: Identify Customer Display Locations

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None  
**Files:** 
- `src/modules/invoicing/pages/InvoicingPage.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Identify where customer name is displayed in Invoicing module.

**Acceptance Criteria:**
- [ ] Invoices list/table location identified (line ~276)
- [ ] Invoice detail location identified (if applicable)
- [ ] Ready for integration

**Validation:**
- All customer display locations found
- Integration points clear

---

### Task 2.2: Update Invoices List/Table

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.2, 2.1  
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Description:**
Add CustomerDetailsPopover to Customer column in invoices table.

**Acceptance Criteria:**
- [ ] CustomerDetailsPopover imported from shared location
- [ ] Customer column wraps customer name with popover
- [ ] Props passed correctly:
  - `personId={null}`
  - `fallbackName={invoice.customer}`
  - `fallbackPhone={null}`
  - `fallbackEmail={null}`
- [ ] "—" shown when no customer name (no popover trigger)

**Validation:**
- Import added correctly
- Customer column renders popover
- Clickable customer name works
- "—" shown correctly when no customer

---

### Task 2.3: Update Invoice Detail Sidebar (if applicable)

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 1.2, 2.1  
**File:** `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`

**Description:**
Add CustomerDetailsPopover to customer name display in invoice detail sidebar (if customer name is shown).

**Acceptance Criteria:**
- [ ] Customer name in detail view is clickable (if present)
- [ ] Popover works correctly
- [ ] Same behavior as list/table
- [ ] If no customer name shown, skip this task

**Validation:**
- Detail view popover works (if applicable)
- Consistent with list/table behavior

---

## Phase 3: Navigation & UX Polish

### Task 3.1: Verify Popover Behavior

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** 2.2

**Description:**
Ensure popover opens on click, closes on outside click/ESC, and has consistent width.

**Acceptance Criteria:**
- [ ] Popover opens on trigger click
- [ ] Closes on outside click
- [ ] Closes on ESC key
- [ ] Width consistent with Orders popover (w-80 = 320px)
- [ ] No layout shift in table rows

**Validation:**
- All behaviors work correctly
- No layout issues
- Consistent with Orders module

---

### Task 3.2: Verify Styling Consistency

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** 2.2

**Description:**
Ensure trigger styling matches Orders module (link-style button).

**Acceptance Criteria:**
- [ ] Trigger looks like clickable link/button
- [ ] Hover state works
- [ ] Consistent with Orders module styling
- [ ] No table layout shift

**Validation:**
- Styling matches Orders module
- Hover states work
- No layout issues

---

### Task 3.3: Verify Accessibility

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** 2.2

**Description:**
Ensure keyboard navigation and focus management work correctly.

**Acceptance Criteria:**
- [ ] Keyboard focus works correctly
- [ ] Click target large enough (button element)
- [ ] Screen reader friendly
- [ ] Tab navigation works

**Validation:**
- Keyboard navigation works
- Focus management correct
- Screen reader tested

---

## Phase 4: Validation

### Task 4.1: Test Orders Module

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify Orders module still works after refactor.

**Test Scenarios:**
- [ ] Click customer name → popover opens
- [ ] Person data loads correctly
- [ ] Fallback works
- [ ] All existing functionality preserved

**Validation:**
- All Orders scenarios pass
- No regressions
- Build passes

---

### Task 4.2: Test Invoicing List

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify clicking customer name in Invoices list opens popover correctly.

**Test Scenarios:**
- [ ] Click customer name → popover opens
- [ ] Shows "Unlinked" badge (no person_id)
- [ ] Shows customer_name in header
- [ ] Phone/email show "—"
- [ ] Messages section displays
- [ ] "Open Person" button NOT shown (no personId)

**Validation:**
- Popover opens on click
- Content displays correctly
- Badge shows "Unlinked"
- No errors

---

### Task 4.3: Test Invoice Detail (if applicable)

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

**Description:**
Verify customer popover works in invoice detail view (if customer name is shown).

**Test Scenarios:**
- [ ] Same as list/table scenarios
- [ ] Popover works in detail context

**Validation:**
- Detail view popover works (if applicable)
- Consistent with list/table behavior

---

### Task 4.4: Test Performance

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify no performance issues (no prefetching, proper lazy loading).

**Acceptance Criteria:**
- [ ] No People fetch on Invoices page load (verify Network tab)
- [ ] No extra queries triggered
- [ ] Lazy loading works correctly (if personId becomes available)

**Validation:**
- No prefetching verified in Network tab
- No unnecessary queries
- Performance acceptable

---

### Task 4.5: Test Edge Cases

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

**Description:**
Verify edge cases handled correctly.

**Test Scenarios:**
- [ ] Empty customer_name → shows "—" without popover
- [ ] Null customer_name → shows "—" without popover
- [ ] "No person assigned" → shows "—" without popover
- [ ] Very long customer names → popover displays correctly

**Validation:**
- All edge cases handled
- No crashes or errors
- Graceful degradation

---

### Task 4.6: Build & Lint Validation

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify build and lint pass.

**Acceptance Criteria:**
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] No TypeScript errors
- [ ] No console warnings

**Validation:**
- Build successful
- Lint passes
- No errors or warnings

---

## Progress Tracking

### Phase 1: Refactor CustomerDetailsPopover to Shared Location
- [X] Task 1.1: Create shared component directory
- [X] Task 1.2: Move CustomerDetailsPopover component
- [X] Task 1.3: Update Orders module import
- [X] Task 1.4: Delete old component file
- [X] Task 1.5: Verify Orders module still works

### Phase 2: Invoicing MVP Integration (Option A)
- [X] Task 2.1: Identify customer display locations
- [X] Task 2.2: Update Invoices list/table
- [X] Task 2.3: Update Invoice detail sidebar

### Phase 3: Navigation & UX Polish
- [X] Task 3.1: Verify popover behavior
- [X] Task 3.2: Verify styling consistency
- [X] Task 3.3: Verify accessibility

### Phase 4: Validation
- [X] Task 4.1: Test Orders module
- [X] Task 4.2: Test Invoicing list
- [X] Task 4.3: Test Invoice detail
- [X] Task 4.4: Test performance
- [X] Task 4.5: Test edge cases
- [X] Task 4.6: Build & lint validation

---

## Notes

- All changes are additive UI only
- No database or schema changes
- Reuses existing component and hooks
- Performance optimized (no prefetching)
- Option A (simple approach) - no joins to orders table
- Option B (enhanced approach) can be added later if needed

