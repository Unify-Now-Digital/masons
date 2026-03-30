# Invoicing CRUD Integration Specification

## Overview

Connect `InvoicingPage.tsx` to real Supabase data by:
1. Replacing hardcoded demo data with live data from `useInvoicesList()`
2. Adding Create Invoice Drawer with React Hook Form + Zod validation
3. Adding Edit Invoice Drawer with React Hook Form + Zod validation
4. Adding Delete Invoice action with confirmation dialog
5. Ensuring TanStack Query automatically invalidates and updates UI
6. Maintaining existing UI styling and layout

**No workflow automation, no external integrations, no PDF generation** - pure CRUD operations only.

---

## Current State Analysis

### InvoicingPage.tsx
- **Status**: Uses hardcoded `invoices` array (lines 15-49)
- **Data Source**: Static demo data with camelCase properties
- **Hooks**: `useInvoicesList()`, `useInvoice()`, `useCreateInvoice()`, `useUpdateInvoice()`, `useDeleteInvoice()` already exist
- **UI Components**: Uses Table component directly
- **Actions**: "Create Invoice" button exists but doesn't open drawer
- **Filtering**: Tabs exist (All, Pending, Overdue, Paid) but filter static data
- **Stats**: Calculated from static data

### Database Schema (invoices table)
- **Fields**: Uses snake_case (invoice_number, customer_name, amount, status, due_date, etc.)
- **Types**: 
  - `amount`: decimal(10,2)
  - `status`: enum ('draft', 'pending', 'paid', 'overdue', 'cancelled')
  - `invoice_number`: text (unique, not null) - auto-generated via sequence
  - `order_id`: uuid (nullable, references orders table)
- **Sequence**: `invoice_number_seq` starts at 1001
- **ID**: UUID (not "INV-001" format)

### Type Mismatch
**Demo Data Format:**
```typescript
{
  id: "INV-001",              // String ID
  orderId: "ORD-001",         // camelCase
  customer: "John Smith",     // camelCase
  amount: "$2,500.00",        // String with currency
  status: "paid",             // lowercase
  dueDate: "2025-06-01",      // camelCase
  issueDate: "2025-05-15",    // camelCase
  paymentMethod: "Credit Card", // camelCase
  daysOverdue: 0              // Calculated field
}
```

**Database Format:**
```typescript
{
  id: "uuid-string",          // UUID
  order_id: "uuid-string" | null,  // snake_case, nullable
  invoice_number: "1001",     // String from sequence
  customer_name: "John Smith", // snake_case
  amount: 2500.00,            // Decimal number
  status: "paid",             // enum value
  due_date: "2025-06-01",     // snake_case, date string
  issue_date: "2025-05-15",   // snake_case, date string
  payment_method: "Credit Card" | null, // snake_case, nullable
  payment_date: "2025-06-01" | null,   // snake_case, nullable
  notes: string | null,       // nullable
  created_at: string,          // timestamp
  updated_at: string          // timestamp
}
```

### Existing Hooks
- ✅ `useInvoicesList()` - Already implemented
- ✅ `useInvoice(id)` - Already implemented
- ✅ `useCreateInvoice()` - Already implemented with query invalidation
- ✅ `useUpdateInvoice()` - Already implemented with query invalidation
- ✅ `useDeleteInvoice()` - Already implemented with query invalidation

### Existing API Functions
- ✅ `fetchInvoices()` - Already implemented
- ✅ `fetchInvoice(id)` - Already implemented
- ✅ `createInvoice(invoice)` - Already implemented
- ✅ `updateInvoice(id, updates)` - Already implemented
- ✅ `deleteInvoice(id)` - Already implemented

### Available UI Components
- ✅ `Drawer` - Available in `@/shared/components/ui/drawer`
- ✅ `AlertDialog` - Available in `@/shared/components/ui/alert-dialog` (for delete confirmation)
- ✅ `Form` - Available in `@/shared/components/ui/form` (React Hook Form integration)
- ✅ `Input`, `Select`, `Textarea`, `Button`, `Table`, `Badge`, etc. - All available

### Dependencies
- ✅ `react-hook-form` - Already installed
- ✅ `zod` - Already installed
- ✅ `@hookform/resolvers` - Already installed

---

## Target State

### Data Flow
1. **Load**: `useInvoicesList()` → Fetches from Supabase → Transforms to UI format
2. **Create**: Form submission → Generate invoice_number → `useCreateInvoice()` → Supabase insert → Query invalidation → UI updates
3. **Update**: Form submission → `useUpdateInvoice()` → Supabase update → Query invalidation → UI updates
4. **Delete**: Confirmation → `useDeleteInvoice()` → Supabase delete → Query invalidation → UI updates

### UI Components to Create
1. **CreateInvoiceDrawer** - Full form with validation, order selection, auto invoice number
2. **EditInvoiceDrawer** - Pre-filled form with validation (invoice_number read-only)
3. **DeleteInvoiceDialog** - Confirmation dialog

### Data Transformation
- **Database → UI**: Transform snake_case to camelCase for display
- **UI → Database**: Transform camelCase to snake_case for submission
- **Amount Format**: Convert between number (DB) and formatted string (UI) for display
- **Status Calculation**: Calculate "overdue" status based on due_date vs current date

---

## Files to Create

### 1. Create Invoice Drawer

**`src/modules/invoicing/components/CreateInvoiceDrawer.tsx`**

Features:
- React Hook Form with Zod validation
- All required fields from `InvoiceInsert` type
- Auto-generate invoice_number using sequence (call backend function or use nextval)
- Order selection dropdown (fetch orders using `useOrdersList()`)
- Date pickers for due_date and issue_date
- Select dropdown for status enum
- Number input for amount (stored as decimal)
- Text inputs for customer_name, payment_method
- Textarea for notes
- Submit button triggers `useCreateInvoice()` mutation
- Loading state during submission
- Error handling with toast notifications
- Closes drawer on success
- Invalidates queries automatically (via hook)

**Invoice Number Generation:**
- Option 1: Call Supabase function that uses `nextval('invoice_number_seq')`
- Option 2: Use database default with trigger (if implemented)
- Option 3: Generate in API layer before insert

### 2. Edit Invoice Drawer

**`src/modules/invoicing/components/EditInvoiceDrawer.tsx`**

Features:
- React Hook Form with Zod validation
- Pre-filled with existing invoice data
- Invoice number field is read-only (display only)
- Same fields as Create drawer (except invoice_number)
- Order selection dropdown (pre-selected if order_id exists)
- Submit button triggers `useUpdateInvoice()` mutation
- Loading state during submission
- Error handling with toast notifications
- Closes drawer on success
- Invalidates queries automatically (via hook)

### 3. Delete Invoice Dialog

**`src/modules/invoicing/components/DeleteInvoiceDialog.tsx`**

Features:
- Confirmation dialog (AlertDialog component)
- Shows invoice number and customer name
- Warning message about permanent deletion
- Cancel and Delete buttons
- Delete button triggers `useDeleteInvoice()` mutation
- Loading state during deletion
- Error handling with toast notifications
- Closes dialog on success
- Invalidates queries automatically (via hook)

### 4. Invoice Form Schema

**`src/modules/invoicing/schemas/invoice.schema.ts`**

Zod schema for validation:
- All required fields (customer_name, amount, status, due_date)
- Optional fields marked correctly (order_id, payment_method, notes, payment_date)
- Type validation (strings, numbers, dates, enums)
- Custom validations (e.g., amount > 0, due_date >= issue_date)

### 5. Invoice Transform Utilities

**`src/modules/invoicing/utils/invoiceTransform.ts`**

Helper functions:
- `transformInvoiceForUI(invoice: Invoice): UIInvoice` - Convert DB format to UI format
- `transformInvoicesForUI(invoices: Invoice[]): UIInvoice[]` - Transform array
- Calculate overdue status based on due_date
- Format amount as currency string
- Format dates for display

---

## Files to Modify

### 1. InvoicingPage.tsx

**Changes:**
1. Remove hardcoded `invoices` array
2. Use `useInvoicesList()` hook
3. Add loading state handling
4. Add error state handling
5. Add empty state handling
6. Transform database data to UI format (snake_case → camelCase)
7. Connect "Create Invoice" button to open CreateInvoiceDrawer
8. Add edit handler to open EditInvoiceDrawer
9. Add delete handler using DeleteInvoiceDialog
10. Update stats calculation to use real data
11. Update filtering tabs to work with real data
12. Calculate overdue status dynamically
13. Update search functionality to work with real data

**Data Transformation Helper:**
```typescript
interface UIInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customer: string;
  amount: string; // Formatted currency
  status: string;
  dueDate: string;
  issueDate: string;
  paymentMethod: string | null;
  paymentDate: string | null;
  notes: string | null;
  daysOverdue: number; // Calculated
}

function transformInvoiceForUI(invoice: Invoice): UIInvoice {
  const today = new Date();
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const daysOverdue = dueDate && dueDate < today 
    ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Calculate status: if pending and overdue, show as overdue
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
```

### 2. invoicing.api.ts (if needed)

**Potential Changes:**
- Add function to generate next invoice number using sequence
- Or handle invoice number generation in `createInvoice()` function

**Invoice Number Generation Function:**
```typescript
export async function generateInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_invoice_number');
  if (error) throw error;
  return data.toString();
}
```

**Or in createInvoice:**
```typescript
export async function createInvoice(invoice: InvoiceInsert) {
  // If invoice_number not provided, generate it
  if (!invoice.invoice_number) {
    const { data: seqData, error: seqError } = await supabase
      .rpc('get_next_invoice_number');
    if (seqError) throw seqError;
    invoice.invoice_number = seqData.toString();
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

---

## Zod Schema Definition

### Invoice Form Schema

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

**Note:** `invoice_number` is NOT in the schema - it's auto-generated by the backend.

---

## Component Structure

### CreateInvoiceDrawer
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
// - Drawer component
// - Form components (FormField, FormItem, FormLabel, FormControl, FormMessage)
// - Input, Select, Textarea components
// - useToast for notifications
```

### EditInvoiceDrawer
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
// - Invoice number field is read-only
```

### DeleteInvoiceDialog
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

---

## Data Transformation Requirements

### Database → UI Display
- `invoice_number` → `invoiceNumber`
- `order_id` → `orderId`
- `customer_name` → `customer`
- `amount` (number) → `amount` (formatted string like "$2,500.00")
- `due_date` → `dueDate`
- `issue_date` → `issueDate`
- `payment_method` → `paymentMethod`
- `payment_date` → `paymentDate`
- Calculate `daysOverdue` from due_date
- Calculate display `status` (if pending and overdue, show as overdue)

### UI Form → Database
- Form data uses database field names (snake_case)
- Zod schema validates database format
- Direct submission to API (no transformation needed)
- Invoice number auto-generated if not provided

### Stats Calculation
- Calculate from real data array
- Handle loading/error states
- Use transformed UI format for filtering
- Calculate totals from actual amounts
- Count overdue invoices dynamically

---

## TanStack Query Integration

### Query Invalidation
All mutations already handle invalidation:
- `useCreateInvoice()` → Invalidates `invoicesKeys.all`
- `useUpdateInvoice()` → Invalidates `invoicesKeys.all` + updates detail cache
- `useDeleteInvoice()` → Invalidates `invoicesKeys.all`

### Loading States
- `useInvoicesList()` provides `isLoading` and `isError`
- Mutations provide `isPending` for submit buttons
- Show loading skeletons/spinners during fetch
- Show empty state when no invoices

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
- Maintain table structure

### Form Validation
- Real-time validation with React Hook Form
- Show field errors below inputs
- Disable submit button when form is invalid
- Show loading state on submit button
- Validate due_date >= issue_date

### User Feedback
- Toast notifications for success/error
- Loading indicators during mutations
- Clear error messages
- Empty state message when no invoices

### Drawer Behavior
- Opens from "Create Invoice" button
- Closes on successful submission
- Closes on cancel/outside click
- Prevents closing during submission (optional)

### Status Display
- Show "overdue" badge if invoice is pending and past due date
- Calculate days overdue dynamically
- Color code status badges (green for paid, yellow for pending, red for overdue)

---

## Field Mappings

### Required Fields
- `customer_name` (text input)
- `amount` (number input, decimal)
- `status` (select dropdown, default: 'pending')
- `due_date` (date picker)

### Optional Fields
- `order_id` (select dropdown - fetch from orders)
- `issue_date` (date picker, default: today)
- `payment_method` (text input or select)
- `payment_date` (date picker)
- `notes` (textarea)

### Auto-Generated Fields
- `invoice_number` (generated from sequence, not in form)
- `id` (UUID, auto-generated)
- `created_at`, `updated_at` (auto-managed by database)

### Enum Fields (Select dropdown)
- `status`: ['draft', 'pending', 'paid', 'overdue', 'cancelled']
  - Default: 'pending'
  - Note: 'overdue' is calculated, not stored

### Date Fields (Date pickers)
- `issue_date` (default: today)
- `due_date` (required, must be >= issue_date)
- `payment_date` (optional, only if paid)

### Calculated Fields (Not in form)
- `daysOverdue` - Calculated from due_date vs today
- Display status - If pending and overdue, show as overdue

---

## Invoice Number Generation

### Database Sequence
- Sequence name: `invoice_number_seq`
- Starts at: 1001
- Located in: `supabase/migrations/20250608000002_create_invoices_table.sql`

### Implementation Options

**Option 1: Database Function (Recommended)**
Create a database function that returns the next invoice number:
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

**Option 2: Direct Sequence Call**
```typescript
// Get next value from sequence
const { data: seqData, error: seqError } = await supabase
  .rpc('nextval', { sequence_name: 'invoice_number_seq' });
// Format as INV-000001
```

**Option 3: Client-Side Generation (Not Recommended)**
Generate in frontend, but risk of collisions.

---

## Order Selection

### Fetching Orders
- Use `useOrdersList()` hook from orders module
- Display orders in dropdown with customer name and order ID
- Allow "No Order" option (null)
- Pre-select order if editing invoice with existing order_id

### Display Format
```typescript
<Select>
  <SelectItem value="">No Order</SelectItem>
  {orders.map(order => (
    <SelectItem key={order.id} value={order.id}>
      {order.customer_name} - {order.id.substring(0, 8)}...
    </SelectItem>
  ))}
</Select>
```

---

## Validation Checklist

After implementation, verify:

- [ ] Invoices load from Supabase using `useInvoicesList()`
- [ ] Loading state shows while fetching
- [ ] Error state handles failures gracefully
- [ ] Empty state shows when no invoices
- [ ] Create Invoice Drawer opens from button
- [ ] Invoice number auto-generates on create
- [ ] Order selection dropdown works
- [ ] Create form validates with Zod
- [ ] Create submission works and updates UI
- [ ] Edit Invoice Drawer opens from table
- [ ] Edit form pre-fills with invoice data
- [ ] Invoice number is read-only in edit form
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
- [ ] Overdue status calculates correctly
- [ ] Days overdue displays correctly
- [ ] Amount formatting displays correctly

---

## Out of Scope

The following are explicitly NOT included:

- Stripe payment integration
- PDF generation
- Email sending
- Workflow automation
- Invoice templates
- Bulk operations
- Advanced reporting
- Payment reminders
- Recurring invoices
- Invoice approval workflows
- Multi-currency support
- Tax calculations

---

## Implementation Notes

1. **Invoice Number Generation**: Use database function or RPC call to get next sequence value
2. **Status Calculation**: Calculate "overdue" dynamically - don't store it, derive from due_date
3. **Data Transformation**: Create helper functions to transform between DB and UI formats
4. **Form Defaults**: Use sensible defaults (status: 'pending', issue_date: today)
5. **Date Handling**: Use date strings (YYYY-MM-DD) for date inputs
6. **Amount Formatting**: Display as currency string, store as decimal number
7. **Error Messages**: Use Supabase error messages, provide fallback for network errors
8. **Loading States**: Show spinners/skeletons, disable buttons during mutations
9. **Query Keys**: Use existing `invoicesKeys` from hooks file
10. **Type Safety**: Use TypeScript types from `invoicing.types.ts`
11. **Order Selection**: Fetch orders using `useOrdersList()` from orders module
12. **Overdue Logic**: If status is 'pending' and due_date < today, display as 'overdue'

---

## Files Summary

### New Files (5)
| File | Purpose |
|------|---------|
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | Create invoice form drawer |
| `src/modules/invoicing/components/EditInvoiceDrawer.tsx` | Edit invoice form drawer |
| `src/modules/invoicing/components/DeleteInvoiceDialog.tsx` | Delete confirmation dialog |
| `src/modules/invoicing/schemas/invoice.schema.ts` | Zod validation schema |
| `src/modules/invoicing/utils/invoiceTransform.ts` | Data transformation utilities |

### Modified Files (2)
| File | Changes |
|------|---------|
| `src/modules/invoicing/pages/InvoicingPage.tsx` | Replace demo data with `useInvoicesList()`, add drawer/dialog state, transform data |
| `src/modules/invoicing/api/invoicing.api.ts` | Add invoice number generation logic (if using Option 1) |

### Database Migration (Optional)
| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHmmss_add_invoice_number_function.sql` | Create `get_next_invoice_number()` function (if using Option 1) |

### No Changes Needed
- All CRUD hooks already implemented ✅
- All API functions already implemented ✅
- TanStack Query setup already complete ✅
- Invoice types already defined ✅

---

## Data Flow Diagrams

### Create Invoice Flow
```
User clicks "Create Invoice"
  → CreateInvoiceDrawer opens
  → User fills form
  → User selects order (optional)
  → User submits form
  → Zod validation
  → Generate invoice_number (via RPC or function)
  → useCreateInvoice() mutation
  → Supabase insert
  → Query invalidation
  → UI updates automatically
  → Toast notification
  → Drawer closes
```

### Edit Invoice Flow
```
User clicks "Edit" on invoice row
  → EditInvoiceDrawer opens with invoice data
  → Form pre-filled (invoice_number read-only)
  → User modifies fields
  → User submits form
  → Zod validation
  → useUpdateInvoice() mutation
  → Supabase update
  → Query invalidation
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
  → Supabase delete
  → Query invalidation
  → UI updates automatically
  → Toast notification
  → Dialog closes
```

### Load Invoices Flow
```
InvoicingPage mounts
  → useInvoicesList() query
  → Supabase fetch
  → Transform to UI format
  → Calculate overdue status
  → Display in table
  → Calculate stats
  → Apply filters/tabs
```

---

## Safety Constraints

1. **Invoice Number Uniqueness**: Ensure sequence-based generation prevents duplicates
2. **Order Reference**: Validate order_id exists if provided
3. **Date Validation**: Ensure due_date >= issue_date
4. **Amount Validation**: Ensure amount > 0
5. **Status Consistency**: Don't allow setting status to 'overdue' manually (it's calculated)
6. **Payment Date**: Only allow payment_date if status is 'paid'
7. **Read-Only Fields**: Invoice number must be read-only in edit form
8. **Error Handling**: Gracefully handle network errors, validation errors, and Supabase errors
9. **Loading States**: Prevent multiple submissions during pending mutations
10. **Query Invalidation**: Ensure all mutations properly invalidate queries

---

## Success Criteria

1. ✅ All invoices load from Supabase
2. ✅ Create invoice works with auto-generated invoice number
3. ✅ Edit invoice works with read-only invoice number
4. ✅ Delete invoice works with confirmation
5. ✅ All mutations update UI automatically
6. ✅ Filtering tabs work correctly
7. ✅ Search functionality works
8. ✅ Stats calculate from real data
9. ✅ Overdue status calculates correctly
10. ✅ Toast notifications work
11. ✅ Loading and error states work
12. ✅ Existing UI styling maintained

