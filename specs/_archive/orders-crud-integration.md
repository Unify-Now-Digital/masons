# Orders CRUD Integration Specification

## Overview

Connect `OrdersPage.tsx` to real Supabase data by:
1. Replacing hardcoded demo data with live data from `useOrdersList()`
2. Adding Create Order Drawer with React Hook Form + Zod validation
3. Adding Edit Order Drawer with React Hook Form + Zod validation
4. Adding Delete Order action with confirmation dialog
5. Ensuring TanStack Query automatically invalidates and updates UI
6. Maintaining existing UI styling and layout

**No workflow automation, no external integrations** - pure CRUD operations only.

---

## Current State Analysis

### OrdersPage.tsx
- **Status**: Uses hardcoded `orders` array (lines 24-88)
- **Data Source**: Static demo data with camelCase properties
- **Hooks**: `useOrdersList()` is imported but not used (debug component exists)
- **UI Components**: Uses `SortableOrdersTable` and `OrderDetailsSidebar`
- **Actions**: "New Order" button exists but doesn't open drawer
- **Update Handler**: `handleOrderUpdate` only logs to console

### Database Schema (orders table)
- **Fields**: Uses snake_case (customer_name, order_type, stone_status, etc.)
- **Types**: String enums for statuses, dates, decimal for value
- **ID**: UUID (not "ORD-001" format)

### Type Mismatch
**Demo Data Format:**
```typescript
{
  id: "ORD-001",           // String ID
  customer: "John Smith",  // camelCase
  type: "Granite Headstone",
  value: "£2,500",         // String with currency
  dueDate: "2025-06-15",   // camelCase
  // ...
}
```

**Database Format:**
```typescript
{
  id: "uuid-string",       // UUID
  customer_name: "John Smith",  // snake_case
  order_type: "Granite Headstone",
  value: 2500.00,          // Decimal number
  due_date: "2025-06-15", // snake_case, date string
  // ...
}
```

### Existing Hooks
- ✅ `useOrdersList()` - Already implemented
- ✅ `useCreateOrder()` - Already implemented with query invalidation
- ✅ `useUpdateOrder()` - Already implemented with query invalidation
- ✅ `useDeleteOrder()` - Already implemented with query invalidation

### Available UI Components
- ✅ `Drawer` - Available in `@/shared/components/ui/drawer`
- ✅ `Dialog` - Available in `@/shared/components/ui/dialog` (for delete confirmation)
- ✅ `Form` - Available in `@/shared/components/ui/form` (React Hook Form integration)
- ✅ `Input`, `Select`, `Textarea`, `Button`, etc. - All available

### Dependencies
- ✅ `react-hook-form` - Already installed (v7.53.0)
- ✅ `zod` - Already installed (v3.23.8)
- ✅ `@hookform/resolvers` - Already installed (v3.9.0)

---

## Target State

### Data Flow
1. **Load**: `useOrdersList()` → Fetches from Supabase → Transforms to UI format
2. **Create**: Form submission → `useCreateOrder()` → Supabase insert → Query invalidation → UI updates
3. **Update**: Form submission → `useUpdateOrder()` → Supabase update → Query invalidation → UI updates
4. **Delete**: Confirmation → `useDeleteOrder()` → Supabase delete → Query invalidation → UI updates

### UI Components to Create
1. **CreateOrderDrawer** - Full form with validation
2. **EditOrderDrawer** - Pre-filled form with validation
3. **DeleteOrderDialog** - Confirmation dialog

### Data Transformation
- **Database → UI**: Transform snake_case to camelCase for display
- **UI → Database**: Transform camelCase to snake_case for submission
- **Value Format**: Convert between number (DB) and formatted string (UI) for display

---

## Files to Create

### 1. Create Order Drawer

**`src/modules/orders/components/CreateOrderDrawer.tsx`**

Features:
- React Hook Form with Zod validation
- All required fields from `OrderInsert` type
- Date pickers for deposit_date, due_date, installation_date
- Select dropdowns for status enums
- Number input for value (stored as decimal)
- Text inputs for customer info, location, notes
- Submit button triggers `useCreateOrder()` mutation
- Loading state during submission
- Error handling with toast notifications
- Closes drawer on success
- Invalidates queries automatically (via hook)

### 2. Edit Order Drawer

**`src/modules/orders/components/EditOrderDrawer.tsx`**

Features:
- React Hook Form with Zod validation
- Pre-filled with existing order data
- Same fields as Create drawer
- Submit button triggers `useUpdateOrder()` mutation
- Loading state during submission
- Error handling with toast notifications
- Closes drawer on success
- Invalidates queries automatically (via hook)

### 3. Delete Order Dialog

**`src/modules/orders/components/DeleteOrderDialog.tsx`**

Features:
- Confirmation dialog (AlertDialog component)
- Shows order ID and customer name
- Warning message about permanent deletion
- Cancel and Delete buttons
- Delete button triggers `useDeleteOrder()` mutation
- Loading state during deletion
- Error handling with toast notifications
- Closes dialog on success
- Invalidates queries automatically (via hook)

### 4. Order Form Schema

**`src/modules/orders/schemas/order.schema.ts`**

Zod schema for validation:
- All required fields
- Type validation (strings, numbers, dates, enums)
- Optional fields marked correctly
- Custom validations (e.g., value >= 0, progress 0-100)

---

## Files to Modify

### 1. OrdersPage.tsx

**Changes:**
1. Remove hardcoded `orders` array
2. Use `useOrdersList()` hook
3. Add loading state handling
4. Add error state handling
5. Transform database data to UI format (snake_case → camelCase)
6. Connect "New Order" button to open CreateOrderDrawer
7. Update `handleOrderUpdate` to use `useUpdateOrder()` mutation
8. Add delete handler using DeleteOrderDialog
9. Update stats calculation to use real data
10. Remove `OrdersDebugTest` component

**Data Transformation Helper:**
```typescript
function transformOrderForUI(order: Order): UIOrder {
  return {
    id: order.id,
    customer: order.customer_name,
    type: order.order_type,
    value: order.value ? `£${order.value.toLocaleString()}` : 'N/A',
    dueDate: order.due_date || '',
    // ... transform all fields
  };
}
```

### 2. SortableOrdersTable.tsx

**Changes:**
1. Update Order interface to match database format (or use transformation)
2. Ensure it works with transformed UI format
3. Add delete button/action column
4. Connect edit action to open EditOrderDrawer

### 3. OrderDetailsSidebar.tsx

**Changes:**
1. Update to use database Order type
2. Connect save action to `useUpdateOrder()` mutation
3. Remove local state management (let TanStack Query handle it)
4. Show loading/error states

---

## Zod Schema Definition

### Order Form Schema

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

---

## Component Structure

### CreateOrderDrawer
```typescript
interface CreateOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Uses:
// - useForm from react-hook-form
// - zodResolver from @hookform/resolvers
// - useCreateOrder() hook
// - Drawer component
// - Form components (FormField, FormItem, FormLabel, FormControl, FormMessage)
// - Input, Select, Textarea components
// - useToast for notifications
```

### EditOrderDrawer
```typescript
interface EditOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order; // Pre-filled order data
}

// Uses:
// - useForm with defaultValues from order prop
// - zodResolver
// - useUpdateOrder() hook
// - Same form structure as CreateOrderDrawer
```

### DeleteOrderDialog
```typescript
interface DeleteOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}

// Uses:
// - AlertDialog component
// - useDeleteOrder() hook
// - useToast for notifications
```

---

## Data Transformation Requirements

### Database → UI Display
- `customer_name` → `customer`
- `order_type` → `type`
- `value` (number) → `value` (formatted string like "£2,500")
- `due_date` → `dueDate`
- `deposit_date` → `depositDate`
- `stone_status` → `stoneStatus`
- All snake_case → camelCase

### UI Form → Database
- Form data uses database field names (snake_case)
- Zod schema validates database format
- Direct submission to API (no transformation needed)

### Stats Calculation
- Calculate from real data array
- Handle loading/error states
- Use transformed UI format for filtering

---

## TanStack Query Integration

### Query Invalidation
All mutations already handle invalidation:
- `useCreateOrder()` → Invalidates `ordersKeys.all`
- `useUpdateOrder()` → Invalidates `ordersKeys.all` + updates detail cache
- `useDeleteOrder()` → Invalidates `ordersKeys.all`

### Loading States
- `useOrdersList()` provides `isLoading` and `isError`
- Mutations provide `isPending` for submit buttons
- Show loading skeletons/spinners during fetch

### Error Handling
- Use `useToast()` for error notifications
- Display error messages from Supabase
- Handle network errors gracefully

---

## UI/UX Requirements

### Maintain Existing Styling
- Keep all existing Tailwind classes
- Maintain card layouts and spacing
- Preserve color schemes and badges
- Keep responsive design

### Form Validation
- Real-time validation with React Hook Form
- Show field errors below inputs
- Disable submit button when form is invalid
- Show loading state on submit button

### User Feedback
- Toast notifications for success/error
- Loading indicators during mutations
- Optimistic updates (optional, not required)
- Clear error messages

### Drawer Behavior
- Opens from "New Order" button
- Closes on successful submission
- Closes on cancel/outside click
- Prevents closing during submission (optional)

---

## Field Mappings

### Required Fields
- `customer_name` (text input)
- `order_type` (text input or select)

### Optional Fields
- `customer_email` (email input)
- `customer_phone` (text input)
- `sku`, `material`, `color` (text inputs)
- `location` (text input)
- `notes` (textarea)
- `assigned_to` (text input)
- `value` (number input, decimal)
- `timeline_weeks` (number input, integer)

### Enum Fields (Select dropdowns)
- `stone_status`: ['NA', 'Ordered', 'In Stock']
- `permit_status`: ['form_sent', 'customer_completed', 'pending', 'approved']
- `proof_status`: ['NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered']
- `priority`: ['low', 'medium', 'high']

### Date Fields (Date pickers)
- `deposit_date`
- `second_payment_date`
- `due_date`
- `installation_date`

### Calculated Fields (Not in form)
- `progress` (0-100, can be set manually or calculated)
- `created_at`, `updated_at` (auto-managed by database)

---

## Validation Checklist

After implementation, verify:

- [ ] Orders load from Supabase using `useOrdersList()`
- [ ] Loading state shows while fetching
- [ ] Error state handles failures gracefully
- [ ] Create Order Drawer opens from button
- [ ] Create form validates with Zod
- [ ] Create submission works and updates UI
- [ ] Edit Order Drawer opens from table/sidebar
- [ ] Edit form pre-fills with order data
- [ ] Edit submission works and updates UI
- [ ] Delete confirmation dialog appears
- [ ] Delete action works and updates UI
- [ ] All mutations invalidate queries correctly
- [ ] UI updates automatically after mutations
- [ ] Toast notifications show success/error
- [ ] Existing UI styling is maintained
- [ ] Stats cards calculate from real data
- [ ] Search and filtering work with real data
- [ ] Tabs filter correctly with real data

---

## Out of Scope

The following are explicitly NOT included:

- Workflow automation
- External integrations (Gmail, WhatsApp, Stripe, etc.)
- Real-time subscriptions
- Bulk operations
- Order status workflows
- Email notifications
- PDF generation
- Advanced filtering/search
- Export functionality
- Order templates
- Duplicate order functionality

---

## Implementation Notes

1. **Data Transformation**: Create helper functions to transform between DB and UI formats
2. **Form Defaults**: Use sensible defaults for new orders (e.g., progress: 0, priority: 'medium')
3. **Date Handling**: Use date strings (YYYY-MM-DD) for date inputs, convert as needed
4. **Value Formatting**: Display as currency string, store as decimal number
5. **Error Messages**: Use Supabase error messages, provide fallback for network errors
6. **Loading States**: Show spinners/skeletons, disable buttons during mutations
7. **Query Keys**: Use existing `ordersKeys` from hooks file
8. **Type Safety**: Use TypeScript types from `orders.types.ts`

---

## Files Summary

### New Files (4)
| File | Purpose |
|------|---------|
| `src/modules/orders/components/CreateOrderDrawer.tsx` | Create order form drawer |
| `src/modules/orders/components/EditOrderDrawer.tsx` | Edit order form drawer |
| `src/modules/orders/components/DeleteOrderDialog.tsx` | Delete confirmation dialog |
| `src/modules/orders/schemas/order.schema.ts` | Zod validation schema |

### Modified Files (3)
| File | Changes |
|------|---------|
| `src/modules/orders/pages/OrdersPage.tsx` | Replace demo data with `useOrdersList()`, add drawer/dialog state |
| `src/modules/orders/components/SortableOrdersTable.tsx` | Add delete action, connect edit action |
| `src/modules/orders/components/OrderDetailsSidebar.tsx` | Connect to `useUpdateOrder()` mutation |

### No Changes Needed
- All CRUD hooks already implemented ✅
- All API functions already implemented ✅
- TanStack Query setup already complete ✅

