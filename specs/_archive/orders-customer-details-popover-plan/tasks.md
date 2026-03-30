# Tasks: Orders Customer Details Popover

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Create CustomerDetailsPopover component file | Create | `src/modules/orders/components/CustomerDetailsPopover.tsx` | High | None | 1 |
| 1.2 | Implement popover state and trigger | Update | `src/modules/orders/components/CustomerDetailsPopover.tsx` | High | 1.1 | 1 |
| 1.3 | Implement data fetching logic | Update | `src/modules/orders/components/CustomerDetailsPopover.tsx` | High | 1.2 | 1 |
| 1.4 | Implement header section | Update | `src/modules/orders/components/CustomerDetailsPopover.tsx` | High | 1.3 | 1 |
| 1.5 | Implement basic info section | Update | `src/modules/orders/components/CustomerDetailsPopover.tsx` | High | 1.3 | 1 |
| 1.6 | Implement actions section | Update | `src/modules/orders/components/CustomerDetailsPopover.tsx` | Medium | 1.4, 1.5 | 1 |
| 1.7 | Implement messages section | Update | `src/modules/orders/components/CustomerDetailsPopover.tsx` | Medium | 1.5 | 1 |
| 2.1 | Update UIOrder interface | Update | `src/modules/orders/utils/orderTransform.ts` | High | None | 2 |
| 2.2 | Update transformOrderForUI function | Update | `src/modules/orders/utils/orderTransform.ts` | High | 2.1 | 2 |
| 2.3 | Update SortableOrdersTable customer column | Update | `src/modules/orders/components/SortableOrdersTable.tsx` | High | 1.1, 2.2 | 2 |
| 3.1 | Verify popover behavior | Verify | `src/modules/orders/components/CustomerDetailsPopover.tsx` | Medium | 1.7 | 3 |
| 3.2 | Add loading states | Update | `src/modules/orders/components/CustomerDetailsPopover.tsx` | Medium | 1.5 | 3 |
| 3.3 | Verify accessibility | Verify | `src/modules/orders/components/CustomerDetailsPopover.tsx` | Medium | 1.7 | 3 |
| 4.1 | Test Orders page loading | Verify | - | High | All | 4 |
| 4.2 | Test popover opening | Verify | - | High | All | 4 |
| 4.3 | Test lazy loading | Verify | - | High | All | 4 |
| 4.4 | Test fallback scenarios | Verify | - | High | All | 4 |
| 4.5 | Test navigation | Verify | - | Medium | All | 4 |
| 4.6 | Test messages section | Verify | - | Medium | All | 4 |
| 4.7 | Build & lint validation | Verify | - | High | All | 4 |

---

## Phase 1: CustomerDetailsPopover Component

### Task 1.1: Create CustomerDetailsPopover Component File

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Create new component file with basic structure using shadcn/ui Popover and Card components.

**Acceptance Criteria:**
- [ ] Component file created
- [ ] Imports correct (Popover, Card, Badge, Button, useCustomer, useNavigate, Skeleton)
- [ ] Basic component structure in place
- [ ] Props interface defined

**Validation:**
- File exists
- No syntax errors
- TypeScript compiles

---

### Task 1.2: Implement Popover State and Trigger

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement popover open/close state management and trigger rendering.

**Acceptance Criteria:**
- [ ] `open` state managed with useState
- [ ] Popover component wraps trigger
- [ ] Trigger renders correctly
- [ ] Popover opens/closes on trigger click

**Validation:**
- Popover state works correctly
- Trigger click opens/closes popover
- No console errors

---

### Task 1.3: Implement Data Fetching Logic

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.2  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement lazy-loading data fetch using `useCustomer` hook, enabled only when popover is open and personId exists.

**Acceptance Criteria:**
- [ ] `useCustomer` hook called with personId
- [ ] Query enabled only when `open && !!personId`
- [ ] Display values computed with fallbacks
- [ ] `isLinked` computed correctly

**Validation:**
- Query only runs when popover open and personId exists
- Fallback values used correctly
- Loading and error states handled

---

### Task 1.4: Implement Header Section

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.3  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement header with customer name and Linked/Unlinked badge.

**Acceptance Criteria:**
- [ ] Header displays customer name correctly
- [ ] Badge shows "Linked" when person loaded
- [ ] Badge shows "Unlinked" when personId null or fetch fails
- [ ] Badge variant changes based on linked status

**Validation:**
- Header renders correctly
- Badge displays correct text and variant
- Name fallback works

---

### Task 1.5: Implement Basic Info Section

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.3  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement basic info section showing phone, email, and address with fallbacks.

**Acceptance Criteria:**
- [ ] Phone displayed (person or fallback or "—")
- [ ] Email displayed (person or fallback or "—")
- [ ] Address displayed (person or "—")
- [ ] Loading skeleton shows while fetching
- [ ] Fields show "—" when missing

**Validation:**
- Basic info displays correctly
- Loading skeleton works
- Fallback values used correctly

---

### Task 1.6: Implement Actions Section

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 1.4, 1.5  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement "Open Person" button that navigates to customers page, only shown when personId exists.

**Acceptance Criteria:**
- [ ] Button only shows when personId exists
- [ ] Button navigates to `/dashboard/customers`
- [ ] Popover closes on navigation
- [ ] Button styled correctly

**Validation:**
- Button conditional rendering works
- Navigation works correctly
- Popover closes on click

---

### Task 1.7: Implement Messages Section

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 1.5  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement "Messages (Coming soon)" placeholder section.

**Acceptance Criteria:**
- [ ] Messages section displays correctly
- [ ] "Coming soon" placeholder text shown
- [ ] Optional skeleton rows included
- [ ] Section styled correctly

**Validation:**
- Messages section renders
- Placeholder text correct
- Skeleton rows visible (optional)

---

## Phase 2: Orders Table Integration

### Task 2.1: Update UIOrder Interface

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/orders/utils/orderTransform.ts`

**Description:**
Add `personId` and fallback fields to UIOrder interface.

**Acceptance Criteria:**
- [ ] `personId?: string | null` added
- [ ] `fallbackPhone?: string | null` added
- [ ] `fallbackEmail?: string | null` added
- [ ] Interface compiles without errors

**Validation:**
- Interface updated correctly
- TypeScript compiles
- No breaking changes

---

### Task 2.2: Update transformOrderForUI Function

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/orders/utils/orderTransform.ts`

**Description:**
Update transform function to include personId and fallback fields in UIOrder.

**Acceptance Criteria:**
- [ ] `personId: order.person_id` added
- [ ] `fallbackPhone: order.customer_phone` added
- [ ] `fallbackEmail: order.customer_email` added
- [ ] Existing functionality preserved

**Validation:**
- Transform function includes new fields
- Existing fields still work
- All tests pass

---

### Task 2.3: Update SortableOrdersTable Customer Column

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.1, 2.2  
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Description:**
Add specific case for 'customer' column to render CustomerDetailsPopover instead of plain text.

**Acceptance Criteria:**
- [ ] CustomerDetailsPopover imported
- [ ] Case for 'customer' column added
- [ ] Popover wraps clickable customer name
- [ ] Props passed correctly (personId, fallbackName, fallbackPhone, fallbackEmail)
- [ ] "—" shown when no customer name (no popover)

**Validation:**
- Customer column renders popover
- Clickable customer name works
- "—" shown correctly when no customer
- No layout shift

---

## Phase 3: Navigation & Polish

### Task 3.1: Verify Popover Behavior

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** 1.7  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Ensure popover opens on click, closes on outside click/ESC, and has appropriate width.

**Acceptance Criteria:**
- [ ] Popover opens on trigger click
- [ ] Popover closes on outside click
- [ ] Popover closes on ESC key
- [ ] Width appropriate (w-80 = 320px)
- [ ] No layout shift in table

**Validation:**
- All behaviors work correctly
- No layout issues
- Accessibility maintained

---

### Task 3.2: Add Loading States

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 1.5  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Ensure loading skeleton displays correctly while Person data loads.

**Acceptance Criteria:**
- [ ] Loading skeleton shows while fetching
- [ ] Smooth transition to content
- [ ] No flickering

**Validation:**
- Loading state works correctly
- Smooth transitions
- Good UX

---

### Task 3.3: Verify Accessibility

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** 1.7  
**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Ensure keyboard navigation and focus management work correctly.

**Acceptance Criteria:**
- [ ] Keyboard focus works correctly
- [ ] Click target large enough (button element)
- [ ] Screen reader friendly

**Validation:**
- Keyboard navigation works
- Focus management correct
- Screen reader tested

---

## Phase 4: Validation

### Task 4.1: Test Orders Page Loading

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify Orders page loads without errors.

**Acceptance Criteria:**
- [ ] Orders page loads successfully
- [ ] Table renders correctly
- [ ] No console errors
- [ ] No runtime crashes

**Validation:**
- Page loads correctly
- No errors in console
- Table displays properly

---

### Task 4.2: Test Popover Opening

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify clicking customer name opens popover correctly.

**Acceptance Criteria:**
- [ ] Clicking customer name opens popover
- [ ] Popover content displays correctly
- [ ] No crashes or errors

**Validation:**
- Popover opens on click
- Content displays correctly
- No errors

---

### Task 4.3: Test Lazy Loading

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify Person data fetch occurs only on popover open and caching works.

**Acceptance Criteria:**
- [ ] Person data fetch occurs only on popover open (verify in Network tab)
- [ ] No prefetching for all rows
- [ ] Caching works (multiple orders with same person_id share data)

**Validation:**
- Lazy loading verified in Network tab
- No prefetching
- Caching works correctly

---

### Task 4.4: Test Fallback Scenarios

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify snapshot fallback works when person_id is null or fetch fails.

**Acceptance Criteria:**
- [ ] Snapshot fallback works when person_id is null
- [ ] Snapshot fallback works when person fetch fails
- [ ] "Unlinked" badge shown correctly
- [ ] All fields display correctly with fallbacks

**Validation:**
- Fallback scenarios work
- Badge displays correctly
- Fields show correct data

---

### Task 4.5: Test Navigation

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

**Description:**
Verify "Open Person" button navigates correctly.

**Acceptance Criteria:**
- [ ] "Open Person" button navigates to `/dashboard/customers`
- [ ] Button only shows when personId exists
- [ ] Popover closes on navigation

**Validation:**
- Navigation works correctly
- Button conditional rendering works
- Popover closes

---

### Task 4.6: Test Messages Section

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

**Description:**
Verify Messages section displays correctly.

**Acceptance Criteria:**
- [ ] Messages section displays correctly
- [ ] "Coming soon" placeholder text shown
- [ ] Optional skeleton rows visible

**Validation:**
- Messages section renders
- Placeholder text correct
- Skeleton rows visible (optional)

---

### Task 4.7: Build & Lint Validation

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

### Phase 1: CustomerDetailsPopover Component
- [X] Task 1.1: Create component file
- [X] Task 1.2: Implement popover state and trigger
- [X] Task 1.3: Implement data fetching logic
- [X] Task 1.4: Implement header section
- [X] Task 1.5: Implement basic info section
- [X] Task 1.6: Implement actions section
- [X] Task 1.7: Implement messages section

### Phase 2: Orders Table Integration
- [X] Task 2.1: Update UIOrder interface
- [X] Task 2.2: Update transformOrderForUI function
- [X] Task 2.3: Update SortableOrdersTable customer column

### Phase 3: Navigation & Polish
- [X] Task 3.1: Verify popover behavior
- [X] Task 3.2: Add loading states
- [X] Task 3.3: Verify accessibility

### Phase 4: Validation
- [X] Task 4.1: Test Orders page loading
- [X] Task 4.2: Test popover opening
- [X] Task 4.3: Test lazy loading
- [X] Task 4.4: Test fallback scenarios
- [X] Task 4.5: Test navigation
- [X] Task 4.6: Test messages section
- [X] Task 4.7: Build & lint validation

---

## Notes

- All changes are additive UI only
- No database or schema changes
- Reuses existing hooks and components
- Performance optimized with lazy loading
- Fallback strategy ensures resilience

