# Data Model: Invoicing Derive Person via Orders.invoice_id

## Entity Relationships

### Invoice → Orders (One-to-Many)

```
invoices (1) ←── (many) orders
  id              invoice_id
```

**Relationship:**
- One Invoice can have many Orders
- Orders reference Invoice via `orders.invoice_id`
- Invoice does NOT reference Orders via `invoices.order_id` (always NULL, unused)

### Order → Person (Many-to-One, Optional)

```
orders (many) ──→ (1) customers/people
  person_id          id
```

**Relationship:**
- One Order can reference one Person (optional, nullable)
- Person can have many Orders
- Orders store `person_id` as FK to `customers` table

## Data Flow

### Current (Incorrect) Flow

```
Invoice.order_id (always NULL)
  ↓
CustomerDetailsPopover.orderId (null)
  ↓
useOrderPersonId(null) (disabled)
  ↓
resolvedPersonId = null
  ↓
"Unlinked" badge
```

### Correct Flow

```
Invoice.id
  ↓
fetchInvoicePersonIds(invoiceId)
  ↓
Query: orders WHERE invoice_id = invoiceId SELECT person_id
  ↓
Extract unique non-null person_ids
  ↓
If personIds.length === 1:
  → resolvedPersonId = personIds[0]
  → Link state: 'linked'
  → Fetch People data
  → Show "Linked" badge
Else if personIds.length > 1:
  → resolvedPersonId = null
  → Link state: 'multiple'
  → Do NOT fetch People data
  → Show "Multiple people" badge + message
Else:
  → resolvedPersonId = null
  → Link state: 'unlinked'
  → Do NOT fetch People data
  → Show "Unlinked" badge
```

## Schema Details

### Invoices Table

```sql
create table public.invoices (
  id uuid primary key,
  order_id uuid references orders(id) on delete set null,  -- Always NULL, unused
  invoice_number text unique not null,
  customer_name text not null,
  -- ... other fields
);
```

**Key Fields:**
- `id` - Primary key (used for `orders.invoice_id` FK)
- `order_id` - Always NULL, not used in this feature

### Orders Table

```sql
create table public.orders (
  id uuid primary key,
  invoice_id uuid references invoices(id) on delete set null,  -- FK to invoices
  person_id uuid references customers(id) on delete set null,  -- FK to people
  person_name text null,  -- Snapshot
  -- ... other fields
);

-- Index for performance
create index idx_orders_invoice_id on public.orders(invoice_id);
create index idx_orders_person_id on public.orders(person_id);
```

**Key Fields:**
- `invoice_id` - FK to invoices (used to link orders to invoice)
- `person_id` - FK to customers/people (used to derive person for invoice)
- `person_name` - Snapshot (not used in this feature)

### Customers/People Table

```sql
create table public.customers (
  id uuid primary key,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  address text,
  -- ... other fields
);
```

**Key Fields:**
- `id` - Primary key (referenced by `orders.person_id`)
- Contact fields used in CustomerDetailsPopover

## Query Patterns

### Fetch Person IDs by Invoice

```typescript
// Lightweight query - select only person_id
const { data } = await supabase
  .from('orders')
  .select('person_id')
  .eq('invoice_id', invoiceId);

// Extract unique non-null person_ids
const personIds = new Set<string>();
data?.forEach(order => {
  if (order.person_id) {
    personIds.add(order.person_id);
  }
});
return Array.from(personIds);
```

**Performance:**
- Uses index on `orders.invoice_id`
- Minimal data transfer (only person_id column)
- Client-side deduplication

### Fetch Person Details

```typescript
// Only when linkState === 'linked' and resolvedPersonId exists
const { data: person } = await supabase
  .from('customers')
  .select('*')
  .eq('id', resolvedPersonId)
  .single();
```

**Performance:**
- Uses primary key lookup (fast)
- Only fires when needed (lazy loading)

## Data Transformations

### Invoice → UIInvoice

```typescript
interface UIInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;  // customer_name
  // ... other fields
}
```

**Note:** `orderId` field exists in UIInvoice but is always null (unused).

### Order → Person IDs

```typescript
// Input: invoiceId (string)
// Output: personIds (string[])
// Process:
//   1. Query orders WHERE invoice_id = invoiceId
//   2. Extract person_id from each order
//   3. Filter out nulls
//   4. Deduplicate
//   5. Return array
```

## Edge Cases

### Case 1: Invoice with No Orders
- `fetchInvoicePersonIds` returns `[]`
- Link state: 'unlinked'
- Badge: "Unlinked"
- No People fetch

### Case 2: Invoice with Orders, All Null person_id
- `fetchInvoicePersonIds` returns `[]` (after filtering nulls)
- Link state: 'unlinked'
- Badge: "Unlinked"
- No People fetch

### Case 3: Invoice with Orders, Single person_id
- `fetchInvoicePersonIds` returns `['person-id-1']`
- Link state: 'linked'
- Badge: "Linked"
- Fetch People data for `person-id-1`

### Case 4: Invoice with Orders, Multiple person_ids
- `fetchInvoicePersonIds` returns `['person-id-1', 'person-id-2']`
- Link state: 'multiple'
- Badge: "Multiple people"
- Message: "This invoice contains orders from multiple people."
- No People fetch

## Constraints

- No database schema changes required
- Uses existing relationships and indexes
- No breaking changes to existing APIs
- Backward compatible with existing props

