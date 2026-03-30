# API Contracts: Orders Customer/Person Assignment

## Orders API

### Fetch Orders

**Endpoint:** `GET /orders` (via Supabase)

**Query:**
```typescript
const { data, error } = await supabase
  .from('orders')
  .select('*, customers(id, first_name, last_name)')
  .order('created_at', { ascending: false });
```

**Response:**
```typescript
interface Order {
  id: string;
  invoice_id: string | null;
  job_id: string | null;
  person_id: string | null; // NEW
  person_name: string | null; // NEW
  customer_name: string; // Deceased Name
  customer_email: string | null;
  customer_phone: string | null;
  order_type: string;
  sku: string | null;
  material: string | null;
  color: string | null;
  stone_status: 'NA' | 'Ordered' | 'In Stock';
  permit_status: 'form_sent' | 'customer_completed' | 'pending' | 'approved';
  proof_status: 'NA' | 'Not_Received' | 'Received' | 'In_Progress' | 'Lettered';
  deposit_date: string | null;
  second_payment_date: string | null;
  due_date: string | null;
  installation_date: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  value: number | null;
  progress: number;
  assigned_to: string | null;
  priority: 'low' | 'medium' | 'high';
  timeline_weeks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customers?: { // Joined data (optional)
    id: string;
    first_name: string;
    last_name: string;
  };
}
```

**Error Handling:**
- Returns empty array if no orders
- Throws error if query fails

---

### Create Order

**Endpoint:** `POST /orders` (via Supabase)

**Request:**
```typescript
interface OrderInsert {
  invoice_id?: string | null;
  job_id?: string | null;
  person_id?: string | null; // NEW
  person_name?: string | null; // NEW
  customer_name: string; // Deceased Name (required)
  customer_email?: string | null;
  customer_phone?: string | null;
  order_type: string;
  sku?: string | null;
  material?: string | null;
  color?: string | null;
  stone_status?: 'NA' | 'Ordered' | 'In Stock';
  permit_status?: 'form_sent' | 'customer_completed' | 'pending' | 'approved';
  proof_status?: 'NA' | 'Not_Received' | 'Received' | 'In_Progress' | 'Lettered';
  deposit_date?: string | null;
  second_payment_date?: string | null;
  due_date?: string | null;
  installation_date?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  value?: number | null;
  progress?: number;
  assigned_to?: string | null;
  priority?: 'low' | 'medium' | 'high';
  timeline_weeks?: number;
  notes?: string | null;
}
```

**Response:**
```typescript
Order // Full order object with generated id and timestamps
```

**Validation:**
- `customer_name` is required (Deceased Name)
- `person_id` must be valid UUID if provided
- `person_id` must reference existing customer if provided

---

### Update Order

**Endpoint:** `PATCH /orders/:id` (via Supabase)

**Request:**
```typescript
interface OrderUpdate {
  person_id?: string | null; // NEW - can update
  person_name?: string | null; // NEW - can update
  customer_name?: string; // Deceased Name - can update
  // ... other fields as needed
}
```

**Response:**
```typescript
Order // Updated order object
```

**Validation:**
- `person_id` must be valid UUID if provided
- `person_id` must reference existing customer if provided

---

## Customers API

### Fetch Customers (for Person Selector)

**Endpoint:** `GET /customers` (via Supabase)

**Query:**
```typescript
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .order('last_name', { ascending: true });
```

**Response:**
```typescript
interface Customer[] {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}
```

**Usage:**
- Populate Person selector dropdown in CreateOrderDrawer
- Populate Person selector dropdown in EditOrderDrawer

---

## Transform Functions

### transformOrderForUI

**Input:**
```typescript
Order (with optional customers join)
```

**Output:**
```typescript
interface UIOrder {
  id: string;
  customer: string; // Person name (resolved)
  deceasedName: string; // Deceased name (from customer_name)
  type: string;
  stoneStatus: string;
  permitStatus: string;
  proofStatus: string;
  dueDate: string;
  depositDate: string;
  secondPaymentDate: string | null;
  installationDate: string | null;
  value: string; // Formatted currency
  location: string;
  progress: number;
  assignedTo: string;
  priority: string;
  sku: string;
  material: string;
  color: string;
  timelineWeeks: number;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}
```

**Logic:**
```typescript
// Resolve customer name
const customerName = order.person_name 
  || (order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : null)
  || '—';

// Map to UI format
return {
  customer: customerName,
  deceasedName: order.customer_name,
  // ... rest of fields
};
```

---

## React Query Hooks

### useOrdersList

**Hook:**
```typescript
function useOrdersList() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });
}
```

**Returns:**
```typescript
{
  data: Order[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

---

### useCreateOrder

**Hook:**
```typescript
function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
```

**Usage:**
```typescript
const { mutate: createOrder, isPending } = useCreateOrder();

createOrder({
  person_id: selectedPersonId,
  person_name: selectedPersonName,
  customer_name: deceasedName,
  // ... other fields
});
```

---

### useUpdateOrder

**Hook:**
```typescript
function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
```

**Usage:**
```typescript
const { mutate: updateOrder, isPending } = useUpdateOrder();

updateOrder({
  id: orderId,
  updates: {
    person_id: newPersonId,
    person_name: newPersonName,
    // ... other fields
  },
});
```

---

### useCustomersList

**Hook:**
```typescript
function useCustomersList() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });
}
```

**Returns:**
```typescript
{
  data: Customer[] | undefined;
  isLoading: boolean;
  error: Error | null;
}
```

**Usage:**
- Populate Person selector in order forms

---

## Error Handling

### Validation Errors

**Person ID Invalid:**
```typescript
{
  code: '23503', // Foreign key violation
  message: 'person_id references non-existent customer'
}
```

**Missing Required Fields:**
```typescript
{
  code: '23502', // Not null violation
  message: 'customer_name is required'
}
```

### Display Errors

- Show toast notification on error
- Log error to console for debugging
- Preserve form state on error

---

## Performance Considerations

### Indexes

- `idx_orders_person_id` - Efficient joins when filtering by person
- Existing indexes remain unchanged

### Query Optimization

- Join customers only when needed (for display)
- Use `person_name` snapshot to avoid join when possible
- Batch fetch customers for dropdowns

---

## Backward Compatibility

### Existing Orders

- `person_id = null`
- `person_name = null`
- Display as "—" in Customer column
- Deceased name still shown correctly

### API Compatibility

- All new fields are optional
- Existing API calls continue to work
- No breaking changes to response structure

