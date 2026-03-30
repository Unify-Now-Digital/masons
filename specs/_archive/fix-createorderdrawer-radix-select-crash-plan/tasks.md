# Tasks: Fix CreateOrderDrawer/EditOrderDrawer Radix Select Crash

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Add sentinel constant to CreateOrderDrawer | Update | `src/modules/orders/components/CreateOrderDrawer.tsx` | High | None | 1 |
| 1.2 | Replace empty string SelectItem in CreateOrderDrawer | Update | `src/modules/orders/components/CreateOrderDrawer.tsx` | High | 1.1 | 1 |
| 1.3 | Update Select value prop in CreateOrderDrawer | Update | `src/modules/orders/components/CreateOrderDrawer.tsx` | High | 1.1 | 1 |
| 1.4 | Update onValueChange handler in CreateOrderDrawer | Update | `src/modules/orders/components/CreateOrderDrawer.tsx` | High | 1.1 | 1 |
| 1.5 | Verify form defaultValues in CreateOrderDrawer | Verify | `src/modules/orders/components/CreateOrderDrawer.tsx` | Medium | 1.4 | 1 |
| 2.1 | Add sentinel constant to EditOrderDrawer | Update | `src/modules/orders/components/EditOrderDrawer.tsx` | High | None | 2 |
| 2.2 | Replace empty string SelectItem in EditOrderDrawer | Update | `src/modules/orders/components/EditOrderDrawer.tsx` | High | 2.1 | 2 |
| 2.3 | Update Select value prop in EditOrderDrawer | Update | `src/modules/orders/components/EditOrderDrawer.tsx` | High | 2.1 | 2 |
| 2.4 | Update onValueChange handler in EditOrderDrawer | Update | `src/modules/orders/components/EditOrderDrawer.tsx` | High | 2.1 | 2 |
| 3.1 | Test CreateOrderDrawer | Verify | - | High | 1.1-1.5 | 3 |
| 3.2 | Test EditOrderDrawer | Verify | - | High | 2.1-2.4 | 3 |
| 3.3 | Build & lint validation | Verify | - | High | All | 3 |

---

## Phase 1: Fix CreateOrderDrawer

### Task 1.1: Add Sentinel Constant

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Add sentinel constant at the top of the component, matching the pattern used in CreateInvoiceDrawer.

**Acceptance Criteria:**
- [ ] Constant `NO_PERSON_SENTINEL = '__none__'` defined
- [ ] Placed after imports, before component definition
- [ ] Matches CreateInvoiceDrawer pattern

**Validation:**
- Constant defined correctly
- No syntax errors

---

### Task 1.2: Replace Empty String SelectItem

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Replace `<SelectItem value="">None</SelectItem>` with sentinel value.

**Acceptance Criteria:**
- [ ] `<SelectItem value="">None</SelectItem>` replaced
- [ ] New: `<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>`
- [ ] "None" option still displays correctly

**Validation:**
- No empty string values in SelectItem
- Component renders without error

---

### Task 1.3: Update Select Value Prop

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Update Select `value` prop to use sentinel when field value is null/empty.

**Acceptance Criteria:**
- [ ] `value={field.value || ''}` replaced
- [ ] New: `value={field.value || NO_PERSON_SENTINEL}`
- [ ] Null values map to sentinel correctly

**Validation:**
- Select value never becomes empty string
- Null values handled correctly

---

### Task 1.4: Update onValueChange Handler

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Update `onValueChange` to map sentinel to null and set person_name snapshot when customer selected.

**Acceptance Criteria:**
- [ ] Sentinel maps to null for person_id
- [ ] Sentinel sets person_name to null
- [ ] Customer selection sets person_id correctly
- [ ] Customer selection sets person_name snapshot correctly

**Validation:**
- Sentinel → null mapping works
- Customer selection works
- person_name snapshot set correctly

---

### Task 1.5: Verify Form DefaultValues

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** 1.4  
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Ensure form defaultValues use `null` (not empty string) for `person_id` and `person_name`.

**Acceptance Criteria:**
- [ ] `person_id: null` in defaultValues
- [ ] No empty strings in defaults

**Validation:**
- DefaultValues correct
- No empty strings

---

## Phase 2: Fix EditOrderDrawer

### Task 2.1: Add Sentinel Constant

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Add sentinel constant at the top of the component.

**Acceptance Criteria:**
- [ ] Constant `NO_PERSON_SENTINEL = '__none__'` defined
- [ ] Placed after imports, before component definition
- [ ] Matches CreateOrderDrawer pattern

**Validation:**
- Constant defined correctly
- No syntax errors

---

### Task 2.2: Replace Empty String SelectItem

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Replace `<SelectItem value="">None</SelectItem>` with sentinel value.

**Acceptance Criteria:**
- [ ] `<SelectItem value="">None</SelectItem>` replaced
- [ ] New: `<SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>`
- [ ] "None" option still displays correctly

**Validation:**
- No empty string values in SelectItem
- Component renders without error

---

### Task 2.3: Update Select Value Prop

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Update Select `value` prop to use sentinel when field value is null/empty.

**Acceptance Criteria:**
- [ ] `value={field.value || ''}` replaced
- [ ] New: `value={field.value || NO_PERSON_SENTINEL}`
- [ ] Null values map to sentinel correctly
- [ ] Pre-population works (order with person_id shows that id)

**Validation:**
- Select value never becomes empty string
- Null values handled correctly
- Pre-population works

---

### Task 2.4: Update onValueChange Handler

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Update `onValueChange` to map sentinel to null and set person_name snapshot when customer selected.

**Acceptance Criteria:**
- [ ] Sentinel maps to null for person_id
- [ ] Sentinel sets person_name to null
- [ ] Customer selection sets person_id correctly
- [ ] Customer selection sets person_name snapshot correctly
- [ ] Clearing selection works correctly

**Validation:**
- Sentinel → null mapping works
- Customer selection works
- Clearing selection works
- person_name snapshot set correctly

---

## Phase 3: Testing & Validation

### Task 3.1: Test CreateOrderDrawer

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** 1.1-1.5

**Description:**
Test all CreateOrderDrawer scenarios.

**Test Scenarios:**
- [ ] Open "Create New Order" → no crash
- [ ] Select "None" → person_id is null, person_name is null
- [ ] Select customer → person_id and person_name set correctly
- [ ] No console errors
- [ ] Form submission works correctly

**Validation:**
- All scenarios pass
- No Radix Select errors in console
- No blank page

---

### Task 3.2: Test EditOrderDrawer

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** 2.1-2.4

**Description:**
Test all EditOrderDrawer scenarios.

**Test Scenarios:**
- [ ] Open edit for order with no person → no crash, shows "None"
- [ ] Open edit for order with person → pre-populated correctly
- [ ] Change selection → works correctly
- [ ] Clear selection (select "None") → person_id and person_name set to null
- [ ] No console errors

**Validation:**
- All scenarios pass
- No Radix Select errors in console
- No blank page

---

### Task 3.3: Build & Lint Validation

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify build and lint pass.

**Validation:**
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] No TypeScript errors
- [ ] No console warnings

---

## Progress Tracking

### Phase 1: Fix CreateOrderDrawer
- [X] Task 1.1: Add sentinel constant
- [X] Task 1.2: Replace empty string SelectItem
- [X] Task 1.3: Update Select value prop
- [X] Task 1.4: Update onValueChange handler
- [X] Task 1.5: Verify form defaultValues

### Phase 2: Fix EditOrderDrawer
- [X] Task 2.1: Add sentinel constant
- [X] Task 2.2: Replace empty string SelectItem
- [X] Task 2.3: Update Select value prop
- [X] Task 2.4: Update onValueChange handler

### Phase 3: Testing & Validation
- [X] Task 3.1: Test CreateOrderDrawer
- [X] Task 3.2: Test EditOrderDrawer
- [X] Task 3.3: Build & lint validation

---

## Notes

- All changes are minimal and focused
- No database or schema changes
- Pattern matches existing CreateInvoiceDrawer implementation
- Both components need identical fixes

