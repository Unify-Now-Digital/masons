# Implementation Plan: Orders CRUD Integration

**Branch:** `feature/orders-crud-integration`  
**Specification:** `specs/orders-crud-integration.md`

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create order schema | Create | `src/modules/orders/schemas/order.schema.ts` | High | None |
| 2 | Create data transformation utils | Create | `src/modules/orders/utils/orderTransform.ts` | High | None |
| 3 | Create CreateOrderDrawer | Create | `src/modules/orders/components/CreateOrderDrawer.tsx` | High | Tasks 1-2 |
| 4 | Create EditOrderDrawer | Create | `src/modules/orders/components/EditOrderDrawer.tsx` | High | Tasks 1-2 |
| 5 | Create DeleteOrderDialog | Create | `src/modules/orders/components/DeleteOrderDialog.tsx` | High | None |
| 6 | Update OrdersPage | Update | `src/modules/orders/pages/OrdersPage.tsx` | High | Tasks 3-5 |
| 7 | Update SortableOrdersTable | Update | `src/modules/orders/components/SortableOrdersTable.tsx` | High | Task 6 |
| 8 | Update OrderDetailsSidebar | Update | `src/modules/orders/components/OrderDetailsSidebar.tsx` | High | Task 6 |
| 9 | Validate build and types | Verify | - | High | Tasks 1-8 |

---

## Task 1: Create Order Schema

**File:** `src/modules/orders/schemas/order.schema.ts`  
**Action:** CREATE

**Content:**
```typescript
import { z } from 'zod';

export const orderFormSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
  customer_phone: z.string().optional().or(z.literal('')),
  order_type: z.string().min(1, 'Order type is required'),
  sku: z.string().optional().or(z.literal('')),
  material: z.string().optional().or(z.literal('')),
  color: z.string().optional().or(z.literal('')),
  stone_status: z.enum(['NA', 'Ordered', 'In Stock']).default('NA'),
  permit_status: z.enum(['form_sent', 'customer_completed', 'pending', 'approved']).default('pending'),
  proof_status: z.enum(['NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered']).default('Not_Received'),
  deposit_date: z.string().optional().nullable(),
  second_payment_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  installation_date: z.string().optional().nullable(),
  location: z.string().optional().or(z.literal('')),
  value: z.number().min(0, 'Value must be positive').optional().nullable(),
  progress: z.number().min(0).max(100).default(0),
  assigned_to: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  timeline_weeks: z.number().int().min(1).default(12),
  notes: z.string().optional().or(z.literal('')),
});

export type OrderFormData = z.infer<typeof orderFormSchema>;
```

**Purpose:** Zod validation schema matching database structure

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/orders/utils/orderTransform.ts`  
**Action:** CREATE

**Content:**
```typescript
import type { Order } from '../types/orders.types';

// UI-friendly order format (for display in tables/sidebars)
export interface UIOrder {
  id: string;
  customer: string;
  type: string;
  stoneStatus: string;
  permitStatus: string;
  proofStatus: string;
  dueDate: string;
  depositDate: string;
  secondPaymentDate: string | null;
  installationDate: string | null;
  value: string; // Formatted currency string
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

/**
 * Transform database order to UI-friendly format
 */
export function transformOrderForUI(order: Order): UIOrder {
  return {
    id: order.id,
    customer: order.customer_name,
    type: order.order_type,
    stoneStatus: order.stone_status,
    permitStatus: order.permit_status,
    proofStatus: order.proof_status,
    dueDate: order.due_date || '',
    depositDate: order.deposit_date || '',
    secondPaymentDate: order.second_payment_date || null,
    installationDate: order.installation_date || null,
    value: order.value ? `£${order.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
    location: order.location || '',
    progress: order.progress,
    assignedTo: order.assigned_to || '',
    priority: order.priority,
    sku: order.sku || '',
    material: order.material || '',
    color: order.color || '',
    timelineWeeks: order.timeline_weeks,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    notes: order.notes,
  };
}

/**
 * Transform array of database orders to UI format
 */
export function transformOrdersForUI(orders: Order[]): UIOrder[] {
  return orders.map(transformOrderForUI);
}
```

**Purpose:** Helper functions to transform between database and UI formats

---

## Task 3: Create CreateOrderDrawer Component

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`  
**Action:** CREATE

**Key Features:**
- React Hook Form with `zodResolver(orderFormSchema)`
- Drawer component from shadcn/ui
- Form fields for all order properties
- Submit button with loading state
- Toast notifications for success/error
- Closes drawer on successful submission
- Uses `useCreateOrder()` hook

**Form Fields:**
- Customer info (name*, email, phone)
- Order details (type*, sku, material, color)
- Statuses (stone_status, permit_status, proof_status) - Select dropdowns
- Dates (deposit_date, second_payment_date, due_date, installation_date) - Date inputs
- Location, value (number), progress (0-100), assigned_to
- Priority (low/medium/high) - Select
- Timeline weeks, notes

**Default Values:**
- `stone_status`: 'NA'
- `permit_status`: 'pending'
- `proof_status`: 'Not_Received'
- `priority`: 'medium'
- `progress`: 0
- `timeline_weeks`: 12

**Imports:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/shared/components/ui/drawer';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';
import { useCreateOrder } from '../hooks/useOrders';
import { orderFormSchema, type OrderFormData } from '../schemas/order.schema';
import { useToast } from '@/shared/hooks/use-toast';
```

---

## Task 4: Create EditOrderDrawer Component

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`  
**Action:** CREATE

**Key Features:**
- Same structure as CreateOrderDrawer
- Pre-fills form with `defaultValues` from order prop
- Uses `useUpdateOrder()` hook instead of `useCreateOrder()`
- Updates existing order by ID

**Props:**
```typescript
interface EditOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order; // Database order format
}
```

**Form Default Values:**
- Convert order to form format (dates as strings, handle nulls)
- Pre-populate all fields from order data

**Imports:** Same as CreateOrderDrawer, plus:
```typescript
import { useUpdateOrder } from '../hooks/useOrders';
import type { Order } from '../types/orders.types';
```

---

## Task 5: Create DeleteOrderDialog Component

**File:** `src/modules/orders/components/DeleteOrderDialog.tsx`  
**Action:** CREATE

**Key Features:**
- AlertDialog component from shadcn/ui
- Shows order ID and customer name
- Warning message about permanent deletion
- Cancel and Delete buttons
- Uses `useDeleteOrder()` hook
- Loading state on delete button
- Toast notifications
- Closes on success

**Props:**
```typescript
interface DeleteOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}
```

**Imports:**
```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { useDeleteOrder } from '../hooks/useOrders';
import { useToast } from '@/shared/hooks/use-toast';
import type { Order } from '../types/orders.types';
```

---

## Task 6: Update OrdersPage

**File:** `src/modules/orders/pages/OrdersPage.tsx`  
**Action:** UPDATE

### Changes Required:

**1. Remove hardcoded data:**
- Delete `orders` array (lines 24-88)
- Remove `OrdersDebugTest` component (lines 1-12)

**2. Add imports:**
```typescript
import { useOrdersList } from '../hooks/useOrders';
import { transformOrdersForUI, type UIOrder } from '../utils/orderTransform';
import { CreateOrderDrawer } from '../components/CreateOrderDrawer';
import { EditOrderDrawer } from '../components/EditOrderDrawer';
import { DeleteOrderDialog } from '../components/DeleteOrderDialog';
import { useToast } from '@/shared/hooks/use-toast';
import { Skeleton } from '@/shared/components/ui/skeleton';
```

**3. Add state for drawers/dialog:**
```typescript
const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
const [editDrawerOpen, setEditDrawerOpen] = useState(false);
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
const [selectedOrderForDelete, setSelectedOrderForDelete] = useState<Order | null>(null);
```

**4. Replace data fetching:**
```typescript
const { data: ordersData, isLoading, error } = useOrdersList();
const orders = ordersData ? transformOrdersForUI(ordersData) : [];
```

**5. Update "New Order" button:**
```typescript
<Button onClick={() => setCreateDrawerOpen(true)}>
  <Plus className="h-4 w-4 mr-2" />
  New Order
</Button>
```

**6. Update handleOrderUpdate:**
```typescript
const { mutate: updateOrder } = useUpdateOrder();
const { toast } = useToast();

const handleOrderUpdate = (orderId: string, updates: Partial<Order>) => {
  updateOrder(
    { id: orderId, updates },
    {
      onSuccess: () => {
        toast({
          title: "Order updated",
          description: "Order has been updated successfully.",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Update failed",
          description: error.message || "Failed to update order.",
          variant: "destructive",
        });
      },
    }
  );
};
```

**7. Add loading state:**
```typescript
if (isLoading) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
```

**8. Add error state:**
```typescript
if (error) {
  return (
    <div className="space-y-6">
      <Card className="p-8 text-center">
        <div className="text-red-600">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p className="text-lg font-medium">Error loading orders</p>
          <p className="text-sm">{error.message || 'Failed to load orders'}</p>
        </div>
      </Card>
    </div>
  );
}
```

**9. Update filteredOrders to use real data:**
- Keep existing filter logic
- Works with transformed UI format

**10. Update stats calculation:**
```typescript
const stats = {
  total: orders.length,
  pending: orders.filter(o => o.permitStatus === "pending" || o.permitStatus === "form_sent" || o.proofStatus === "Not_Received").length,
  overdue: orders.filter(o => o.dueDate && getDaysUntilDue(o.dueDate) < 0).length,
  readyForInstall: orders.filter(o => o.stoneStatus === "In Stock" && o.permitStatus === "approved" && o.proofStatus === "Lettered").length
};
```

**11. Add drawer/dialog components at end:**
```typescript
<CreateOrderDrawer 
  open={createDrawerOpen} 
  onOpenChange={setCreateDrawerOpen} 
/>

{selectedOrderForEdit && (
  <EditOrderDrawer
    open={editDrawerOpen}
    onOpenChange={setEditDrawerOpen}
    order={selectedOrderForEdit}
  />
)}

{selectedOrderForDelete && (
  <DeleteOrderDialog
    open={deleteDialogOpen}
    onOpenChange={setDeleteDialogOpen}
    order={selectedOrderForDelete}
  />
)}
```

---

## Task 7: Update SortableOrdersTable

**File:** `src/modules/orders/components/SortableOrdersTable.tsx`  
**Action:** UPDATE

### Changes Required:

**1. Update Order interface:**
- Keep existing UIOrder interface OR import from `orderTransform.ts`
- Ensure it matches transformed format

**2. Add props for edit/delete:**
```typescript
interface SortableOrdersTableProps {
  orders: UIOrder[]; // or keep local interface
  onViewOrder?: (order: UIOrder) => void;
  onEditOrder?: (order: UIOrder) => void; // NEW
  onDeleteOrder?: (order: UIOrder) => void; // NEW
}
```

**3. Add delete button in Actions column:**
```typescript
<TableCell>
  <div className="space-x-2">
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => onViewOrder?.(order)}
    >
      View
    </Button>
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => onEditOrder?.(order)}
    >
      Edit
    </Button>
    <Button 
      variant="destructive" 
      size="sm"
      onClick={() => onDeleteOrder?.(order)}
    >
      Delete
    </Button>
  </div>
</TableCell>
```

**4. Import Trash icon:**
```typescript
import { Trash2 } from 'lucide-react';
```

**Note:** The table receives UIOrder format, but for edit/delete we need the database Order. We'll need to pass the original order ID or maintain a mapping.

**Better approach:** Pass order IDs and let parent handle lookup:
```typescript
onEditOrder?: (orderId: string) => void;
onDeleteOrder?: (orderId: string) => void;
```

---

## Task 8: Update OrderDetailsSidebar

**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`  
**Action:** UPDATE

### Changes Required:

**1. Update Order interface:**
- Import `Order` type from `../types/orders.types`
- OR use `UIOrder` from `orderTransform.ts`

**2. Add mutation hook:**
```typescript
import { useUpdateOrder } from '../hooks/useOrders';
import { useToast } from '@/shared/hooks/use-toast';
```

**3. Update handleEditSave:**
```typescript
const { mutate: updateOrder, isPending } = useUpdateOrder();
const { toast } = useToast();

const handleEditSave = () => {
  if (editedOrder && onOrderUpdate) {
    // Transform UI format back to database format if needed
    // Or pass directly if using database Order type
    updateOrder(
      { id: editedOrder.id, updates: editedOrder },
      {
        onSuccess: () => {
          toast({
            title: "Order updated",
            description: "Order has been updated successfully.",
          });
          setIsEditing(false);
          setEditedOrder(null);
        },
        onError: (error: any) => {
          toast({
            title: "Update failed",
            description: error.message || "Failed to update order.",
            variant: "destructive",
          });
        },
      }
    );
  }
};
```

**4. Add loading state to save button:**
```typescript
<Button onClick={handleEditSave} disabled={isPending}>
  {isPending ? 'Saving...' : 'Save'}
</Button>
```

**5. Update field handling:**
- Ensure fields match database format (snake_case)
- Handle date conversions properly
- Handle null/empty values

---

## Task 9: Validate Build and Types

**Actions:**

### 9.1 TypeScript Check
```bash
npm run build
```
- Verify no TypeScript errors
- Check all imports resolve correctly
- Ensure type safety

### 9.2 Linter Check
```bash
npm run lint
```
- Fix any linting errors
- Ensure code style consistency

### 9.3 Runtime Validation
- Test Create Order flow
- Test Edit Order flow
- Test Delete Order flow
- Verify query invalidation works
- Check toast notifications
- Verify loading states

---

## Data Flow Diagrams

### Create Order Flow
```
User clicks "New Order" 
  → setCreateDrawerOpen(true)
  → CreateOrderDrawer opens
  → User fills form
  → User clicks Submit
  → useCreateOrder().mutate(formData)
  → Supabase insert
  → onSuccess: queryClient.invalidateQueries(['orders'])
  → useOrdersList() refetches
  → UI updates automatically
  → Toast notification
  → Drawer closes
```

### Edit Order Flow
```
User clicks "Edit" in table/sidebar
  → setSelectedOrderForEdit(order)
  → setEditDrawerOpen(true)
  → EditOrderDrawer opens with pre-filled data
  → User modifies form
  → User clicks Submit
  → useUpdateOrder().mutate({ id, updates })
  → Supabase update
  → onSuccess: queryClient.invalidateQueries(['orders'])
  → useOrdersList() refetches
  → UI updates automatically
  → Toast notification
  → Drawer closes
```

### Delete Order Flow
```
User clicks "Delete" in table
  → setSelectedOrderForDelete(order)
  → setDeleteDialogOpen(true)
  → DeleteOrderDialog opens
  → User confirms deletion
  → useDeleteOrder().mutate(orderId)
  → Supabase delete
  → onSuccess: queryClient.invalidateQueries(['orders'])
  → useOrdersList() refetches
  → UI updates automatically
  → Toast notification
  → Dialog closes
```

---

## Query Invalidation Details

### Automatic Invalidation
All mutations already handle invalidation in hooks:

**useCreateOrder:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ordersKeys.all });
}
```

**useUpdateOrder:**
```typescript
onSuccess: (data) => {
  queryClient.invalidateQueries({ queryKey: ordersKeys.all });
  queryClient.setQueryData(ordersKeys.detail(data.id), data);
}
```

**useDeleteOrder:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ordersKeys.all });
}
```

### UI Update Flow
1. Mutation succeeds
2. Query invalidation triggers
3. `useOrdersList()` automatically refetches
4. Component re-renders with new data
5. No manual state updates needed

---

## Toast Notification Patterns

### Success Toast
```typescript
toast({
  title: "Order created",
  description: "Order has been created successfully.",
});
```

### Error Toast
```typescript
toast({
  title: "Error",
  description: error.message || "An error occurred.",
  variant: "destructive",
});
```

### Usage in Components
- CreateOrderDrawer: Success on create, error on failure
- EditOrderDrawer: Success on update, error on failure
- DeleteOrderDialog: Success on delete, error on failure
- OrdersPage: Error on fetch failure

---

## Import Path Reference

All imports must use `@/` alias:

| Component | Import Path |
|-----------|-------------|
| UI Components | `@/shared/components/ui/{component}` |
| Hooks | `@/shared/hooks/{hook}` or `@/modules/orders/hooks/{hook}` |
| Types | `@/modules/orders/types/{type}` |
| Utils | `@/modules/orders/utils/{util}` |
| Schemas | `@/modules/orders/schemas/{schema}` |

---

## Execution Order

| Step | Task | Dependencies | Can Run Parallel? |
|------|------|--------------|-------------------|
| 1 | Create order schema | None | ✅ Yes |
| 2 | Create transform utils | None | ✅ Yes (with Task 1) |
| 3 | Create CreateOrderDrawer | Tasks 1-2 | ❌ No |
| 4 | Create EditOrderDrawer | Tasks 1-2 | ❌ No (after Task 3) |
| 5 | Create DeleteOrderDialog | None | ✅ Yes (with Tasks 3-4) |
| 6 | Update OrdersPage | Tasks 3-5 | ❌ No |
| 7 | Update SortableOrdersTable | Task 6 | ❌ No |
| 8 | Update OrderDetailsSidebar | Task 6 | ❌ No (after Task 7) |
| 9 | Validate build | Tasks 1-8 | ❌ No |

**Recommended Execution:**
1. **Parallel:** Tasks 1, 2 (schema + utils)
2. **Sequential:** Task 3 (CreateOrderDrawer)
3. **Sequential:** Task 4 (EditOrderDrawer)
4. **Parallel:** Task 5 (DeleteOrderDialog) - can run with Task 4
5. **Sequential:** Task 6 (OrdersPage) - needs all drawers
6. **Sequential:** Task 7 (SortableOrdersTable)
7. **Sequential:** Task 8 (OrderDetailsSidebar)
8. **Sequential:** Task 9 (Validation)

---

## Safety Checklist

- [ ] No modifications to other modules (inbox, jobs, invoicing, etc.)
- [ ] Existing UI styling preserved
- [ ] All imports use `@/` aliases
- [ ] TypeScript types are correct
- [ ] No hardcoded data remains
- [ ] Query invalidation works automatically
- [ ] Error handling is comprehensive
- [ ] Loading states are shown
- [ ] Toast notifications work
- [ ] Drawers/dialogs open/close correctly

---

## Success Criteria

✅ **Implementation is successful when:**

1. **Data Loading:**
   - Orders load from Supabase on page mount
   - Loading skeleton shows during fetch
   - Error state handles failures gracefully

2. **Create Order:**
   - Drawer opens from "New Order" button
   - Form validates with Zod
   - Submission creates order in database
   - UI updates automatically after creation
   - Toast shows success message

3. **Edit Order:**
   - Drawer opens from table/sidebar edit action
   - Form pre-fills with existing data
   - Submission updates order in database
   - UI updates automatically after update
   - Toast shows success message

4. **Delete Order:**
   - Dialog opens from table delete action
   - Confirmation required
   - Deletion removes order from database
   - UI updates automatically after deletion
   - Toast shows success message

5. **UI/UX:**
   - All existing styling maintained
   - Stats cards calculate from real data
   - Search and filtering work
   - Tabs filter correctly
   - No console errors

6. **Technical:**
   - Build succeeds
   - No TypeScript errors
   - No linting errors
   - All imports resolve
   - Query invalidation works

---

## Files Summary

### New Files (5)
| File | Purpose |
|------|---------|
| `src/modules/orders/schemas/order.schema.ts` | Zod validation schema |
| `src/modules/orders/utils/orderTransform.ts` | Data transformation helpers |
| `src/modules/orders/components/CreateOrderDrawer.tsx` | Create order form |
| `src/modules/orders/components/EditOrderDrawer.tsx` | Edit order form |
| `src/modules/orders/components/DeleteOrderDialog.tsx` | Delete confirmation |

### Modified Files (3)
| File | Changes |
|------|---------|
| `src/modules/orders/pages/OrdersPage.tsx` | Connect to Supabase, add drawers/dialog |
| `src/modules/orders/components/SortableOrdersTable.tsx` | Add edit/delete actions |
| `src/modules/orders/components/OrderDetailsSidebar.tsx` | Connect to update mutation |

### No Changes Needed
- All CRUD hooks already implemented ✅
- All API functions already implemented ✅
- TanStack Query setup complete ✅

