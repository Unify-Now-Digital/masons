# Data Model: Orders Customer/Person Assignment

## Current Schema

### `public.orders`

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid null references public.invoices(id) on delete set null,
  job_id uuid null references public.jobs(id) on delete set null,
  customer_name text not null, -- Currently used for Deceased Name in UI
  customer_email text null,
  customer_phone text null,
  order_type text not null,
  sku text null,
  material text null,
  color text null,
  stone_status text default 'NA',
  permit_status text default 'pending',
  proof_status text default 'Not_Received',
  deposit_date date null,
  second_payment_date date null,
  due_date date null,
  installation_date date null,
  location text null,
  latitude numeric null,
  longitude numeric null,
  value decimal(10,2) null,
  progress integer default 0,
  assigned_to text null,
  priority text default 'medium',
  timeline_weeks integer default 12,
  notes text null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

### `public.customers`

```sql
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text null,
  phone text null,
  address text null,
  city text null,
  country text null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

---

## Proposed Schema Changes

### Additions to `public.orders`

```sql
-- Add person_id field (nullable FK to customers)
alter table public.orders
  add column person_id uuid null
  references public.customers(id) on delete set null;

-- Add person_name snapshot field
alter table public.orders
  add column person_name text null;

-- Add index for performance
create index if not exists idx_orders_person_id on public.orders(person_id);

-- Add column comments
comment on column public.orders.person_id is 'Foreign key to customers/people table. The actual customer/person who placed the order.';
comment on column public.orders.person_name is 'Snapshot of person name at time of order creation for resilience.';
comment on column public.orders.customer_name is 'Deceased name (legacy field name, but used for deceased person in UI).';
```

---

## Updated Schema

### `public.orders` (After Migration)

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid null references public.invoices(id) on delete set null,
  job_id uuid null references public.jobs(id) on delete set null,
  person_id uuid null references public.customers(id) on delete set null, -- NEW
  person_name text null, -- NEW
  customer_name text not null, -- Deceased Name (legacy field name)
  customer_email text null,
  customer_phone text null,
  -- ... rest of fields unchanged
);
```

---

## Relationships

### Orders → Customers (NEW)

- **Type:** Many-to-One (optional)
- **FK:** `orders.person_id` → `customers.id`
- **On Delete:** `SET NULL` (preserves orders if customer deleted)
- **Purpose:** Link order to the person who placed it

### Data Flow

```
Order Creation:
1. User selects Person from dropdown
2. Set person_id = selected customer.id
3. Set person_name = customer.first_name + ' ' + customer.last_name
4. Store both for resilience (snapshot)
```

---

## Display Logic

### Customer Column (Orders List)

```typescript
// Priority order:
1. person_name (snapshot) - if exists
2. customers.first_name + ' ' + customers.last_name (from join) - if person_id exists
3. '—' (fallback) - if no person assigned
```

### Deceased Column (Orders List)

```typescript
// Always show:
customer_name (existing field, used for Deceased Name)
```

---

## TypeScript Types

### Order Interface

```typescript
export interface Order {
  id: string;
  invoice_id: string | null;
  job_id: string | null;
  person_id: string | null; // NEW
  person_name: string | null; // NEW
  customer_name: string; // Deceased Name
  customer_email: string | null;
  customer_phone: string | null;
  // ... rest of fields
  customers?: { // Joined data (optional)
    id: string;
    first_name: string;
    last_name: string;
  };
}
```

### UI Order Interface

```typescript
export interface UIOrder {
  id: string;
  customer: string; // Person name (resolved)
  deceasedName: string; // Deceased name (from customer_name)
  // ... rest of fields
}
```

---

## Migration Strategy

### Additive Only
- All new fields are nullable
- No existing columns modified
- No data loss
- Backward compatible

### Data Migration
- Existing orders: `person_id = null`, `person_name = null`
- New orders: Set `person_id` and `person_name` when Person selected
- Invoicing: Match invoice `customer_name` to find `person_id`

---

## Indexes

### New Indexes

```sql
create index idx_orders_person_id on public.orders(person_id);
```

**Purpose:** Efficient joins when fetching orders with customer data

---

## Constraints

### Foreign Key

```sql
alter table public.orders
  add constraint fk_orders_person_id
  foreign key (person_id)
  references public.customers(id)
  on delete set null;
```

**Behavior:** If customer is deleted, order.person_id is set to null (order preserved)

---

## RLS Policies

### Existing Policies

```sql
create policy "Allow all access to orders" on public.orders
  for all using (true) with check (true);
```

**Note:** No changes needed - new fields inherit existing policies

---

## Validation Rules

### Person Assignment

- `person_id` is optional (nullable)
- If `person_id` is set, `person_name` should also be set (application-level validation)
- `person_name` can exist without `person_id` (for resilience if customer deleted)

### Display

- Customer column: Never show `customer_name` (deceased) here
- Deceased column: Always show `customer_name` (deceased)

