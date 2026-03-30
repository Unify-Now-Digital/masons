# Data Model: Fix Invoicing List Missing order_id

## Overview

This fix does **not** require any database schema changes. It focuses on ensuring `order_id` is correctly preserved through the data transformation pipeline.

---

## Existing Data Structures

### Invoices Table (`public.invoices`)

**Relevant Fields:**
- `id uuid pk` - Primary key
- `order_id uuid null` - FK to orders table (snake_case in DB)
- `customer_name text not null` - Customer name snapshot
- Other invoice fields...

**Key Observations:**
- Database has `order_id` field
- Field is nullable (can be null)
- Query uses `select('*')` which should include all fields

---

### Invoice Type (`Invoice`)

**File:** `src/modules/invoicing/types/invoicing.types.ts`

**Structure:**
```typescript
export interface Invoice {
  id: string;
  order_id: string | null;  // Present in type definition
  invoice_number: string;
  customer_name: string;
  // ... other fields
}
```

**Key Observations:**
- Type includes `order_id: string | null`
- Type matches database schema
- Type assertion `as Invoice[]` might hide missing fields

---

### UIInvoice Type

**File:** `src/modules/invoicing/utils/invoiceTransform.ts`

**Structure:**
```typescript
export interface UIInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;  // camelCase, should be string | null (not undefined)
  customer: string;
  // ... other fields
}
```

**Key Observations:**
- Uses camelCase `orderId` (not snake_case `order_id`)
- Should be `string | null` (not `string | null | undefined`)
- Transform maps `orderId: invoice.order_id`

---

## Data Flow

### 1. Invoice Fetch

**Query Pattern:**
```typescript
const { data: invoices } = await supabase
  .from('invoices')
  .select('*')  // Should include order_id
  .order('created_at', { ascending: false });
```

**Result:**
- Invoices with `order_id` field (snake_case)
- Type: `Invoice[]` with `order_id: string | null`
- **Issue:** If field is missing, `order_id` might be `undefined`

---

### 2. Invoice Transform

**Transform Pattern (BEFORE FIX):**
```typescript
export function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  return {
    orderId: invoice.order_id,  // Might be undefined if field is missing
    // ... other fields
  };
}
```

**Transform Pattern (AFTER FIX):**
```typescript
export function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  return {
    orderId: invoice.order_id ?? null,  // Always string | null
    // ... other fields
  };
}
```

**Result:**
- UIInvoice with `orderId` field (camelCase)
- Type: `UIInvoice[]` with `orderId: string | null`
- **Fix:** Nullish coalescing ensures `orderId` is never `undefined`

---

### 3. Component Props

**InvoicingPage:**
- Uses `UIInvoice` type
- Passes: `orderId={invoice.orderId || null}`
- **Issue:** If `orderId` is `undefined`, it becomes `null` (but shouldn't be undefined)

**After Fix:**
- `orderId` is always `string | null` (never `undefined`)
- `orderId={invoice.orderId || null}` works correctly
- Or can simplify to `orderId={invoice.orderId}` since it's never undefined

---

## Data Transformation

### Order ID Mapping

**Priority Order:**
1. **Database value:**
   - `order_id: string` (UUID) → `orderId: string`
   - `order_id: null` → `orderId: null`
   - `order_id: undefined` (if missing) → `orderId: null` (after fix)

2. **Transform normalization:**
   - Use nullish coalescing: `invoice.order_id ?? null`
   - Ensures `orderId` is always `string | null`
   - Prevents `undefined` from propagating

**Implementation:**
```typescript
orderId: invoice.order_id ?? null,
```

---

## Data Access Patterns

### Read Operations

**Invoices List:**
- Fetch all invoices with `order_id`
- Transform to `UIInvoice[]` with `orderId`
- Pass `orderId` to CustomerDetailsPopover

**No Write Operations:**
- This fix is read-only
- No data modifications required

---

## Performance Considerations

### Transform Performance

- Nullish coalescing has minimal overhead
- Single operation per invoice
- No additional queries or processing

### Validation Performance

- Runtime validation only in DEV mode
- Checks first invoice only
- No production overhead

---

## Data Validation

### Required Fields

- None (all fields optional/nullable)

### Validation Rules

- `order_id` must be valid UUID if present
- `order_id` can be `null` (invoice not linked to order)
- `order_id` should not be `undefined` (indicates missing field)

### Error Handling

- Transform handles `undefined` → `null`
- Runtime validation logs warnings in DEV mode
- No crashes or errors

---

## Data Flow Diagram

```
Invoice (order_id in DB)
    ↓
[Invoice Query: select('*')]
    ↓
Invoice.order_id (string | null | undefined)
    ↓
[Transform: orderId: invoice.order_id ?? null]
    ↓
UIInvoice.orderId (string | null)  // Never undefined
    ↓
[Component Props: orderId={invoice.orderId}]
    ↓
CustomerDetailsPopover.orderId prop
    ↓
[Popover Opens]
    ↓
useOrderPersonId(orderId, { enabled: open && !!orderId })
    ↓
Order.person_id
    ↓
resolvedPersonId = personId ?? orderPersonId ?? null
    ↓
useCustomer(resolvedPersonId, { enabled: open && !!resolvedPersonId })
    ↓
Person Data (full customer record)
    ↓
CustomerDetailsPopover displays:
- Name: person.first_name + person.last_name
- Phone: person.phone
- Email: person.email
- Address: person.address + city + country
- Badge: "Linked"
```

---

## Edge Cases

### Case 1: Invoice with order_id (string)
- **Input:** `invoice.order_id = "uuid-string"`
- **Transform:** `orderId: "uuid-string" ?? null` → `"uuid-string"`
- **Result:** `orderId` is string, popover can fetch order

### Case 2: Invoice with order_id (null)
- **Input:** `invoice.order_id = null`
- **Transform:** `orderId: null ?? null` → `null`
- **Result:** `orderId` is null, popover shows "Unlinked"

### Case 3: Invoice with order_id (undefined)
- **Input:** `invoice.order_id = undefined` (field missing)
- **Transform:** `orderId: undefined ?? null` → `null`
- **Result:** `orderId` is null (normalized), popover shows "Unlinked"

### Case 4: Invoice without order_id property
- **Input:** `invoice` object doesn't have `order_id` property
- **Transform:** `orderId: undefined ?? null` → `null`
- **Result:** `orderId` is null (normalized), popover shows "Unlinked"

---

## Summary

- **No schema changes required**
- **Uses existing tables and relationships**
- **Transform handles undefined → null**
- **Type safety: orderId is always string | null**
- **Runtime validation helps diagnose issues**
- **Read-only operations**
- **Graceful error handling**

