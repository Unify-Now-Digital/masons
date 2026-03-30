# Refactor Invoice creation to be order-centric with inline Orders (UI-only)

## Overview

Invoices are the financial spine of the application. Currently, an Invoice is created first, and Orders are added afterward. This causes fragmented data entry and incorrect financial flow.

This feature refactors the Invoice creation UI so Orders are created inline, and the Invoice amount is derived from those Orders.

**Context:**
- Invoices are the financial spine of the application
- Current flow: Invoice created first, Orders added afterward
- Problem: Fragmented data entry and incorrect financial flow
- Solution: Create Orders inline during Invoice creation

**Goal:**
- Modify Invoice creation form to support inline Order creation
- Calculate Invoice amount live from Orders (client-side)
- Select Person from People module (not free-text)
- Remove manual Order selection

---

## Current State Analysis

### Invoice Creation Form

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Current Structure:**
- Order Selection: Dropdown to select existing Order (optional)
- Person Information: Free-text "Person Name" input
- Invoice Details: Manual "Amount ($)" input (required)
- Status: Dropdown (draft, pending, paid, overdue, cancelled)
- Dates: Issue Date, Due Date
- Payment Information: Payment Method, Payment Date
- Notes: Textarea

**Current Flow:**
1. User creates Invoice with manual amount
2. User optionally selects existing Order
3. User enters Person name as free text
4. Invoice is created
5. Orders are added separately afterward

**Problems:**
- Fragmented data entry (Invoice and Orders created separately)
- Manual amount entry can be incorrect
- Person name is free-text (no validation or consistency)
- Order selection is optional and manual

### Invoice Schema

**File:** `src/modules/invoicing/schemas/invoice.schema.ts`

**Current Fields:**
- `order_id`: UUID (optional, nullable)
- `customer_name`: string (required)
- `amount`: number (required, min 0.01)
- `status`: enum (draft, pending, paid, overdue, cancelled)
- `due_date`: string (required)
- `issue_date`: string (optional)
- `payment_method`: string (optional, nullable)
- `payment_date`: string (optional, nullable)
- `notes`: string (optional, nullable)

### Order Creation Form

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Current Structure:**
- Order Type: Dropdown (New Memorial, Renovation)
- Deceased & Location: Deceased Name, Location, Grave Number
- Coordinates: Latitude, Longitude (optional)
- Product Selection: Dropdown to select product
- Product Details: Stone Type, Stone Color, Dimensions, Price
- Notes: Textarea

**Key Fields:**
- `customer_name`: string (required) - Deceased name
- `order_type`: enum (New Memorial, Renovation)
- `sku`: string (required) - Grave number
- `location`: string (required)
- `latitude`: number | null (optional)
- `longitude`: number | null (optional)
- `material`: string | null
- `color`: string | null
- `value`: number | null - Order price/value
- `notes`: string | null
- `invoice_id`: string | null - Links Order to Invoice

### People Module

**File:** `src/modules/customers/hooks/useCustomers.ts`

**Customer Interface:**
- `id`: string
- `first_name`: string
- `last_name`: string
- `email`: string | null
- `phone`: string | null
- `address`: string | null
- `city`: string | null
- `country`: string | null

**Available Hooks:**
- `useCustomersList()`: Fetches all customers/people
- `useCustomer(id)`: Fetches single customer/person

---

## Requirements

### Functional Requirements

1. **Inline Order Creation**
   - Remove "Order (Optional)" dropdown field
   - Add "Orders" section inside Invoice creation form
   - Allow creating multiple Orders inline
   - Each Order uses simplified Order form (same as CreateOrderDrawer)
   - Orders are created when Invoice is submitted

2. **Invoice Amount Calculation**
   - Remove manual "Amount ($)" input field
   - Calculate amount as live sum of all Orders' `value` fields
   - Display calculated amount as read-only
   - Store calculated amount in existing `amount` column
   - Amount updates automatically as Orders are added/edited/removed

3. **Person Selection**
   - Replace free-text "Person Name" input with dropdown selector
   - Fetch people from People module (`useCustomersList()`)
   - Display format: `{first_name} {last_name}`
   - Store selected person's full name as snapshot in `customer_name`
   - Do NOT add `person_id` column (UI-only change)

4. **Form Submission Flow**
   - On submit:
     1. Create Invoice first (with calculated amount)
     2. Create all Orders linked via `invoice_id`
   - Handle errors: If Invoice creation fails, don't create Orders
   - Handle errors: If any Order creation fails, show error but keep Invoice

5. **Payment Fields**
   - Keep Payment Method dropdown unchanged
   - Keep Payment Date input unchanged

### Technical Requirements

1. **UI-Only Changes**
   - NO database schema changes
   - NO migrations
   - NO backend API changes
   - NO server-side calculations
   - Existing Invoice and Orders tables remain unchanged

2. **State Management**
   - Manage inline Orders in component state
   - Track Orders array with add/edit/remove operations
   - Calculate Invoice amount reactively from Orders
   - Validate Orders before submission

3. **Order Form Integration**
   - Reuse Order form fields from `CreateOrderDrawer`
   - Use same validation schema (`orderFormSchema`)
   - Support multiple Orders in single Invoice
   - Each Order can be edited inline before submission

4. **Error Handling**
   - Validate at least one Order exists before submission
   - Show validation errors for each Order
   - Handle API errors gracefully
   - Provide clear error messages

---

## Implementation Plan

### Phase 1: Update Invoice Form Schema

**File:** `src/modules/invoicing/schemas/invoice.schema.ts`

**Changes:**
- Remove `order_id` field (no longer needed)
- Keep `customer_name` field (will be populated from Person selector)
- Make `amount` optional in schema (will be calculated, not user input)
- Add validation: At least one Order required (client-side check)

### Phase 2: Update CreateInvoiceDrawer Component

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Changes:**

1. **Remove Fields:**
   - Remove "Order (Optional)" dropdown
   - Remove manual "Amount ($)" input

2. **Add Person Selector:**
   - Import `useCustomersList()` from People module
   - Replace free-text "Person Name" with Select dropdown
   - Display format: `{first_name} {last_name}`
   - Store full name in `customer_name` field

3. **Add Orders Section:**
   - Add state for Orders array
   - Add "Add Order" button
   - Render Order form fields inline for each Order
   - Support add/edit/remove Orders
   - Use same form fields as `CreateOrderDrawer` (simplified)

4. **Add Amount Display:**
   - Calculate amount from Orders: `sum(orders.map(o => o.value ?? 0))`
   - Display as read-only field
   - Update live as Orders change

5. **Update Form Submission:**
   - Validate at least one Order exists
   - Calculate final amount
   - Create Invoice first
   - Create all Orders with `invoice_id` set to created Invoice ID
   - Handle errors appropriately

### Phase 3: Order Form Fields (Inline)

**Reuse from CreateOrderDrawer:**
- Order Type: Dropdown (New Memorial, Renovation)
- Deceased Name: Input (required)
- Location: Input (required)
- Grave Number (SKU): Input (required)
- Coordinates: Latitude, Longitude (optional)
- Product Selection: Dropdown (optional)
- Product Details: Stone Type, Stone Color, Dimensions, Price
- Notes: Textarea (optional)

**Simplifications:**
- Remove `invoice_id` from form (set after Invoice creation)
- Remove Person fields (Person selected at Invoice level)
- Keep all other fields as-is

---

## Success Criteria

- ✅ Invoice creation form supports inline Order creation
- ✅ Multiple Orders can be added to single Invoice
- ✅ Invoice amount updates live from Orders
- ✅ Amount is calculated as sum of Orders' `value` fields
- ✅ Person is selected from People module dropdown
- ✅ Person name is stored as snapshot in `customer_name`
- ✅ Invoice and Orders are created successfully in one flow
- ✅ Orders are linked to Invoice via `invoice_id`
- ✅ Existing Invoices remain unchanged
- ✅ No database schema changes
- ✅ No runtime or TypeScript errors
- ✅ Form validation works correctly
- ✅ Error handling is graceful

---

## Out of Scope

- Database schema changes
- Removing legacy invoice fields
- Order edit form changes
- Jobs module changes
- Payments logic changes
- Reporting changes
- Transactions or rollback logic
- Server-side calculations
- Automatic geocoding
- Map integration

---

## Technical Notes

1. **Amount Calculation:**
   - Client-side calculation: `orders.reduce((sum, order) => sum + (order.value ?? 0), 0)`
   - Update on every Order add/edit/remove
   - Store calculated value in `amount` field

2. **Person Selection:**
   - Use `useCustomersList()` to fetch people
   - Display: `{first_name} {last_name}`
   - Store: `{first_name} {last_name}` in `customer_name`
   - No `person_id` column (UI-only change)

3. **Order Creation:**
   - Create Invoice first to get `invoice_id`
   - Create Orders with `invoice_id` set
   - Handle errors: If Invoice fails, don't create Orders
   - Handle errors: If Order fails, show error but keep Invoice

4. **Form State:**
   - Manage Orders array in component state
   - Each Order has its own form state
   - Validate all Orders before submission
   - Calculate amount reactively

5. **Validation:**
   - At least one Order required
   - Each Order must be valid (use `orderFormSchema`)
   - Invoice must have valid Person selected
   - Invoice must have valid dates

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/invoicing/schemas/invoice.schema.ts` | Remove `order_id`, make `amount` optional | ~5 lines modified |
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | Major refactor: add Orders section, Person selector, amount calculation | ~200 lines modified |

**Total Estimated Changes:** ~205 lines across 2 files

---

## Testing Considerations

1. **Unit Tests:**
   - Amount calculation logic
   - Order validation
   - Form submission flow

2. **Integration Tests:**
   - Invoice creation with multiple Orders
   - Error handling (Invoice fails, Order fails)
   - Person selection and storage

3. **Manual Testing:**
   - Create Invoice with 0 Orders (should fail)
   - Create Invoice with 1 Order
   - Create Invoice with multiple Orders
   - Edit Orders inline
   - Remove Orders
   - Verify amount updates live
   - Verify Person selection works
   - Verify Orders are linked to Invoice

---

## Future Enhancements (Out of Scope)

- Order templates
- Bulk Order import
- Order duplication
- Order validation rules
- Person creation from Invoice form
- Automatic amount calculations (tax, discounts)
- Order status tracking
- Order history

---

## Related Features

- **Orders CRUD Integration:** Existing Order creation and management
- **People Module:** Customer/Person management
- **Invoice-Centric Order Creation:** Previous feature that added `invoice_id` to Orders
- **Simplified Order Creation Form:** Recent refactor of Order form to be invoice-centric

---

## Implementation Notes

1. **Reuse Existing Code:**
   - Reuse Order form fields from `CreateOrderDrawer`
   - Reuse Order validation schema
   - Reuse People module hooks

2. **State Management:**
   - Use React state for Orders array
   - Use React Hook Form for Invoice form
   - Use separate form state for each Order (or single form with array)

3. **Error Handling:**
   - Validate Orders before submission
   - Handle API errors gracefully
   - Provide clear error messages
   - Don't create Orders if Invoice creation fails

4. **Performance:**
   - Calculate amount efficiently (useMemo)
   - Minimize re-renders
   - Optimize form validation

---

## Questions and Clarifications

1. **Order Form Fields:**
   - Should all Order fields be available inline, or simplified?
   - **Answer:** Use same fields as `CreateOrderDrawer` (simplified version)

2. **Person Selection:**
   - Should we allow creating new Person from Invoice form?
   - **Answer:** No, out of scope (select from existing People only)

3. **Amount Calculation:**
   - Should we support discounts or taxes?
   - **Answer:** No, out of scope (simple sum of Order values)

4. **Error Handling:**
   - What happens if Invoice creation succeeds but Order creation fails?
   - **Answer:** Show error message, Invoice remains created (user can add Orders later)

5. **Order Editing:**
   - Can Orders be edited after Invoice creation?
   - **Answer:** Out of scope (this is Invoice creation only, not edit)

---

## Conclusion

This feature refactors Invoice creation to be order-centric, allowing inline Order creation and automatic amount calculation. The implementation is UI-only, requiring no database changes, and maintains backward compatibility with existing Invoices.

