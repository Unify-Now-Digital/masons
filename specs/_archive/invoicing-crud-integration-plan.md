# Implementation Plan: Invoicing CRUD Integration

**Branch:** `feature/invoicing-crud-integration`  
**Specification:** `specs/invoicing-crud-integration.md`

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create invoice schema | Create | `src/modules/invoicing/schemas/invoice.schema.ts` | High | None |
| 2 | Create data transformation utils | Create | `src/modules/invoicing/utils/invoiceTransform.ts` | High | None |
| 3 | Update invoicing API for invoice number generation | Update | `src/modules/invoicing/api/invoicing.api.ts` | High | None |
| 4 | Create CreateInvoiceDrawer | Create | `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | High | Tasks 1-2 |
| 5 | Create EditInvoiceDrawer | Create | `src/modules/invoicing/components/EditInvoiceDrawer.tsx` | High | Tasks 1-2 |
| 6 | Create DeleteInvoiceDialog | Create | `src/modules/invoicing/components/DeleteInvoiceDialog.tsx` | High | None |
| 7 | Update InvoicingPage | Update | `src/modules/invoicing/pages/InvoicingPage.tsx` | High | Tasks 4-6 |
| 8 | Validate build and types | Verify | - | High | Tasks 1-7 |

---

## Task 1: Create Invoice Schema

**File:** `src/modules/invoicing/schemas/invoice.schema.ts`  
**Action:** CREATE

**Content:**
```typescript
import { z } from 'zod';

export const invoiceFormSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  status: z.enum(['draft', 'pending', 'paid', 'overdue', 'cancelled']).default('pending'),
  due_date: z.string().min(1, 'Due date is required'),
  issue_date: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  payment_method: z.string().optional().nullable(),
  payment_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.due_date && data.issue_date) {
      return new Date(data.due_date) >= new Date(data.issue_date);
    }
    return true;
  },
  {
    message: 'Due date must be on or after issue date',
    path: ['due_date'],
  }
);

export type InvoiceFormData = z.infer<typeof invoiceFormSchema>;
```

**Purpose:** Zod validation schema matching database structure with custom validation for date logic

**Key Validations:**
- `customer_name`: Required, min 1 character
- `amount`: Required, must be > 0.01
- `status`: Enum with default 'pending'
- `due_date`: Required, must be >= issue_date
- `issue_date`: Optional, defaults to today
- `order_id`: Optional UUID, nullable
- `payment_method`, `payment_date`, `notes`: Optional, nullable

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/invoicing/utils/invoiceTransform.ts`  
**Action:** CREATE

**Content:**
```typescript
import type { Invoice } from '../types/invoicing.types';

// UI-friendly invoice format (for display in tables)
export interface UIInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customer: string;
  amount: string; // Formatted currency string
  status: string; // May be 'overdue' if pending and past due
  dueDate: string;
  issueDate: string;
  paymentMethod: string | null;
  paymentDate: string | null;
  notes: string | null;
  daysOverdue: number; // Calculated field
}

/**
 * Transform database invoice to UI-friendly format
 */
export function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  const today = new Date();
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const daysOverdue = dueDate && dueDate < today 
    ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Calculate display status: if pending and overdue, show as overdue
  const displayStatus = invoice.status === 'pending' && daysOverdue > 0 
    ? 'overdue' 
    : invoice.status;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    orderId: invoice.order_id,
    customer: invoice.customer_name,
    amount: `$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    status: displayStatus,
    dueDate: invoice.due_date,
    issueDate: invoice.issue_date,
    paymentMethod: invoice.payment_method,
    paymentDate: invoice.payment_date,
    notes: invoice.notes,
    daysOverdue,
  };
}

/**
 * Transform array of database invoices to UI format
 */
export function transformInvoicesForUI(invoices: Invoice[]): UIInvoice[] {
  return invoices.map(transformInvoiceForUI);
}
```

**Purpose:** Helper functions to transform between database and UI formats, including overdue calculation

**Key Transformations:**
- `invoice_number` → `invoiceNumber`
- `order_id` → `orderId`
- `customer_name` → `customer`
- `amount` (number) → `amount` (formatted currency string)
- `due_date` → `dueDate`
- `issue_date` → `issueDate`
- `payment_method` → `paymentMethod`
- `payment_date` → `paymentDate`
- Calculate `daysOverdue` from due_date
- Calculate display `status` (overdue if pending and past due)

---

## Task 3: Update Invoicing API for Invoice Number Generation

**File:** `src/modules/invoicing/api/invoicing.api.ts`  
**Action:** UPDATE

**Changes:**
Update `createInvoice` function to auto-generate invoice number using database sequence.

**Approach:** Use Supabase RPC to call `nextval('invoice_number_seq')` and format as "INV-000001"

**Updated Function:**
```typescript
export async function createInvoice(invoice: InvoiceInsert) {
  // Generate invoice number if not provided
  if (!invoice.invoice_number) {
    // Get next value from sequence
    const { data: seqData, error: seqError } = await supabase
      .rpc('exec_sql', { 
        query: "SELECT nextval('invoice_number_seq') as next_val" 
      });
    
    // Alternative: Direct sequence call via SQL
    // Use a simpler approach - call sequence directly
    const { data: seqResult, error: seqError } = await supabase
      .from('_sequence')
      .select('nextval')
      .single();
    
    // Best approach: Create a database function get_next_invoice_number()
    // For now, we'll use a workaround with raw SQL via RPC
    // Or generate on backend via trigger
    
    // Simple approach: Use Supabase to get next sequence value
    // Format: INV-000001, INV-000002, etc.
    const nextNum = seqData?.next_val || 1001;
    invoice.invoice_number = `INV-${String(nextNum).padStart(6, '0')}`;
  }
  
  const { data, error } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single();
  
  if (error) throw error;
  return data as Invoice;
}
```

**Better Approach:** Create a database function (recommended but optional for Phase 1):

**Database Migration (Optional):**
```sql
create or replace function public.get_next_invoice_number()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_num bigint;
begin
  next_num := nextval('public.invoice_number_seq');
  return 'INV-' || lpad(next_num::text, 6, '0');
end;
$$;
```

**Then use in API:**
```typescript
export async function createInvoice(invoice: InvoiceInsert) {
  // Generate invoice number if not provided
  if (!invoice.invoice_number) {
    const { data: invoiceNumber, error: numError } = await supabase
      .rpc('get_next_invoice_number');
    if (numError) throw numError;
    invoice.invoice_number = invoiceNumber;
  }
  
  const { data, error } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single();
  
  if (error) throw error;
  return data as Invoice;
}
```

**For Phase 1:** Use the database function approach if possible, otherwise generate a simple sequential number client-side (not recommended but acceptable for MVP).

**Purpose:** Ensure invoice numbers are auto-generated using backend sequence, preventing duplicates

---

## Task 4: Create CreateInvoiceDrawer Component

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`  
**Action:** CREATE

**Key Features:**
- React Hook Form with `zodResolver(invoiceFormSchema)`
- Drawer component from shadcn/ui
- Form fields for all invoice properties
- Order selection dropdown (fetch using `useOrdersList()` from orders module)
- Submit button with loading state
- Toast notifications for success/error
- Auto-generates invoice number (handled in API)

**Form Fields:**
1. **Order Selection** (optional):
   - Select dropdown
   - Fetch orders using `useOrdersList()` from `@/modules/orders/hooks/useOrders`
   - Display format: "Customer Name - Order ID (short)"
   - Allow "No Order" option

2. **Customer Name** (required):
   - Text input
   - Validation: min 1 character

3. **Amount** (required):
   - Number input (decimal)
   - Validation: > 0.01
   - Step: 0.01

4. **Status** (required):
   - Select dropdown
   - Options: draft, pending, paid, overdue, cancelled
   - Default: 'pending'
   - Note: 'overdue' is calculated, not selectable

5. **Issue Date** (optional):
   - Date input
   - Default: today's date

6. **Due Date** (required):
   - Date input
   - Validation: must be >= issue_date

7. **Payment Method** (optional):
   - Text input
   - Examples: "Credit Card", "Bank Transfer", "Check", "Cash"

8. **Payment Date** (optional):
   - Date input
   - Only relevant if status is 'paid'

9. **Notes** (optional):
   - Textarea
   - Multi-line text

**Component Structure:**
```typescript
interface CreateInvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Uses:
// - useForm from react-hook-form
// - zodResolver from @hookform/resolvers
// - useCreateInvoice() hook
// - useOrdersList() hook (for order selection)
// - Drawer, Form, Input, Select, Textarea components
// - useToast for notifications
```

**Submit Handler:**
- Validate form with Zod
- Convert empty strings to null for optional fields
- Call `useCreateInvoice()` mutation
- Show loading state
- On success: show toast, reset form, close drawer
- On error: show error toast

**Purpose:** Create new invoices with full validation and order linking

---

## Task 5: Create EditInvoiceDrawer Component

**File:** `src/modules/invoicing/components/EditInvoiceDrawer.tsx`  
**Action:** CREATE

**Key Features:**
- React Hook Form with `zodResolver(invoiceFormSchema)`
- Pre-filled with existing invoice data
- Invoice number field is read-only (display only)
- Same form fields as Create drawer
- Submit button with loading state
- Toast notifications for success/error

**Form Fields:**
- Same as CreateInvoiceDrawer except:
  - **Invoice Number**: Read-only text display (not editable)
  - All other fields are editable

**Component Structure:**
```typescript
interface EditInvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice; // Pre-filled invoice data
}

// Uses:
// - useForm with defaultValues from invoice prop
// - zodResolver
// - useUpdateInvoice() hook
// - useOrdersList() hook (for order selection)
// - Same form structure as CreateInvoiceDrawer
```

**Form Initialization:**
- Use `useEffect` to reset form when invoice changes
- Map database fields to form fields
- Handle null values appropriately

**Submit Handler:**
- Validate form with Zod
- Convert empty strings to null for optional fields
- Call `useUpdateInvoice()` mutation with invoice id and updates
- Show loading state
- On success: show toast, close drawer
- On error: show error toast

**Purpose:** Edit existing invoices with validation (invoice number cannot be changed)

---

## Task 6: Create DeleteInvoiceDialog Component

**File:** `src/modules/invoicing/components/DeleteInvoiceDialog.tsx`  
**Action:** CREATE

**Key Features:**
- AlertDialog component from shadcn/ui
- Shows invoice number and customer name
- Warning message about permanent deletion
- Cancel and Delete buttons
- Loading state during deletion
- Toast notifications for success/error

**Component Structure:**
```typescript
interface DeleteInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}

// Uses:
// - AlertDialog component
// - useDeleteInvoice() hook
// - useToast for notifications
```

**Delete Handler:**
- Call `useDeleteInvoice()` mutation with invoice id
- Show loading state
- On success: show toast, close dialog
- On error: show error toast

**Dialog Content:**
- Title: "Are you sure?"
- Description: "This action cannot be undone. This will permanently delete invoice {invoice_number} for {customer_name}."
- Actions: Cancel (outline), Delete (destructive, red)

**Purpose:** Confirm and delete invoices with proper warning

---

## Task 7: Update InvoicingPage

**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`  
**Action:** UPDATE

**Changes:**

1. **Remove hardcoded data:**
   - Delete the `invoices` array (lines 15-49)
   - Remove static demo data

2. **Add data fetching:**
   - Import `useInvoicesList()` hook
   - Import `transformInvoicesForUI` from utils
   - Use `useMemo` to transform data
   - Handle `isLoading` and `error` states

3. **Add drawer/dialog state:**
   - `createDrawerOpen` state
   - `editDrawerOpen` state
   - `deleteDialogOpen` state
   - `invoiceToEdit` state (Invoice | null)
   - `invoiceToDelete` state (Invoice | null)

4. **Connect "Create Invoice" button:**
   - Change onClick to open CreateInvoiceDrawer
   - Set `createDrawerOpen` to true

5. **Add edit handler:**
   - `handleEditInvoice(invoice: UIInvoice)` function
   - Find original DB invoice by id
   - Set `invoiceToEdit` and open EditInvoiceDrawer

6. **Add delete handler:**
   - `handleDeleteInvoice(invoice: UIInvoice)` function
   - Find original DB invoice by id
   - Set `invoiceToDelete` and open DeleteInvoiceDialog

7. **Update table actions:**
   - Add Edit button to each row
   - Add Delete button to each row
   - Connect to edit/delete handlers

8. **Update filtering:**
   - Use `useMemo` for filtered invoices
   - Filter based on `activeTab` and `searchQuery`
   - Handle overdue status calculation

9. **Update stats calculation:**
   - Calculate from real data using `useMemo`
   - Handle loading/error states
   - Calculate totals from actual amounts
   - Count overdue invoices dynamically

10. **Add loading/error/empty states:**
    - Show loading spinner while fetching
    - Show error message on error
    - Show empty state when no invoices

11. **Add drawer/dialog components:**
    - Import CreateInvoiceDrawer, EditInvoiceDrawer, DeleteInvoiceDialog
    - Render with proper state management

**Updated Structure:**
```typescript
export const InvoicingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const { data: invoicesData, isLoading, error } = useInvoicesList();

  // Transform invoices from DB format to UI format
  const uiInvoices = useMemo(() => {
    if (!invoicesData) return [];
    return transformInvoicesForUI(invoicesData);
  }, [invoicesData]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    // Filter logic
  }, [uiInvoices, activeTab, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    // Stats calculation
  }, [uiInvoices]);

  // Handlers
  const handleEditInvoice = (invoice: UIInvoice) => { /* ... */ };
  const handleDeleteInvoice = (invoice: UIInvoice) => { /* ... */ };

  // Render with loading/error/empty states
  // Render drawers and dialogs
};
```

**Purpose:** Connect page to real data, add CRUD operations, maintain existing UI

---

## Task 8: Validate Build and Types

**Action:** VERIFY

**Checklist:**
- [ ] TypeScript compiles without errors
- [ ] No linter errors
- [ ] All imports use correct `@/` path aliases
- [ ] All components are properly exported
- [ ] No unused imports
- [ ] No broken type references
- [ ] Form validation works correctly
- [ ] Data transformation works correctly
- [ ] Query invalidation works correctly

**Validation Steps:**
1. Run `npm run build` (or `npm run type-check` if available)
2. Check for TypeScript errors
3. Check for ESLint errors
4. Verify all imports resolve correctly
5. Test form submission
6. Test data transformation
7. Test query invalidation

---

## Data Flow

### Load Invoices Flow
```
InvoicingPage mounts
  → useInvoicesList() query
  → fetchInvoices() API call
  → Supabase: SELECT * FROM invoices ORDER BY created_at DESC
  → Returns Invoice[] (DB format)
  → transformInvoicesForUI() transforms to UIInvoice[]
  → Display in table
  → Calculate stats from UIInvoice[]
```

### Create Invoice Flow
```
User clicks "Create Invoice"
  → CreateInvoiceDrawer opens
  → User fills form
  → User selects order (optional)
  → User submits form
  → Zod validation (invoiceFormSchema)
  → useCreateInvoice() mutation
  → createInvoice() API call
  → Generate invoice_number (if not provided)
  → Supabase: INSERT INTO invoices
  → Query invalidation (invoicesKeys.all)
  → useInvoicesList() refetches
  → UI updates automatically
  → Toast notification
  → Drawer closes
```

### Edit Invoice Flow
```
User clicks "Edit" on invoice row
  → EditInvoiceDrawer opens
  → Form pre-filled with invoice data
  → User modifies fields
  → User submits form
  → Zod validation
  → useUpdateInvoice() mutation
  → updateInvoice(id, updates) API call
  → Supabase: UPDATE invoices WHERE id = ?
  → Query invalidation (invoicesKeys.all + detail)
  → useInvoicesList() refetches
  → UI updates automatically
  → Toast notification
  → Drawer closes
```

### Delete Invoice Flow
```
User clicks "Delete" on invoice row
  → DeleteInvoiceDialog opens
  → Shows invoice number and customer name
  → User confirms deletion
  → useDeleteInvoice() mutation
  → deleteInvoice(id) API call
  → Supabase: DELETE FROM invoices WHERE id = ?
  → Query invalidation (invoicesKeys.all)
  → useInvoicesList() refetches
  → UI updates automatically
  → Toast notification
  → Dialog closes
```

---

## UI Integration Details

### Drawer Visibility State
- **CreateInvoiceDrawer**: Controlled by `createDrawerOpen` state
- **EditInvoiceDrawer**: Controlled by `editDrawerOpen` state, only renders if `invoiceToEdit` exists
- **DeleteInvoiceDialog**: Controlled by `deleteDialogOpen` state, only renders if `invoiceToDelete` exists

### Edit Action
- Add Edit button to each table row
- On click: Find original DB invoice, set `invoiceToEdit`, open EditInvoiceDrawer
- EditInvoiceDrawer receives `invoice` prop and pre-fills form

### Delete Action
- Add Delete button to each table row
- On click: Find original DB invoice, set `invoiceToDelete`, open DeleteInvoiceDialog
- DeleteInvoiceDialog receives `invoice` prop and shows confirmation

### Form Validation
- All forms use React Hook Form with Zod resolver
- Real-time validation feedback
- Submit button disabled when form is invalid
- Field-level error messages
- Custom validation: due_date >= issue_date

---

## Safety and Constraints

### Do Not Modify
- ❌ Orders module (only import `useOrdersList` hook)
- ❌ Database schema (no migrations)
- ❌ Existing invoice hooks (already implemented)
- ❌ Existing invoice API functions (only update `createInvoice` for number generation)
- ❌ Other modules

### Import Paths
- ✅ Use `@/shared/components/ui/*` for UI components
- ✅ Use `@/modules/invoicing/*` for invoicing module imports
- ✅ Use `@/modules/orders/hooks/useOrders` for order selection
- ✅ Use `@/shared/hooks/use-toast` for toast notifications

### UI Consistency
- ✅ Keep existing Tailwind classes
- ✅ Maintain card layouts and spacing
- ✅ Preserve color schemes and badges
- ✅ Keep responsive design
- ✅ Maintain table structure
- ✅ Keep existing button styles

### Type Safety
- ✅ Use TypeScript types from `invoicing.types.ts`
- ✅ Use `Invoice`, `InvoiceInsert`, `InvoiceUpdate` types
- ✅ Use `UIInvoice` interface for transformed data
- ✅ Proper type inference for form data

---

## Invoice Number Generation

### Database Sequence
- **Sequence name**: `invoice_number_seq`
- **Starts at**: 1001
- **Location**: `supabase/migrations/20250608000002_create_invoices_table.sql`

### Implementation Approach

**Option 1: Database Function (Recommended)**
Create a database function that formats the sequence value:
```sql
create or replace function public.get_next_invoice_number()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_num bigint;
begin
  next_num := nextval('public.invoice_number_seq');
  return 'INV-' || lpad(next_num::text, 6, '0');
end;
$$;
```

Then call it in the API:
```typescript
const { data: invoiceNumber, error } = await supabase
  .rpc('get_next_invoice_number');
```

**Option 2: Direct Sequence Call**
If RPC doesn't work, use a workaround with a simple incrementing number (not recommended for production but acceptable for Phase 1).

**For Phase 1:** Implement Option 1 if possible, otherwise use a simple sequential approach that ensures uniqueness.

---

## Final Checklist

### Build Validation
- [ ] `npm run build` completes without errors
- [ ] TypeScript compilation passes
- [ ] No type errors
- [ ] No import errors

### Component Exports
- [ ] CreateInvoiceDrawer exported correctly
- [ ] EditInvoiceDrawer exported correctly
- [ ] DeleteInvoiceDialog exported correctly
- [ ] All utilities exported correctly

### Imports
- [ ] No unused imports
- [ ] No broken imports
- [ ] All `@/` path aliases resolve correctly
- [ ] All relative imports are correct

### Functionality
- [ ] Invoices load from Supabase
- [ ] Create invoice works
- [ ] Edit invoice works
- [ ] Delete invoice works
- [ ] Invoice number auto-generates
- [ ] Order selection works
- [ ] Form validation works
- [ ] Query invalidation works
- [ ] UI updates automatically
- [ ] Toast notifications work
- [ ] Loading states work
- [ ] Error states work
- [ ] Empty states work
- [ ] Filtering works
- [ ] Search works
- [ ] Stats calculate correctly
- [ ] Overdue status calculates correctly

### Code Quality
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] Proper error handling
- [ ] Proper type safety
- [ ] Consistent code style

---

## Implementation Order

1. **Task 1**: Create invoice schema (foundation)
2. **Task 2**: Create transform utils (foundation)
3. **Task 3**: Update API for invoice number (foundation)
4. **Task 4**: Create CreateInvoiceDrawer (depends on 1-2)
5. **Task 5**: Create EditInvoiceDrawer (depends on 1-2)
6. **Task 6**: Create DeleteInvoiceDialog (independent)
7. **Task 7**: Update InvoicingPage (depends on 4-6)
8. **Task 8**: Validate build (depends on all)

**Parallel Execution:**
- Tasks 1, 2, 3 can run in parallel (foundation tasks)
- Tasks 4, 5, 6 can run in parallel after 1-2 complete
- Task 7 must wait for 4-6
- Task 8 must wait for all

---

## Files Summary

### New Files (5)
| File | Purpose |
|------|---------|
| `src/modules/invoicing/schemas/invoice.schema.ts` | Zod validation schema |
| `src/modules/invoicing/utils/invoiceTransform.ts` | Data transformation utilities |
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | Create invoice form drawer |
| `src/modules/invoicing/components/EditInvoiceDrawer.tsx` | Edit invoice form drawer |
| `src/modules/invoicing/components/DeleteInvoiceDialog.tsx` | Delete confirmation dialog |

### Modified Files (2)
| File | Changes |
|------|---------|
| `src/modules/invoicing/pages/InvoicingPage.tsx` | Replace demo data, add CRUD integration, add drawer/dialog state |
| `src/modules/invoicing/api/invoicing.api.ts` | Add invoice number generation logic |

### Optional Database Migration (1)
| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHmmss_add_invoice_number_function.sql` | Create `get_next_invoice_number()` function (if using Option 1) |

### No Changes Needed
- All CRUD hooks already implemented ✅
- TanStack Query setup already complete ✅
- Invoice types already defined ✅

---

## Success Criteria

1. ✅ All invoices load from Supabase using `useInvoicesList()`
2. ✅ Create invoice works with auto-generated invoice number
3. ✅ Edit invoice works with read-only invoice number
4. ✅ Delete invoice works with confirmation
5. ✅ All mutations update UI automatically via query invalidation
6. ✅ Filtering tabs work correctly (All, Pending, Overdue, Paid)
7. ✅ Search functionality works
8. ✅ Stats calculate from real data
9. ✅ Overdue status calculates correctly
10. ✅ Toast notifications work for all operations
11. ✅ Loading and error states work
12. ✅ Empty state shows when no invoices
13. ✅ Order selection works in create/edit forms
14. ✅ Form validation works correctly
15. ✅ Existing UI styling maintained

