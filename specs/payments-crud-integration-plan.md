# Implementation Plan: Payments Module (Phase 1)

**Branch:** `feature/payments-crud-integration`  
**Specification:** `specs/payments-crud-integration-plan.md`

---

## Overview

Create a new Payments CRUD module for managing payment records. Each Payment MUST belong to an Invoice (`invoice_id` is required). Follow the exact patterns used in the Orders, Invoicing, Customers, Companies, Jobs, Memorials, and Inscriptions modules.

**Database Schema:** Already created in Supabase - `public.payments` table exists with all required fields.

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create payment schema | Create | `src/modules/payments/schemas/payment.schema.ts` | High | None |
| 2 | Create data transform utils | Create | `src/modules/payments/utils/paymentTransform.ts` | High | None |
| 3 | Create CRUD hooks | Create | `src/modules/payments/hooks/usePayments.ts` | High | None |
| 4 | Create CreatePaymentDrawer | Create | `src/modules/payments/components/CreatePaymentDrawer.tsx` | High | Tasks 1-3 |
| 5 | Create EditPaymentDrawer | Create | `src/modules/payments/components/EditPaymentDrawer.tsx` | High | Tasks 1-3 |
| 6 | Create DeletePaymentDialog | Create | `src/modules/payments/components/DeletePaymentDialog.tsx` | High | Task 3 |
| 7 | Build PaymentsPage | Create | `src/modules/payments/pages/PaymentsPage.tsx` | High | Tasks 1-6 |
| 8 | Add module barrel | Create | `src/modules/payments/index.ts` | Medium | Tasks 1-7 |
| 9 | Update router | Update | `src/app/router.tsx` | High | Task 8 |
| 10 | Update sidebar nav | Update | `src/app/layout/AppSidebar.tsx` | High | Task 8 |
| 11 | Validate build & lint | Verify | - | High | Tasks 1-10 |

---

## Task 1: Create Payment Schema

**File:** `src/modules/payments/schemas/payment.schema.ts`  
**Action:** CREATE

**Content requirements:**
- Export `paymentFormSchema` using Zod.
- Required fields:
  - `invoiceId` (required, UUID string) - MUST belong to an Invoice
  - `amount` (required, number, must be > 0)
  - `date` (required, string date format YYYY-MM-DD)
  - `method` (required enum: 'cash' | 'card' | 'bank_transfer' | 'check' | 'online' | 'other')
- Optional fields:
  - `reference` (optional, trimmed string or null)
  - `notes` (optional, trimmed string or null)
- Allow empty string for optional string fields via `.optional().or(z.literal(''))`.
- Export `PaymentFormData = z.infer<typeof paymentFormSchema>`.

**Schema Definition:**
```typescript
import { z } from 'zod';

export const paymentFormSchema = z.object({
  invoiceId: z.string().uuid('Invoice is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'online', 'other'], {
    errorMap: () => ({ message: 'Payment method is required' }),
  }),
  reference: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type PaymentFormData = z.infer<typeof paymentFormSchema>;
```

**Key Points:**
- `invoiceId` is REQUIRED (UUID) - payment MUST belong to an Invoice
- `amount` must be a positive number (> 0)
- `date` is required string (YYYY-MM-DD format)
- `method` is required enum with 6 options
- Optional string fields allow empty strings (normalized to `null` in transforms)

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/payments/utils/paymentTransform.ts`  
**Action:** CREATE

**Requirements:**
- Define `UIPayment` interface (camelCase) with all fields in camelCase format.
- Export functions:
  - `transformPaymentFromDb(payment)` → camelCase fields (`invoice_id` → `invoiceId`, `created_at` → `createdAt`, etc.).
  - `transformPaymentsFromDb(payments)` → array map wrapper.
  - `toPaymentInsert(form: PaymentFormData)` → snake_case payload for Supabase insert (omit id/timestamps, normalize empty strings to `null` for optional fields, convert dates to ISO format).
  - `toPaymentUpdate(form: PaymentFormData)` → partial update payload with same normalization.
- Keep helpers pure; no Supabase imports.

**UIPayment Interface:**
```typescript
export interface UIPayment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'bank_transfer' | 'check' | 'online' | 'other';
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Transform Functions:**
```typescript
import type { Payment, PaymentInsert, PaymentUpdate } from '../hooks/usePayments';
import type { PaymentFormData } from '../schemas/payment.schema';

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export function transformPaymentFromDb(payment: Payment): UIPayment {
  return {
    id: payment.id,
    invoiceId: payment.invoice_id,
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    reference: payment.reference || null,
    notes: payment.notes || null,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  };
}

export function transformPaymentsFromDb(payments: Payment[]): UIPayment[] {
  return payments.map(transformPaymentFromDb);
}

export function toPaymentInsert(form: PaymentFormData): PaymentInsert {
  return {
    invoice_id: form.invoiceId,
    amount: form.amount,
    date: form.date,
    method: form.method,
    reference: normalizeOptional(form.reference),
    notes: normalizeOptional(form.notes),
  };
}

export function toPaymentUpdate(form: PaymentFormData): PaymentUpdate {
  return {
    invoice_id: form.invoiceId,
    amount: form.amount,
    date: form.date,
    method: form.method,
    reference: normalizeOptional(form.reference),
    notes: normalizeOptional(form.notes),
  };
}
```

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/payments/hooks/usePayments.ts`  
**Action:** CREATE

**Requirements:**
- Use TanStack Query + Supabase client from `@/shared/lib/supabase`.
- Define query keys: 
  ```typescript
  paymentsKeys = {
    all: ['payments'] as const,
    byInvoice: (invoiceId: string) => ['payments', 'invoice', invoiceId] as const,
    detail: (id: string) => ['payments', id] as const,
  }
  ```
- Implement hooks:
  - `usePaymentsList(invoiceId?: string)` → 
    - If `invoiceId` provided: fetch payments filtered by `invoice_id = invoiceId`, ordered by `date DESC`.
    - If not provided: fetch all payments, ordered by `date DESC`.
  - `usePayment(id)` → fetch single (enabled when truthy).
  - `useCreatePayment()` → insert via Supabase; on success invalidate `paymentsKeys.all` and optionally `paymentsKeys.byInvoice(invoiceId)` if invoiceId is known.
  - `useUpdatePayment()` → update by id; on success invalidate list + set detail cache + invalidate byInvoice.
  - `useDeletePayment()` → delete by id; on success invalidate list.
- Shape Supabase interactions similar to orders/jobs API (throw on error, return typed rows).
- Types: create local `Payment`/`PaymentInsert`/`PaymentUpdate` matching DB shape; export them for component use.

**Database Types:**
```typescript
export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  date: string;
  method: 'cash' | 'card' | 'bank_transfer' | 'check' | 'online' | 'other';
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'updated_at'>;
export type PaymentUpdate = Partial<PaymentInsert>;
```

**Hook Implementation:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export const paymentsKeys = {
  all: ['payments'] as const,
  byInvoice: (invoiceId: string) => ['payments', 'invoice', invoiceId] as const,
  detail: (id: string) => ['payments', id] as const,
};

async function fetchPayments(invoiceId?: string) {
  let query = supabase
    .from('payments')
    .select('*')
    .order('date', { ascending: false });
  
  if (invoiceId) {
    query = query.eq('invoice_id', invoiceId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as Payment[];
}

async function fetchPayment(id: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Payment;
}

async function createPayment(payment: PaymentInsert) {
  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single();
  
  if (error) {
    throw new Error(error.message || 'Failed to create payment');
  }
  return data as Payment;
}

async function updatePayment(id: string, updates: PaymentUpdate) {
  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Payment;
}

async function deletePayment(id: string) {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function usePaymentsList(invoiceId?: string) {
  return useQuery({
    queryKey: invoiceId ? paymentsKeys.byInvoice(invoiceId) : paymentsKeys.all,
    queryFn: () => fetchPayments(invoiceId),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: paymentsKeys.detail(id),
    queryFn: () => fetchPayment(id),
    enabled: !!id,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payment: PaymentInsert) => createPayment(payment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentsKeys.byInvoice(data.invoice_id) });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PaymentUpdate }) => 
      updatePayment(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentsKeys.byInvoice(data.invoice_id) });
      queryClient.setQueryData(paymentsKeys.detail(data.id), data);
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
    },
  });
}
```

---

## Task 4: Create CreatePaymentDrawer Component

**File:** `src/modules/payments/components/CreatePaymentDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Drawer UI from shared components; React Hook Form with `zodResolver(paymentFormSchema)`.
- Invoice dropdown:
  - Load invoices from `useInvoicesList()` hook (from Invoicing module).
  - Display format: "Invoice Number – Customer Name" (e.g., "INV-001 - John Smith").
  - `invoiceId` is required.
  - When invoice is selected, optionally auto-fill amount from invoice total (if available).
- Fields organized in sections:
  - **Required Fields:**
    - Invoice* (Select dropdown - required)
    - Amount* (Number input - required, must be > 0)
    - Date* (Date picker - required)
    - Method* (Select - required: cash, card, bank_transfer, check, online, other)
  - **Optional Fields:**
    - Reference (Input - optional, e.g., check number, transaction ID)
    - Notes (Textarea - optional)
- Submit calls `useCreatePayment`; use `toPaymentInsert` for payload.
- Toast success/error; close on success; show loading state.
- Props: `open`, `onOpenChange`.

**Invoice Display Format:**
```typescript
{invoice.invoice_number} - {invoice.customer_name || 'Unknown Customer'}
```

**Auto-fill Amount (Optional):**
```typescript
// When invoice is selected, optionally set amount from invoice total
useEffect(() => {
  if (selectedInvoice && open) {
    if (selectedInvoice.total) {
      form.setValue('amount', selectedInvoice.total);
    }
  }
}, [selectedInvoice, open, form]);
```

---

## Task 5: Create EditPaymentDrawer Component

**File:** `src/modules/payments/components/EditPaymentDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Same form + validation as Create drawer, prefilled from `payment` prop (DB shape).
- Transform DB payment to form data using transform utilities.
- Pre-fill all fields including dates (convert date strings to form format).
- Submit uses `useUpdatePayment`; payload via `toPaymentUpdate`.
- Toast success/error; close on success.
- Props: `open`, `onOpenChange`, `payment: Payment`.

**Form Pre-fill:**
```typescript
const form = useForm<PaymentFormData>({
  resolver: zodResolver(paymentFormSchema),
  defaultValues: {
    invoiceId: payment.invoice_id,
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    reference: payment.reference || '',
    notes: payment.notes || '',
  },
});
```

---

## Task 6: Create DeletePaymentDialog Component

**File:** `src/modules/payments/components/DeletePaymentDialog.tsx`  
**Action:** CREATE

**Key features:**
- AlertDialog UI with confirmation copy including payment amount, date, and method.
- Uses `useDeletePayment`; loading state on destructive button; toast success/error.
- Props: `open`, `onOpenChange`, `payment: Payment`.

**Dialog Content:**
```typescript
<AlertDialogDescription>
  Are you sure you want to delete this payment?
  <br />
  <br />
  <strong>Amount:</strong> ${payment.amount.toFixed(2)}
  <br />
  <strong>Date:</strong> {format(new Date(payment.date), 'PPP')}
  <br />
  <strong>Method:</strong> {payment.method}
  <br />
  <br />
  This action cannot be undone.
</AlertDialogDescription>
```

---

## Task 7: Build PaymentsPage

**File:** `src/modules/payments/pages/PaymentsPage.tsx`  
**Action:** CREATE

**Requirements:**
- Fetch data with `usePaymentsList()` (no invoiceId filter for main page); transform via `transformPaymentsFromDb`.
- UI sections:
  - Header with title "Payments" + description "Manage payment records for invoices".
  - Actions:
    - Search input filtering by invoice number, customer name, reference, and notes.
    - Method filter dropdown: all / cash / card / bank_transfer / check / online / other.
    - Button "New Payment" opens Create drawer.
  - Table listing payments (similar styling to Orders/Invoices table) with columns:
    - Date (formatted, sortable)
    - Invoice Number (with link to invoice if available)
    - Customer Name (from invoice)
    - Amount (formatted as currency, sortable)
    - Method (badge with color coding)
    - Reference (if available)
    - Notes (truncated if long)
    - Actions (Edit, Delete)
  - Row actions: Edit → opens Edit drawer with selected payment; Delete → opens dialog.
- States:
  - Loading skeleton for table.
  - Empty state with CTA to create.
  - Error state with message + retry button (refetch).
- Toast on mutations handled in drawers/dialog.
- Keep module-local state for drawer/dialog open + selected payment.

**Search Filter Logic:**
```typescript
const filteredPayments = useMemo(() => {
  if (!payments) return [];
  
  let filtered = payments;
  
  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(query)) ||
        (p.customerName && p.customerName.toLowerCase().includes(query)) ||
        (p.reference && p.reference.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query))
    );
  }
  
  // Method filter
  if (methodFilter !== 'all') {
    filtered = filtered.filter((p) => p.method === methodFilter);
  }
  
  return filtered;
}, [payments, searchQuery, methodFilter]);
```

**Method Badge Colors:**
```typescript
const methodColors: Record<string, string> = {
  cash: 'bg-green-500',
  card: 'bg-blue-500',
  bank_transfer: 'bg-purple-500',
  check: 'bg-yellow-500',
  online: 'bg-indigo-500',
  other: 'bg-gray-500',
};
```

**Amount Formatting:**
```typescript
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
};
```

**Note:** For Phase 1, invoice number and customer name should be fetched via join or separate query. If not available, show invoice ID.

---

## Task 8: Add Module Barrel

**File:** `src/modules/payments/index.ts`  
**Action:** CREATE

**Exports:**
- `PaymentsPage` from pages.
- Components: `CreatePaymentDrawer`, `EditPaymentDrawer`, `DeletePaymentDialog`.
- Hooks and types if required externally.

```typescript
export { PaymentsPage } from './pages/PaymentsPage';
export { CreatePaymentDrawer } from './components/CreatePaymentDrawer';
export { EditPaymentDrawer } from './components/EditPaymentDrawer';
export { DeletePaymentDialog } from './components/DeletePaymentDialog';
export { usePaymentsList, usePayment, useCreatePayment, useUpdatePayment, useDeletePayment } from './hooks/usePayments';
export type { Payment, PaymentInsert, PaymentUpdate } from './hooks/usePayments';
export type { UIPayment } from './utils/paymentTransform';
```

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add route under `/dashboard`:
```tsx
import { PaymentsPage } from "@/modules/payments";
...
<Route path="payments" element={<PaymentsPage />} />
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:
- Title: "Payments"
- URL: `/dashboard/payments`
- Icon: `CreditCard` (lucide-react)
- Position: under operational section, near Invoicing.

**Icon Import:**
```tsx
import { CreditCard } from 'lucide-react';
```

**Navigation Item:**
```tsx
{ title: "Payments", url: "/dashboard/payments", icon: CreditCard },
```

---

## Task 11: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors).
- Manual flows:
  - Create payment → appears in list; drawer closes; toast shows.
  - Edit payment → changes reflected; drawer closes; toast shows.
  - Delete payment → removed from list; dialog closes; toast shows.
  - Search/filter covers invoice number, customer name, reference, notes; empty state renders when no results.
  - Method filter works correctly.
  - Invoice dropdown loads and displays correctly.
  - Amount auto-fill works when invoice selected (optional).
  - Date fields format correctly (display and save).
  - Amount validation works (rejects <= 0).
  - Navigation link and route render without console errors.

---

## Target File Tree

```
src/modules/payments/
├── components/
│   ├── CreatePaymentDrawer.tsx
│   ├── EditPaymentDrawer.tsx
│   └── DeletePaymentDialog.tsx
├── hooks/
│   └── usePayments.ts
├── pages/
│   └── PaymentsPage.tsx
├── schemas/
│   └── payment.schema.ts
├── utils/
│   └── paymentTransform.ts
└── index.ts
```

---

## Database Schema Reference

**Table:** `public.payments` (already exists in Supabase)

**Fields:**
- `id` uuid PK
- `invoice_id` uuid NOT NULL FK → public.invoices(id) ON DELETE CASCADE
- `amount` numeric(10,2) NOT NULL
- `date` date NOT NULL
- `method` text NOT NULL
- `reference` text NULL
- `notes` text NULL
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

**Note:** Table already exists - no migration needed.

---

## Validation Checklist

- [ ] Routes include `/dashboard/payments` and render without errors.
- [ ] Sidebar shows "Payments" with CreditCard icon and active state.
- [ ] Zod schema enforces required fields: invoiceId, amount (> 0), date, method.
- [ ] Optional fields accept empty strings; payload normalizes to `null`.
- [ ] Date fields format correctly for display and database.
- [ ] Amount validation works (rejects <= 0, accepts positive numbers).
- [ ] Query keys invalidate on create/update/delete; list refetches.
- [ ] `usePaymentsList(invoiceId)` filters correctly when invoiceId provided.
- [ ] Drawers/dialog close on success; toasts fire for success/error.
- [ ] Loading, empty, and error states render correctly.
- [ ] Search filters invoice number, customer name, reference, notes in-memory on fetched data.
- [ ] Method filter works correctly (cash/card/bank_transfer/check/online/other/all).
- [ ] Table displays invoice info correctly (invoice number + customer name if available).
- [ ] Method field displays correctly with badge colors.
- [ ] Amount displays formatted as currency (GBP).
- [ ] Invoice dropdown loads from useInvoicesList and displays readable format.
- [ ] Amount auto-fill works when invoice selected (optional enhancement).
- [ ] All imports use `@/` aliases; no relative cross-module leaks.
- [ ] `npm run lint` and `npm run build` succeed.
- [ ] No TypeScript errors; all types properly exported.
- [ ] Transform functions correctly map dates (date strings ↔ form dates).
- [ ] Transform functions correctly map method enum.
- [ ] No usage of `any` types.
- [ ] No changes to existing modules (Orders, Jobs, Memorials, Customers, Companies, Invoicing, Inscriptions, Map).

---

## Success Criteria

✅ Payments module delivers live Supabase CRUD with working drawers/dialog, searchable table with method filtering, route/sidebar integration, and clean build with no console errors. Query invalidation keeps list in sync after create/update/delete. Invoice dropdown displays readable format. Amount validation works (must be > 0). Payment MUST belong to an Invoice (invoice_id required). Multiple payments can exist per invoice.

---

## Implementation Notes

### Invoice Requirement
- Every payment MUST have an `invoice_id` - this is enforced at the database level (NOT NULL constraint).
- The form should require invoice selection before allowing submission.
- Multiple payments can belong to the same invoice (one-to-many relationship).

### Payment Method Field
- Method enum: 'cash' | 'card' | 'bank_transfer' | 'check' | 'online' | 'other'
- Display with clear labels in Select dropdown.
- Show as badge with color coding in table.

### Amount Field
- Must be a positive number (> 0).
- Display formatted as currency (GBP) in table.
- Use number input with step="0.01" for decimal precision.

### Date Field
- Required date field.
- Use date picker component.
- Format as YYYY-MM-DD for database, display as readable format (e.g., "Jan 15, 2024").

### Reference Field
- Optional text field for payment reference (check number, transaction ID, etc.).
- Display in table if available.

### Query Key Strategy
- `paymentsKeys.all` - for all payments list
- `paymentsKeys.byInvoice(invoiceId)` - for filtering by invoice (useful for future Invoice detail pages)
- `paymentsKeys.detail(id)` - for single payment
- Mutations invalidate both `all` and `byInvoice` when invoiceId is known.

### Invoice Display
- In table, show invoice number + customer name if available.
- For Phase 1, may need to join with invoices table or fetch separately.
- Invoice dropdown should show: "Invoice Number – Customer Name".

### Amount Auto-fill (Optional Enhancement)
- When invoice is selected in Create drawer, optionally auto-fill amount from invoice total.
- This is a nice-to-have feature, not required for Phase 1.

### Currency Formatting
- Use `Intl.NumberFormat` for currency formatting.
- Default to GBP (British Pounds).
- Format: £1,234.56

---

*Specification created: Payments Module Phase 1 CRUD Integration*  
*Ready for implementation via `/plan` command*

