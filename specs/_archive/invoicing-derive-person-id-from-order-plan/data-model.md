# Data Model: Invoicing - Derive person_id from Linked Order

## Overview

This feature does **not** require any database schema changes. It uses existing data structures and relationships to derive person_id from linked orders.

---

## Existing Data Structures

### Invoices Table (`public.invoices`)

**Relevant Fields:**
- `id uuid pk` - Primary key
- `order_id uuid null` - FK to orders table (optional)
- `customer_name text not null` - Customer name snapshot
- Other invoice fields...

**Key Observations:**
- `order_id` links to orders table
- No direct `person_id` field
- Currently used in Invoicing popover as `orderId` prop

---

### Orders Table (`public.orders`)

**Relevant Fields:**
- `id uuid pk` - Primary key
- `person_id uuid null` - FK to customers/people table
- `person_name text null` - Snapshot of person name
- `customer_name text not null` - Deceased name
- Other order fields...

**Key Observations:**
- Orders have `person_id` field
- Can be fetched via lightweight query (select only person_id)
- Used to derive person_id for invoices

---

### Customers Table (`public.customers`)

**Relevant Fields:**
- `id uuid pk` - Primary key
- `first_name text not null` - First name
- `last_name text not null` - Last name
- `email text null` - Email address
- `phone text null` - Phone number
- `address text null` - Street address
- `city text null` - City
- `country text null` - Country
- Other customer fields...

**Key Observations:**
- Same structure as used in Orders module
- Existing `useCustomer` hook can be reused
- Full customer data fetched when person_id available

---

## Data Flow

### 1. Invoices List Fetch

**Query Pattern:**
```typescript
const { data: invoices } = await supabase
  .from('invoices')
  .select('*')
  .order('created_at', { ascending: false });
```

**Result:**
- Invoices with `order_id` field
- No order/person joins (for performance)

---

### 2. Order Person ID Fetch (Lazy)

**Query Pattern:**
```typescript
const { data } = await supabase
  .from('orders')
  .select('person_id')
  .eq('id', orderId)
  .single();
```

**When:**
- Only when popover opens AND `orderId` exists
- Enabled via React Query: `enabled: open && !!orderId`

**Result:**
- `person_id` string or null
- Cached by React Query for subsequent opens

---

### 3. Customer Details Fetch (Lazy)

**Query Pattern:**
```typescript
const { data: customer } = await supabase
  .from('customers')
  .select('*')
  .eq('id', personId)
  .single();
```

**When:**
- Only when popover opens AND `resolvedPersonId` exists
- Enabled via React Query: `enabled: open && !!resolvedPersonId`

**Result:**
- Full customer record with all fields
- Cached by React Query for subsequent opens

---

## Data Transformation

### Person ID Resolution

**Priority Order:**
1. **Explicit personId prop:**
   - From `CustomerDetailsPopover` `personId` prop
   - Used in Orders module

2. **Derived from orderId:**
   - From `useOrderPersonId(orderId)` hook
   - Used in Invoicing module
   - Only when `orderId` provided and order has `person_id`

3. **Fallback:**
   - null (no person_id available)

**Implementation:**
```typescript
const resolvedPersonId = personId ?? orderPersonId ?? null;
```

---

## Data Access Patterns

### Read Operations

**Invoices List:**
- Fetch all invoices with order_id
- Pass order_id to CustomerDetailsPopover as `orderId` prop

**Order Person ID (Lazy):**
- Fetch only when popover opens
- Use lightweight query (select person_id only)
- Cache by orderId

**Customer Details (Lazy):**
- Fetch only when popover opens AND resolvedPersonId exists
- Use existing `useCustomer` hook
- Cache by personId

### No Write Operations

This feature is read-only. No data modifications required.

---

## Performance Considerations

### Lazy Loading

- Order person_id fetched only when popover opens
- Person data fetched only after order.person_id resolved
- No prefetching for all invoices
- Reduces initial load time

### Caching

- React Query caches order person_id by orderId
- React Query caches customer data by personId
- Multiple invoices with same order_id share cached person_id
- Multiple invoices with same person_id share cached customer data
- Reduces redundant API calls

### Query Optimization

- Order query selects only `person_id` (minimal)
- No joins or over-fetching
- Efficient and performant

---

## Data Validation

### Required Fields

- None (all fields optional/nullable)

### Validation Rules

- `order_id` must be valid UUID if present
- `order_id` must reference existing order if present
- `person_id` must be valid UUID if present
- `person_id` must reference existing customer if present

### Error Handling

- If order fetch fails, return null (fallback to "Unlinked")
- If order not found, return null (fallback to "Unlinked")
- If order has no person_id, use null (fallback to "Unlinked")
- If person fetch fails, use fallback data (show "Unlinked")
- Display "—" for missing fields

---

## Data Flow Diagram

```
Invoice (order_id)
    ↓
[Popover Opens]
    ↓
useOrderPersonId(orderId, { enabled: open })
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

### Case 1: Invoice with order_id, order has person_id
- **Result:** Full People info displayed, "Linked" badge
- **Queries:** Order person_id → Person data

### Case 2: Invoice with order_id, order has no person_id
- **Result:** Customer name only, "Unlinked" badge
- **Queries:** Order person_id (returns null) → No person query

### Case 3: Invoice with no order_id
- **Result:** Customer name only, "Unlinked" badge
- **Queries:** None (orderId is null)

### Case 4: Order fetch fails
- **Result:** Fallback to "Unlinked", customer name only
- **Queries:** Order person_id (fails) → No person query

### Case 5: Person fetch fails
- **Result:** Fallback to snapshot fields, "Unlinked" badge
- **Queries:** Order person_id → Person data (fails)

---

## Future Considerations

### Potential Enhancements

1. **Direct person_id in invoices:**
   - Add `person_id` field directly to invoices table
   - Eliminate need for order lookup
   - Direct relationship to customers table

2. **Multiple orders per invoice:**
   - Currently using `invoice.order_id` (single reference)
   - If invoices support multiple orders, may need different strategy
   - Could use first order with person_id, or aggregate strategy

3. **Invoice snapshot fields:**
   - Add `customer_phone` and `customer_email` to invoices table
   - Provide fallback data even when no person_id
   - Reduce dependency on order lookup

---

## Summary

- **No schema changes required**
- **Uses existing tables and relationships**
- **Lazy loading for performance**
- **Two-step fetch: order → person**
- **Caching optimizes repeated opens**
- **Read-only operations**
- **Graceful error handling**

