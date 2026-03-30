# Data Model: Orders Customer Details Popover

## Overview

This feature does **not** require any database schema changes. It uses existing data structures and relationships.

---

## Existing Data Structures

### Orders Table (`public.orders`)

**Relevant Fields:**
- `person_id uuid null` - Foreign key to customers/people table
- `person_name text null` - Snapshot of person name at time of order creation
- `customer_name text not null` - Deceased name (legacy field, also used as fallback)
- `customer_email text null` - Snapshot email
- `customer_phone text null` - Snapshot phone

**Relationships:**
- `person_id` → `customers.id` (optional FK, ON DELETE SET NULL)

**Indexes:**
- `idx_orders_person_id` on `person_id` (for performance)

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
- `created_at timestamptz` - Creation timestamp
- `updated_at timestamptz` - Update timestamp

**Note:** No `notes` field exists in current schema.

---

## Data Flow

### 1. Orders List Fetch

**Query Pattern:**
```typescript
const { data: orders } = await supabase
  .from('orders')
  .select('*, customers(id, first_name, last_name)')
  .order('created_at', { ascending: false });
```

**Result:**
- Orders with basic customer join (first_name, last_name only)
- Full customer details not fetched until needed

---

### 2. Customer Details Fetch (Lazy)

**Query Pattern:**
```typescript
const { data: customer } = await supabase
  .from('customers')
  .select('*')
  .eq('id', personId)
  .single();
```

**When:**
- Only when popover opens AND `person_id` exists
- Enabled via React Query: `enabled: open && !!personId`

**Result:**
- Full customer record with all fields
- Cached by React Query for subsequent opens

---

## Data Transformation

### UIOrder Interface

**New Fields Added:**
```typescript
export interface UIOrder {
  // ... existing fields
  personId?: string | null;        // From orders.person_id
  fallbackPhone?: string | null;   // From orders.customer_phone
  fallbackEmail?: string | null;   // From orders.customer_email
}
```

**Transformation:**
```typescript
export function transformOrderForUI(order: Order): UIOrder {
  return {
    // ... existing fields
    personId: order.person_id,
    fallbackPhone: order.customer_phone,
    fallbackEmail: order.customer_email,
  };
}
```

---

## Fallback Strategy

### Priority Order

1. **Person Data (via person_id):**
   - Name: `${person.first_name} ${person.last_name}`
   - Phone: `person.phone`
   - Email: `person.email`
   - Address: `${person.address}, ${person.city}, ${person.country}`

2. **Snapshot Fields (from orders table):**
   - Name: `order.customer_name` (or `order.person_name`)
   - Phone: `order.customer_phone`
   - Email: `order.customer_email`

3. **Default:**
   - Show "—" for missing fields

---

## Data Access Patterns

### Read Operations

**Orders List:**
- Fetch all orders with basic customer join
- Transform to UIOrder format
- Include personId and fallback fields

**Customer Details (Lazy):**
- Fetch only when popover opens
- Use React Query caching
- Enable query conditionally

### No Write Operations

This feature is read-only. No data modifications required.

---

## Performance Considerations

### Lazy Loading

- Customer data fetched only when popover opens
- No prefetching for all orders
- Reduces initial load time

### Caching

- React Query caches customer data by ID
- Multiple orders with same person_id share cached data
- Reduces redundant API calls

### Query Optimization

- Orders list query only joins basic customer fields
- Full customer details fetched separately when needed
- Prevents over-fetching

---

## Data Validation

### Required Fields

- None (all fields optional/nullable)

### Validation Rules

- `person_id` must be valid UUID if present
- `person_id` must reference existing customer if present
- Fallback fields can be null/empty

### Error Handling

- If person fetch fails, use fallback data
- If person_id is null, use fallback data
- Show "Unlinked" badge when person unavailable
- Display "—" for missing fields

---

## Future Considerations

### Potential Enhancements

1. **Customer Notes Field:**
   - Add `notes` field to customers table if needed
   - Display in popover if available

2. **Detail Route:**
   - Add `/dashboard/customers/:id` route
   - Update "Open Person" to navigate to detail page

3. **Messages Integration:**
   - Connect inbox messages to People
   - Display messages in popover
   - Replace "Coming soon" placeholder

4. **Copy Buttons:**
   - Add copy phone/email buttons
   - Use clipboard API

---

## Summary

- **No schema changes required**
- **Uses existing tables and relationships**
- **Lazy loading for performance**
- **Fallback strategy for resilience**
- **Read-only operations**

