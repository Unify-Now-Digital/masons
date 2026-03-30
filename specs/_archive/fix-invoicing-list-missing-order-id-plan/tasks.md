# Tasks: Fix Invoicing List Missing order_id

## Task Summary

| # | Task | Type | File | Priority | Dependencies | Phase |
|---|------|------|------|----------|--------------|-------|
| 1.1 | Update transformInvoiceForUI to handle undefined | Update | `src/modules/invoicing/utils/invoiceTransform.ts` | High | None | 1 |
| 1.2 | Verify UIInvoice type | Verify | `src/modules/invoicing/utils/invoiceTransform.ts` | Medium | 1.1 | 1 |
| 2.1 | Verify query returns order_id | Verify | `src/modules/invoicing/api/invoicing.api.ts` | High | None | 2 |
| 2.2 | Add runtime validation (DEV only) | Create | `src/modules/invoicing/utils/invoiceTransform.ts` or `src/modules/invoicing/pages/InvoicingPage.tsx` | Medium | 2.1 | 2 |
| 3.1 | Test transform with various inputs | Verify | - | High | All | 3 |
| 3.2 | Test with invoice that has order_id | Verify | - | High | All | 3 |
| 3.3 | Test with invoice without order_id | Verify | - | Medium | All | 3 |
| 3.4 | Build & lint validation | Verify | - | High | All | 3 |

---

## Phase 1: Fix Invoice Transform (Primary Fix)

### Task 1.1: Update transformInvoiceForUI to Handle Undefined

**Type:** UPDATE  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Description:**
Update the transform function to defensively handle `undefined` for `order_id` using nullish coalescing.

**Current State:**
```typescript
orderId: invoice.order_id,  // Might be undefined if field is missing
```

**Changes:**
```typescript
orderId: invoice.order_id ?? null,  // Always string | null, never undefined
```

**Acceptance Criteria:**
- [ ] Transform uses nullish coalescing: `invoice.order_id ?? null`
- [ ] `orderId` is always `string | null` (never `undefined`)
- [ ] Type matches UIInvoice interface

**Validation:**
- Transform handles `undefined` correctly
- `orderId` is always `string | null`
- Type matches UIInvoice interface

---

### Task 1.2: Verify UIInvoice Type

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** 1.1  
**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Description:**
Verify UIInvoice type ensures `orderId` is `string | null` (not `string | null | undefined`).

**Current State:**
```typescript
export interface UIInvoice {
  orderId: string | null;  // Should be correct
  // ... other fields
}
```

**Acceptance Criteria:**
- [ ] Type is `string | null` (not including `undefined`)
- [ ] No `undefined` in type definition
- [ ] Add comment if needed to clarify nullish coalescing

**Validation:**
- Type is correct
- No `undefined` in type definition

---

## Phase 2: Verify Invoice List Query (Safety Net)

### Task 2.1: Verify Query Returns order_id

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None  
**File:** `src/modules/invoicing/api/invoicing.api.ts`

**Description:**
Verify that `fetchInvoices` query actually returns `order_id` field.

**Current State:**
```typescript
export async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')  // Should include order_id
    .order('created_at', { ascending: false});
  
  if (error) throw error;
  return data as Invoice[];
}
```

**Changes:**
- If `select('*')` doesn't work, switch to explicit select
- Add explicit `order_id` to select list
- Or verify `select('*')` actually includes `order_id`

**Acceptance Criteria:**
- [ ] Query includes `order_id` field
- [ ] Response contains `order_id` for invoices that have it
- [ ] No view/RPC strips `order_id`

**Validation:**
- Query includes `order_id` field
- Response contains `order_id` for invoices that have it

---

### Task 2.2: Add Runtime Validation (DEV only)

**Type:** CREATE  
**Priority:** Medium  
**Dependencies:** 2.1  
**Files:** `src/modules/invoicing/utils/invoiceTransform.ts` or `src/modules/invoicing/pages/InvoicingPage.tsx`

**Description:**
Add DEV-only runtime validation to log if `order_id` is missing from invoice data.

**Changes:**
```typescript
// In transformInvoicesForUI or InvoicingPage
if (import.meta.env.DEV && invoicesData && invoicesData.length > 0) {
  const firstInvoice = invoicesData[0];
  if (!('order_id' in firstInvoice)) {
    console.warn('[Invoicing] order_id missing from invoice data:', firstInvoice);
  }
  if (firstInvoice.order_id === undefined) {
    console.warn('[Invoicing] order_id is undefined (should be null or string):', firstInvoice);
  }
}
```

**Acceptance Criteria:**
- [ ] Validation only runs in DEV mode
- [ ] Logs warning if `order_id` is missing
- [ ] Logs warning if `order_id` is undefined
- [ ] Helps diagnose query vs transform issues

**Validation:**
- Validation only runs in DEV mode
- Logs warnings correctly
- Helps diagnose issues

---

## Phase 3: Testing & Validation

### Task 3.1: Test Transform with Various Inputs

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Test transform function with different `order_id` values.

**Test Scenarios:**
- [ ] Invoice with `order_id: string` → `orderId` should be string
- [ ] Invoice with `order_id: null` → `orderId` should be null
- [ ] Invoice with `order_id: undefined` → `orderId` should be null (not undefined)
- [ ] Invoice without `order_id` property → `orderId` should be null

**Validation:**
- All scenarios handled correctly
- `orderId` is never `undefined`

---

### Task 3.2: Test with Invoice That Has order_id

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Test Invoicing popover with invoice that has `order_id` linked to order with person_id.

**Test Scenarios:**
- [ ] Open invoice popover
- [ ] Verify DEV debug shows non-null orderId
- [ ] Verify order query fires (check Network tab)
- [ ] Verify "Linked" badge shows
- [ ] Verify full customer details appear

**Validation:**
- Popover shows "Linked" when invoice has order_id with person_id
- Full customer details displayed

---

### Task 3.3: Test with Invoice Without order_id

**Type:** VERIFY  
**Priority:** Medium  
**Dependencies:** All

**Description:**
Test Invoicing popover with invoice that has no `order_id`.

**Test Scenarios:**
- [ ] Open invoice popover
- [ ] Verify DEV debug shows null orderId (not undefined)
- [ ] Verify "Unlinked" badge shows
- [ ] Verify no unnecessary queries

**Validation:**
- Popover shows "Unlinked" correctly
- No errors or crashes

---

### Task 3.4: Build & Lint Validation

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** All

**Description:**
Verify build and lint pass.

**Acceptance Criteria:**
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] No TypeScript errors
- [ ] No console warnings (except DEV validation logs)

**Validation:**
- Build successful
- Lint passes
- No errors or warnings

---

## Progress Tracking

### Phase 1: Fix Invoice Transform (Primary Fix)
- [X] Task 1.1: Update transformInvoiceForUI to handle undefined
- [X] Task 1.2: Verify UIInvoice type

### Phase 2: Verify Invoice List Query (Safety Net)
- [X] Task 2.1: Verify query returns order_id
- [X] Task 2.2: Add runtime validation (DEV only)

### Phase 3: Testing & Validation
- [ ] Task 3.1: Test transform with various inputs (manual testing required)
- [ ] Task 3.2: Test with invoice that has order_id (manual testing required)
- [ ] Task 3.3: Test with invoice without order_id (manual testing required)
- [X] Task 3.4: Build & lint validation

---

## Notes

- All changes are backward compatible
- No database or schema changes
- Transform handles undefined → null
- Runtime validation only in DEV mode
- No regressions in existing functionality
- Focus on transform fix (primary issue)

