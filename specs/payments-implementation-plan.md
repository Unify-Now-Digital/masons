# Detailed Implementation Plan: Payments Module (Phase 1)

**Branch:** `feature/payments-crud-integration`  
**Specification:** `specs/payments-crud-integration-plan.md`  
**Implementation Plan:** `specs/payments-implementation-plan.md`

---

## Overview

This plan provides step-by-step implementation details for the Payments module, following the same architecture as Customers, Orders, Companies, Jobs, Memorials, and Inscriptions modules. All code examples use TypeScript, React Hook Form, Zod validation, and TanStack Query.

**Key Features:**
- CRUD operations for payment records
- Invoice requirement (every payment MUST belong to an Invoice)
- Multiple payments per invoice support
- Payment method management (cash, card, bank_transfer, check, online, other)
- Amount validation (must be > 0)
- Currency formatting (GBP)
- Search and method filtering
- Optional invoice filtering
- Optional amount auto-fill from invoice

---

## Task 1: Create Payment Schema

**File:** `src/modules/payments/schemas/payment.schema.ts`  
**Action:** CREATE

**Complete Code:**

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
- `amount` must be a positive number (> 0) using `.positive()`
- `date` is required string (YYYY-MM-DD format)
- `method` is required enum with 6 options
- Optional string fields allow empty strings (normalized to `null` in transforms)

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/payments/utils/paymentTransform.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import type { Payment, PaymentInsert, PaymentUpdate } from '../hooks/usePayments';
import type { PaymentFormData } from '../schemas/payment.schema';

// UI-friendly payment format (camelCase)
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

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Transform database payment to UI-friendly format
 */
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

/**
 * Transform array of database payments to UI format
 */
export function transformPaymentsFromDb(payments: Payment[]): UIPayment[] {
  return payments.map(transformPaymentFromDb);
}

/**
 * Convert form data to database insert payload
 */
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

/**
 * Convert form data to database update payload
 */
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

**Key Points:**
- `normalizeOptional` helper converts empty strings to `null` for optional fields
- Transform functions map snake_case DB fields to camelCase UI fields
- Date fields are preserved as strings (YYYY-MM-DD format)
- Method enum is preserved as-is
- Amount is preserved as number (no transformation needed)
- All nullable fields are properly handled

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/payments/hooks/usePayments.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

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

**Key Points:**
- Query keys: `paymentsKeys.all`, `paymentsKeys.byInvoice(invoiceId)`, `paymentsKeys.detail(id)`
- `usePaymentsList(invoiceId?)` - optional invoiceId filter
- List query orders by `date DESC`
- Create mutation invalidates both `all` and `byInvoice` queries
- Update mutation invalidates list + sets detail cache + invalidates byInvoice
- Delete mutation invalidates list
- All functions throw errors (handled by TanStack Query)

---

## Task 4: Create CreatePaymentDrawer Component

**File:** `src/modules/payments/components/CreatePaymentDrawer.tsx`  
**Action:** CREATE

**Complete Code Structure:**

```typescript
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { useCreatePayment } from '../hooks/usePayments';
import { paymentFormSchema, type PaymentFormData } from '../schemas/payment.schema';
import { toPaymentInsert } from '../utils/paymentTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useInvoicesList } from '@/modules/invoicing/hooks/useInvoices';

interface CreatePaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePaymentDrawer: React.FC<CreatePaymentDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createPayment, isPending } = useCreatePayment();
  const { toast } = useToast();
  const { data: invoicesData } = useInvoicesList();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      invoiceId: '',
      amount: 0,
      date: null,
      method: 'cash',
      reference: '',
      notes: '',
    },
  });

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.reset({
        invoiceId: '',
        amount: 0,
        date: null,
        method: 'cash',
        reference: '',
        notes: '',
      });
    }
  }, [open, form]);

  // Auto-fill amount when invoice is selected (optional enhancement)
  const selectedInvoiceId = form.watch('invoiceId');
  const selectedInvoice = invoicesData?.find((i) => i.id === selectedInvoiceId);

  useEffect(() => {
    if (selectedInvoice && open) {
      // Optionally auto-fill amount from invoice
      if (selectedInvoice.amount && selectedInvoice.amount > 0) {
        form.setValue('amount', selectedInvoice.amount);
      }
    }
  }, [selectedInvoice, open, form]);

  const onSubmit = (values: PaymentFormData) => {
    // Ensure date is in YYYY-MM-DD format
    const dateValue = values.date || format(new Date(), 'yyyy-MM-dd');
    const payload = toPaymentInsert({ ...values, date: dateValue });
    
    createPayment(payload, {
      onSuccess: () => {
        toast({
          title: 'Payment created',
          description: 'Payment has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to create payment.';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String(error.message);
        }
        console.error('Error creating payment:', error);
        toast({
          title: 'Error creating payment',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Create Payment</DrawerTitle>
          <DrawerDescription>Add a new payment record.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
            {/* Invoice Selection - REQUIRED */}
            <FormField
              control={form.control}
              name="invoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an invoice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(invoicesData) && invoicesData.length > 0
                        ? invoicesData.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {invoice.invoice_number} - {invoice.customer_name || 'Unknown Customer'}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount - REQUIRED */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date - REQUIRED */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (() => {
                            try {
                              const date = new Date(field.value);
                              if (isNaN(date.getTime())) {
                                return <span>Invalid date</span>;
                              }
                              return format(date, 'PPP');
                            } catch {
                              return <span>Invalid date</span>;
                            }
                          })() : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? (() => {
                          try {
                            const date = new Date(field.value);
                            return isNaN(date.getTime()) ? undefined : date;
                          } catch {
                            return undefined;
                          }
                        })() : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : null)}
                        disabled={(date) => date < new Date('1900-01-01')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Method - REQUIRED */}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference - OPTIONAL */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., check number, transaction ID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes - OPTIONAL */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DrawerFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create Payment'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};
```

**Key Points:**
- Invoice dropdown loads from `useInvoicesList()` hook
- Display format: "Invoice Number – Customer Name"
- Amount input with step="0.01" for decimal precision
- Date picker with error handling
- Method dropdown with 6 options
- Optional amount auto-fill when invoice selected
- Form resets when drawer opens
- Toast notifications on success/error

---

## Task 5: Create EditPaymentDrawer Component

**File:** `src/modules/payments/components/EditPaymentDrawer.tsx`  
**Action:** CREATE

**Complete Code Structure:**

```typescript
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { useUpdatePayment, type Payment } from '../hooks/usePayments';
import { paymentFormSchema, type PaymentFormData } from '../schemas/payment.schema';
import { toPaymentUpdate } from '../utils/paymentTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useInvoicesList } from '@/modules/invoicing/hooks/useInvoices';

interface EditPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
}

export const EditPaymentDrawer: React.FC<EditPaymentDrawerProps> = ({
  open,
  onOpenChange,
  payment,
}) => {
  const { mutate: updatePayment, isPending } = useUpdatePayment();
  const { toast } = useToast();
  const { data: invoicesData } = useInvoicesList();

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

  // Reset form when payment changes
  useEffect(() => {
    if (payment && open) {
      form.reset({
        invoiceId: payment.invoice_id,
        amount: payment.amount,
        date: payment.date,
        method: payment.method,
        reference: payment.reference || '',
        notes: payment.notes || '',
      });
    }
  }, [payment, open, form]);

  const onSubmit = (values: PaymentFormData) => {
    const dateValue = values.date || payment.date;
    const payload = toPaymentUpdate({ ...values, date: dateValue });
    
    updatePayment(
      { id: payment.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Payment updated',
            description: 'Payment has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          let errorMessage = 'Failed to update payment.';
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = String(error.message);
          }
          toast({
            title: 'Error updating payment',
            description: errorMessage,
            variant: 'destructive',
          });
        },
      }
    );
  };

  // ... same form structure as CreatePaymentDrawer, but with pre-filled values ...
  // (Full form code similar to CreatePaymentDrawer, just with different defaultValues)
};
```

**Key Points:**
- Pre-fills all fields from `payment` prop
- Same form structure as Create drawer
- Uses `toPaymentUpdate` for payload
- Updates existing payment by ID
- Toast notifications on success/error

---

## Task 6: Create DeletePaymentDialog Component

**File:** `src/modules/payments/components/DeletePaymentDialog.tsx`  
**Action:** CREATE

**Complete Code:**

```typescript
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useDeletePayment } from '../hooks/usePayments';
import { useToast } from '@/shared/hooks/use-toast';
import type { Payment } from '../hooks/usePayments';
import { format } from 'date-fns';

interface DeletePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
}

export const DeletePaymentDialog: React.FC<DeletePaymentDialogProps> = ({
  open,
  onOpenChange,
  payment,
}) => {
  const { mutate: deletePayment, isPending } = useDeletePayment();
  const { toast } = useToast();

  const handleDelete = () => {
    deletePayment(payment.id, {
      onSuccess: () => {
        toast({
          title: 'Payment deleted',
          description: 'Payment has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to delete payment.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error deleting payment',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatMethod = (method: string) => {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Payment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this payment?
            <br />
            <br />
            <strong>Amount:</strong> {formatCurrency(payment.amount)}
            <br />
            <strong>Date:</strong> {format(new Date(payment.date), 'PPP')}
            <br />
            <strong>Method:</strong> {formatMethod(payment.method)}
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

**Key Points:**
- Shows payment amount, date, and method in confirmation
- Loading state on delete button
- Toast notifications on success/error
- Destructive styling on delete button
- Currency formatting for amount display

---

## Task 7: Build PaymentsPage

**File:** `src/modules/payments/pages/PaymentsPage.tsx`  
**Action:** CREATE

**Complete Code Structure:**

```typescript
import React, { useMemo, useState } from 'react';
import { usePaymentsList } from '../hooks/usePayments';
import { transformPaymentsFromDb } from '../utils/paymentTransform';
import { CreatePaymentDrawer } from '../components/CreatePaymentDrawer';
import { EditPaymentDrawer } from '../components/EditPaymentDrawer';
import { DeletePaymentDialog } from '../components/DeletePaymentDialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import type { Payment } from '../hooks/usePayments';
import type { UIPayment } from '../utils/paymentTransform';
import { useInvoicesList } from '@/modules/invoicing/hooks/useInvoices';

const methodColors: Record<string, string> = {
  cash: 'bg-green-500',
  card: 'bg-blue-500',
  bank_transfer: 'bg-purple-500',
  check: 'bg-yellow-500',
  online: 'bg-indigo-500',
  other: 'bg-gray-500',
};

const formatMethod = (method: string) => {
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
};

export const PaymentsPage: React.FC = () => {
  const { data: paymentsData, isLoading, error, refetch } = usePaymentsList();
  const { data: invoicesData } = useInvoicesList();
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const payments = useMemo(() => {
    if (!paymentsData) return [];
    return transformPaymentsFromDb(paymentsData);
  }, [paymentsData]);

  // Create a map of invoice IDs to invoice data for quick lookup
  const invoiceMap = useMemo(() => {
    if (!invoicesData) return new Map();
    return new Map(invoicesData.map((inv) => [inv.id, inv]));
  }, [invoicesData]);

  // Enhance payments with invoice data
  const enhancedPayments = useMemo(() => {
    return payments.map((payment) => {
      const invoice = invoiceMap.get(payment.invoiceId);
      return {
        ...payment,
        invoiceNumber: invoice?.invoice_number || null,
        customerName: invoice?.customer_name || null,
      };
    });
  }, [payments, invoiceMap]);

  const filteredPayments = useMemo(() => {
    if (!enhancedPayments) return [];
    
    let filtered = enhancedPayments;
    
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
  }, [enhancedPayments, searchQuery, methodFilter]);

  const handleEdit = (payment: UIPayment) => {
    const dbPayment = paymentsData?.find((p) => p.id === payment.id);
    if (dbPayment) {
      setSelectedPayment(dbPayment);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (payment: UIPayment) => {
    const dbPayment = paymentsData?.find((p) => p.id === payment.id);
    if (dbPayment) {
      setSelectedPayment(dbPayment);
      setDeleteDialogOpen(true);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">Error loading payments</p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">
            Manage payment records for invoices
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Payment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>View and manage all payment records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search by invoice number, customer, reference, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || methodFilter !== 'all'
                  ? 'No payments match your filters'
                  : 'No payments found'}
              </p>
              {!searchQuery && methodFilter === 'all' && (
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Payment
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {(() => {
                        try {
                          const date = new Date(payment.date);
                          if (isNaN(date.getTime())) {
                            return 'Invalid date';
                          }
                          return format(date, 'MMM dd, yyyy');
                        } catch {
                          return 'Invalid date';
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {payment.invoiceNumber || (
                        <span className="text-muted-foreground text-sm">
                          {payment.invoiceId.substring(0, 8)}...
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.customerName || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={methodColors[payment.method] || 'bg-gray-500'}
                      >
                        {formatMethod(payment.method)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.reference || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {payment.notes || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(payment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(payment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreatePaymentDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {selectedPayment && (
        <>
          <EditPaymentDrawer
            open={editDrawerOpen}
            onOpenChange={(open) => {
              setEditDrawerOpen(open);
              if (!open) setSelectedPayment(null);
            }}
            payment={selectedPayment}
          />

          <DeletePaymentDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedPayment(null);
            }}
            payment={selectedPayment}
          />
        </>
      )}
    </div>
  );
};
```

**Key Points:**
- Search filters by invoice number, customer name, reference, notes
- Method filter dropdown (all/cash/card/bank_transfer/check/online/other)
- Table columns: Date, Invoice Number, Customer Name, Amount, Method, Reference, Notes, Actions
- Method badges with color coding
- Amount formatted as currency (GBP)
- Invoice data fetched separately and merged with payments
- Loading skeleton, empty state, error state
- Edit/Delete actions open respective drawers/dialog

---

## Task 8: Add Module Barrel

**File:** `src/modules/payments/index.ts`  
**Action:** CREATE

**Complete Code:**

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

**Change:** Add import and route:

```typescript
import { PaymentsPage } from "@/modules/payments";

// Inside the dashboard routes:
<Route path="payments" element={<PaymentsPage />} />
```

**Location:** Add after other module routes (orders, customers, companies, memorials, inscriptions, etc.)

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:

```typescript
import { CreditCard } from 'lucide-react';

// Inside the navigation items array:
{
  title: 'Payments',
  url: '/dashboard/payments',
  icon: CreditCard,
}
```

**Location:** Add in the operational section, near Invoicing.

---

## Task 11: Validation & QA

### Build & Lint Checks

1. **Run lint:**
   ```bash
   npm run lint
   ```
   - Should pass with no errors
   - No `any` types
   - All imports resolve correctly

2. **Run build:**
   ```bash
   npm run build
   ```
   - Should compile successfully
   - No TypeScript errors
   - No missing dependencies

### Runtime Tests

1. **Create Payment:**
   - Click "New Payment"
   - Select an invoice
   - Fill required fields (amount > 0, date, method)
   - Submit → should create, show toast, close drawer, refresh list
   - Verify amount auto-fills from invoice (optional)

2. **Edit Payment:**
   - Click edit icon on a payment
   - Change fields
   - Submit → should update, show toast, close drawer, refresh list

3. **Delete Payment:**
   - Click delete icon on a payment
   - Confirm → should delete, show toast, close dialog, refresh list

4. **Search:**
   - Type in search box
   - Should filter by invoice number, customer name, reference, notes
   - Clear search → should show all

5. **Method Filter:**
   - Select method from dropdown
   - Should filter payments by method
   - Select "All Methods" → should show all

6. **Invoice Filtering (Future Enhancement):**
   - `usePaymentsList(invoiceId)` can be used in Invoice detail pages
   - Should filter payments by invoice when invoiceId provided

7. **Navigation:**
   - Click "Payments" in sidebar
   - Should navigate to `/dashboard/payments`
   - Route should render without errors

### Validation Checklist

- [ ] All TypeScript types defined (no `any`)
- [ ] Zod schema validates required fields
- [ ] Amount validation works (rejects <= 0, accepts positive numbers)
- [ ] Transform functions map DB ↔ UI correctly
- [ ] Query keys invalidate on mutations
- [ ] `usePaymentsList(invoiceId?)` works with and without invoiceId
- [ ] Invoice dropdown loads and displays readable format
- [ ] Date fields format correctly (display and save)
- [ ] Method badges display with correct colors
- [ ] Amount displays formatted as currency (GBP)
- [ ] Search filters work correctly
- [ ] Method filter works correctly
- [ ] Loading/empty/error states render
- [ ] Toast notifications fire on success/error
- [ ] Drawers/dialog close on success
- [ ] Router includes `/dashboard/payments`
- [ ] Sidebar shows "Payments" with CreditCard icon
- [ ] Amount auto-fill works when invoice selected (optional)
- [ ] Invoice number and customer name display in table
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No console errors
- [ ] No changes to existing modules

---

## Summary

This implementation plan provides complete step-by-step instructions for building the Payments CRUD module. Each task includes:

- File path and action (CREATE/UPDATE)
- Complete code examples
- Key implementation points
- Integration details

The module follows the same architecture as Orders, Customers, Companies, Jobs, Memorials, and Inscriptions modules for consistency and maintainability.

**Ready for implementation via `/implement` command**

