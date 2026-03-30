# Data Model: Invoicing Customer Details Popover

## Overview

This feature does **not** require any database schema changes. It uses existing data structures and reuses the CustomerDetailsPopover component from Orders module.

---

## Existing Data Structures

### Invoices Table (`public.invoices`)

**Relevant Fields:**
- `id uuid pk` - Primary key
- `invoice_number text not null` - Invoice number
- `customer_name text not null` - Customer name (snapshot, may be empty)
- `amount numeric not null` - Invoice amount
- `status text not null` - Invoice status
- `due_date date` - Due date
- `issue_date date` - Issue date
- `order_id uuid null` - FK to orders table (optional)
- `payment_method text null` - Payment method
- `payment_date date null` - Payment date
- `notes text null` - Notes
- `created_at timestamptz` - Creation timestamp
- `updated_at timestamptz` - Update timestamp

**Key Observations:**
- **No `person_id` or `customer_id` field** - Invoices don't have direct link to customers table
- Only `customer_name` as snapshot field
- No `customer_phone` or `customer_email` fields
- `order_id` links to orders, which have `person_id` (indirect relationship)

---

### Orders Table (`public.orders`)

**Relevant Fields (for reference):**
- `person_id uuid null` - FK to customers/people table
- `person_name text null` - Snapshot of person name
- `customer_name text not null` - Deceased name
- `customer_email text null` - Snapshot email
- `customer_phone text null` - Snapshot phone

**Relationship:**
- Invoice → Order: `invoices.order_id` → `orders.id`
- Order → Person: `orders.person_id` → `customers.id`

**Note:** For MVP (Option A), we don't use this relationship. Option B would join orders to get person_id.

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

**Note:** Same structure as used in Orders module.

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
- Invoices with `customer_name` field
- No customer/order joins (for MVP)

---

### 2. Customer Details Fetch (Lazy - Not Used for Invoices)

**Query Pattern:**
```typescript
const { data: customer } = await supabase
  .from('customers')
  .select('*')
  .eq('id', personId)
  .single();
```

**When:**
- Only when popover opens AND `personId` exists
- **For invoices:** personId is null, so query never runs

**Result:**
- Full customer record with all fields
- Cached by React Query for subsequent opens

**Note:** For invoices (Option A), this query never runs because personId is always null.

---

## Data Transformation

### UIInvoice Interface

**Current Fields:**
```typescript
export interface UIInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customer: string; // From invoice.customer_name
  amount: string;
  status: string;
  dueDate: string;
  issueDate: string;
  paymentMethod: string | null;
  paymentDate: string | null;
  notes: string | null;
  daysOverdue: number;
}
```

**No Changes Needed:**
- `customer` field already exists (from `invoice.customer_name`)
- No need to add personId or fallback fields for MVP
- Component receives props directly from invoice data

---

## Fallback Strategy (Option A - MVP)

### Priority Order

1. **Snapshot Fields (from invoices table):**
   - Name: `invoice.customer_name` (always available, may be empty)
   - Phone: "—" (not stored in invoices)
   - Email: "—" (not stored in invoices)

2. **Default:**
   - Show "—" for missing fields
   - Show "—" without popover trigger if customer_name is empty/null

### Component Props

**For Invoices:**
```typescript
<CustomerDetailsPopover
  personId={null} // No person_id in invoices
  fallbackName={invoice.customer} // From invoice.customer_name
  fallbackPhone={null} // Not stored
  fallbackEmail={null} // Not stored
  trigger={...}
/>
```

**Result:**
- Popover shows customer_name in header
- "Unlinked" badge displayed
- Phone/email show "—"
- "Open Person" button NOT shown (no personId)

---

## Data Access Patterns

### Read Operations

**Invoices List:**
- Fetch all invoices with customer_name
- Transform to UIInvoice format
- Pass customer_name to popover as fallbackName

**Customer Details (Lazy):**
- Not used for invoices (personId is null)
- Query never runs for invoices
- Popover shows fallback data only

### No Write Operations

This feature is read-only. No data modifications required.

---

## Performance Considerations

### Lazy Loading

- Customer data fetched only when popover opens AND personId exists
- For invoices: personId is null, so no fetch occurs
- No prefetching for all invoices
- Reduces initial load time

### Caching

- React Query caches customer data by ID
- For invoices: no caching needed (no personId)
- If Option B is implemented later, caching will work automatically

### Query Optimization

- Invoices list query doesn't join customers/orders (for MVP)
- No over-fetching
- Simple and performant

---

## Data Validation

### Required Fields

- None (all fields optional/nullable)

### Validation Rules

- `customer_name` can be empty string or null
- Empty customer_name → show "—" without popover
- No personId validation needed (always null for invoices)

### Error Handling

- If customer_name is empty/null, show "—" without popover trigger
- Popover gracefully handles null personId (shows "Unlinked" badge)
- Display "—" for missing phone/email fields

---

## Future Considerations (Option B)

### Potential Enhancements

1. **Join Orders for Person ID:**
   - Modify `fetchInvoices()` to join orders table
   - Select `orders(person_id, person_name)` in invoice query
   - Add personId to Invoice interface
   - Update transformInvoiceForUI to include personId

2. **Invoice Schema Enhancement:**
   - Add `person_id uuid null` field to invoices table
   - Add `customer_phone text null` field
   - Add `customer_email text null` field
   - Direct relationship to customers table

3. **Messages Integration:**
   - Connect inbox messages to People
   - Display messages in popover
   - Replace "Coming soon" placeholder

---

## Summary

- **No schema changes required**
- **Uses existing tables and relationships**
- **No lazy loading for invoices** (personId is null)
- **Fallback strategy uses customer_name only**
- **Read-only operations**
- **Option B can be added later if needed**

