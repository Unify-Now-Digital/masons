# Tasks: Fix Orders Customer/Person Assignment

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Create migration: add person_id and person_name to orders | Create | `supabase/migrations/YYYYMMDDHHmmss_add_person_fields_to_orders.sql` | High | None | 1 |
| 1.2 | Validate migration locally | Verify | - | High | 1.1 | 1 |
| 2.1 | Update Order TypeScript types | Update | `src/modules/orders/types/orders.types.ts` | High | 1.1 | 2 |
| 2.2 | Update Order form schema | Update | `src/modules/orders/schemas/order.schema.ts` | High | 2.1 | 2 |
| 3.1 | Update Orders fetch queries | Update | `src/modules/orders/api/orders.api.ts` | High | 2.1 | 3 |
| 3.2 | Update Order transform function | Update | `src/modules/orders/utils/orderTransform.ts` | High | 3.1 | 3 |
| 4.1 | Add Person selector to CreateOrderDrawer | Update | `src/modules/orders/components/CreateOrderDrawer.tsx` | High | 2.2, 3.1 | 4 |
| 4.2 | Add Person selector to EditOrderDrawer | Update | `src/modules/orders/components/EditOrderDrawer.tsx` | High | 2.2, 3.1 | 4 |
| 5.1 | Update SortableOrdersTable columns | Update | `src/modules/orders/components/SortableOrdersTable.tsx` | High | 3.2 | 5 |
| 5.2 | Update OrdersPage search/filter | Update | `src/modules/orders/pages/OrdersPage.tsx` | Medium | 5.1 | 5 |
| 6.1 | Update CreateInvoiceDrawer for inline orders | Update | `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | High | 3.1 | 6 |
| 7.1 | Test Orders module | Verify | - | High | 4.1-5.2 | 7 |
| 7.2 | Test Invoicing integration | Verify | - | High | 6.1 | 7 |
| 7.3 | Regression testing | Verify | - | High | All | 7 |

---

## Phase 1: Database (Additive Migration)

### Task 1.1: Create Migration for person_id and person_name Fields

**Type:** CREATE  
**Priority:** High  
**Dependencies:** None  
**File:** `supabase/migrations/YYYYMMDDHHmmss_add_person_fields_to_orders.sql`

**Description:**
Add `person_id` (nullable FK to customers) and `person_name` (nullable snapshot) fields to orders table, along with index and comments.

**Acceptance Criteria:**
- [ ] Migration file created with correct timestamp
- [ ] `person_id` field added (nullable, FK to customers)
- [ ] `person_name` field added (nullable)
- [ ] Index created on `person_id`
- [ ] Column comments added
- [ ] Migration runs without errors
- [ ] Existing orders still accessible (person_id = null)

**Validation:**
- Migration runs successfully
- FK constraint works
- Index created
- Comments added

---

### Task 1.2: Validate Migration Locally

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** 1.1

**Description:**
Test migration on local Supabase instance to ensure it works correctly.

**Acceptance Criteria:**
- [ ] Migration runs without errors
- [ ] Existing orders still accessible
- [ ] New fields are nullable
- [ ] FK constraint works
- [ ] Index created successfully

**Validation:**
- Run `supabase db push`
- Verify schema changes
- Test querying orders with new fields

---

## Phase 2: Types & Schemas

### Task 2.1: Update Order TypeScript Types

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 1.1  
**File:** `src/modules/orders/types/orders.types.ts`

**Description:**
Add `person_id` and `person_name` fields to Order interface and related types.

**Acceptance Criteria:**
- [ ] `person_id: string | null` added to Order interface
- [ ] `person_name: string | null` added to Order interface
- [ ] OrderInsert type updated
- [ ] OrderUpdate type updated
- [ ] Types compile without errors

**Validation:**
- TypeScript compilation passes
- No type errors in codebase

---

### Task 2.2: Update Order Form Schema

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/orders/schemas/order.schema.ts`

**Description:**
Add `person_id` field to order form schema as optional nullable UUID.

**Acceptance Criteria:**
- [ ] `person_id` field added to schema
- [ ] Field is optional and nullable
- [ ] UUID validation works
- [ ] Existing validation still works

**Validation:**
- Schema validates correctly
- Form submission works with/without person_id

---

## Phase 3: Orders API & Queries

### Task 3.1: Update Orders Fetch Queries

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.1  
**File:** `src/modules/orders/api/orders.api.ts`

**Description:**
Update orders queries to include person_id, person_name, and join with customers table.

**Acceptance Criteria:**
- [ ] Query includes person_id and person_name
- [ ] Join with customers table works
- [ ] Null person_id handled gracefully
- [ ] Performance acceptable

**Validation:**
- Query returns correct data
- Join works correctly
- No performance degradation

---

### Task 3.2: Update Order Transform Function

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 3.1  
**File:** `src/modules/orders/utils/orderTransform.ts`

**Description:**
Update transform function to map person name to customer field and keep customer_name as deceasedName.

**Acceptance Criteria:**
- [ ] Customer field shows Person name (resolved)
- [ ] Deceased name available as separate field
- [ ] Null person_id handled (shows "—")
- [ ] Transform works for all orders

**Validation:**
- Transform produces correct UI data
- Customer column shows Person name
- Deceased name available separately

---

## Phase 4: Orders Create/Edit UI (Orders Module)

### Task 4.1: Add Person Selector to CreateOrderDrawer

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.2, 3.1  
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Description:**
Add Person selector field (optional) that allows selecting from People module.

**Acceptance Criteria:**
- [ ] Person selector appears in form
- [ ] Dropdown populated with customers
- [ ] Selection sets person_id and person_name
- [ ] Deceased Name field still works
- [ ] Field is optional

**Validation:**
- Form submission works with/without Person
- person_id and person_name set correctly
- No regressions in existing fields

---

### Task 4.2: Add Person Selector to EditOrderDrawer

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 2.2, 3.1  
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Description:**
Add Person selector field (optional) that pre-populates with existing person_id and allows changing.

**Acceptance Criteria:**
- [ ] Person selector appears in form
- [ ] Pre-populates with existing person_id
- [ ] Can change Person assignment
- [ ] Can remove Person assignment
- [ ] Deceased Name field still works

**Validation:**
- Form loads with existing Person
- Can update Person assignment
- Can remove Person assignment
- No regressions

---

## Phase 5: Orders List (Fix Customer Column)

### Task 5.1: Update SortableOrdersTable

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 3.2  
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Description:**
Update table to show Person name in "Customer" column and add/confirm "Deceased" column.

**Acceptance Criteria:**
- [ ] Customer column shows Person name
- [ ] Deceased column shows customer_name
- [ ] Sorting works correctly
- [ ] Null person_id shows "—"

**Validation:**
- Table displays correctly
- Sorting works
- Search works with Person names

---

### Task 5.2: Update OrdersPage Search/Filter

**Type:** UPDATE  
**Priority:** Medium  
**Dependencies:** 5.1  
**File:** `src/modules/orders/pages/OrdersPage.tsx`

**Description:**
Ensure search works with Person names and filtering remains functional.

**Acceptance Criteria:**
- [ ] Search finds orders by Person name
- [ ] Filtering works correctly
- [ ] No performance issues

**Validation:**
- Search functionality works
- Filtering works
- Performance acceptable

---

## Phase 6: Invoicing Module Integration

### Task 6.1: Update CreateInvoiceDrawer for Inline Orders

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** 3.1  
**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Description:**
When creating inline orders, if invoice has Person selected (via customer_name), look up person_id and set it on orders.

**Acceptance Criteria:**
- [ ] Inline orders inherit Person from invoice
- [ ] person_id and person_name set correctly
- [ ] Works when invoice has no Person
- [ ] Existing invoice flows unchanged

**Validation:**
- Inline orders have correct person_id
- Works with/without invoice Person
- No regressions

---

## Phase 7: Testing & Validation

### Task 7.1: Test Orders Module

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** 4.1-5.2

**Description:**
Test all Orders module functionality related to Person assignment.

**Test Scenarios:**
- [ ] Create order with Person → appears correctly
- [ ] Create order without Person → shows "—"
- [ ] Edit order to add Person → works
- [ ] Edit order to change Person → works
- [ ] Edit order to remove Person → works
- [ ] Orders list shows Person name in Customer column
- [ ] Deceased name shown separately
- [ ] Search works with Person names
- [ ] Sorting works correctly

**Validation:**
- All scenarios pass
- No console errors
- UI renders correctly

---

### Task 7.2: Test Invoicing Integration

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** 6.1

**Description:**
Test Invoicing module integration with Person assignment.

**Test Scenarios:**
- [ ] Create invoice with Person → inline orders inherit Person
- [ ] Create invoice without Person → inline orders have null person_id
- [ ] Existing invoice flows unchanged
- [ ] Invoice creation works correctly

**Validation:**
- All scenarios pass
- No regressions

---

### Task 7.3: Regression Testing

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Test all modules that interact with Orders to ensure no regressions.

**Modules to Test:**
- [ ] Map module (orders display)
- [ ] Jobs module (order references)
- [ ] Worker assignments
- [ ] Other order-dependent features

**Validation:**
- No regressions in any module
- Build passes
- Lint passes
- All existing functionality works

---

## Progress Tracking

### Phase 1: Database (Additive Migration)
- [X] Task 1.1: Create migration
- [X] Task 1.2: Validate migration

### Phase 2: Types & Schemas
- [X] Task 2.1: Update Order types
- [X] Task 2.2: Update Order schema

### Phase 3: Orders API & Queries
- [X] Task 3.1: Update Orders queries
- [X] Task 3.2: Update Order transform

### Phase 4: Orders Create/Edit UI
- [X] Task 4.1: Add Person selector to CreateOrderDrawer
- [X] Task 4.2: Add Person selector to EditOrderDrawer

### Phase 5: Orders List
- [X] Task 5.1: Update SortableOrdersTable
- [X] Task 5.2: Update OrdersPage search/filter

### Phase 6: Invoicing Integration
- [X] Task 6.1: Update CreateInvoiceDrawer

### Phase 7: Testing & Validation
- [X] Task 7.1: Test Orders module
- [X] Task 7.2: Test Invoicing integration
- [X] Task 7.3: Regression testing

---

## Notes

- All tasks are additive (no breaking changes)
- Backward compatibility must be maintained
- Existing orders will have null person_id (expected)
- All new fields are optional/nullable

