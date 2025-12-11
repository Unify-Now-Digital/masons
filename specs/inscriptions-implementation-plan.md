# Detailed Implementation Plan: Inscriptions Module (Phase 1)

**Branch:** `feature/inscriptions-crud-integration`  
**Specification:** `specs/inscriptions-crud-integration-plan.md`  
**Implementation Plan:** `specs/inscriptions-implementation-plan.md`

---

## Overview

This plan provides step-by-step implementation details for the Inscriptions module, following the same architecture as Customers, Orders, Companies, Jobs, and Memorials modules. All code examples use TypeScript, React Hook Form, Zod validation, and TanStack Query.

**Key Features:**
- CRUD operations for inscription records
- Order requirement (every inscription MUST belong to an Order)
- Multiple inscriptions per order support
- Type management (front, back, side, plaque, additional)
- Status workflow tracking (pending → proofing → approved → engraving → completed → installed)
- Color and style options
- Proof URL tracking (text field, no file upload in Phase 1)
- Engraving tracking (engraved by, engraved date)
- Search and status filtering
- Optional order filtering

---

## Task 1: Create Inscription Schema

**File:** `src/modules/inscriptions/schemas/inscription.schema.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { z } from 'zod';

export const inscriptionFormSchema = z.object({
  orderId: z.string().uuid('Order is required'),
  inscriptionText: z.string().trim().min(1, 'Inscription text is required'),
  type: z.enum(['front', 'back', 'side', 'plaque', 'additional'], {
    errorMap: () => ({ message: 'Inscription type is required' }),
  }),
  style: z.string().trim().optional().or(z.literal('')),
  color: z.enum(['gold', 'silver', 'white', 'black', 'natural', 'other']).optional().nullable(),
  proofUrl: z.string().url('Invalid URL format').optional().or(z.literal('')).nullable(),
  status: z.enum(['pending', 'proofing', 'approved', 'engraving', 'completed', 'installed']).default('pending'),
  engravedBy: z.string().trim().optional().or(z.literal('')),
  engravedDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type InscriptionFormData = z.infer<typeof inscriptionFormSchema>;
```

**Key Points:**
- `orderId` is REQUIRED (UUID) - inscription MUST belong to an Order
- `inscriptionText` is required with min length 1
- `type` is required enum (front, back, side, plaque, additional)
- `status` defaults to 'pending'
- `color` is optional enum (can be null)
- `proofUrl` has URL validation when provided (but allows empty string or null)
- Optional string fields allow empty strings (normalized to `null` in transforms)
- Date field (`engravedDate`) is optional string (YYYY-MM-DD format)

**Note on proofUrl validation:** The schema uses `.url()` validation, but this will only trigger when a non-empty string is provided. Empty strings and null values are allowed via `.optional().or(z.literal('')).nullable()`.

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/inscriptions/utils/inscriptionTransform.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import type { Inscription, InscriptionInsert, InscriptionUpdate } from '../hooks/useInscriptions';
import type { InscriptionFormData } from '../schemas/inscription.schema';

// UI-friendly inscription format (camelCase)
export interface UIInscription {
  id: string;
  orderId: string;
  inscriptionText: string;
  type: 'front' | 'back' | 'side' | 'plaque' | 'additional';
  style: string | null;
  color: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other' | null;
  proofUrl: string | null;
  status: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed';
  engravedBy: string | null;
  engravedDate: string | null;
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
 * Transform database inscription to UI-friendly format
 */
export function transformInscriptionFromDb(inscription: Inscription): UIInscription {
  return {
    id: inscription.id,
    orderId: inscription.order_id,
    inscriptionText: inscription.inscription_text,
    type: inscription.type,
    style: inscription.style || null,
    color: inscription.color || null,
    proofUrl: inscription.proof_url || null,
    status: inscription.status,
    engravedBy: inscription.engraved_by || null,
    engravedDate: inscription.engraved_date || null,
    notes: inscription.notes || null,
    createdAt: inscription.created_at,
    updatedAt: inscription.updated_at,
  };
}

/**
 * Transform array of database inscriptions to UI format
 */
export function transformInscriptionsFromDb(inscriptions: Inscription[]): UIInscription[] {
  return inscriptions.map(transformInscriptionFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toInscriptionInsert(form: InscriptionFormData): InscriptionInsert {
  return {
    order_id: form.orderId,
    inscription_text: form.inscriptionText.trim(),
    type: form.type,
    style: normalizeOptional(form.style),
    color: form.color || null,
    proof_url: normalizeOptional(form.proofUrl),
    status: form.status,
    engraved_by: normalizeOptional(form.engravedBy),
    engraved_date: normalizeOptional(form.engravedDate),
    notes: normalizeOptional(form.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toInscriptionUpdate(form: InscriptionFormData): InscriptionUpdate {
  return {
    order_id: form.orderId,
    inscription_text: form.inscriptionText.trim(),
    type: form.type,
    style: normalizeOptional(form.style),
    color: form.color || null,
    proof_url: normalizeOptional(form.proofUrl),
    status: form.status,
    engraved_by: normalizeOptional(form.engravedBy),
    engraved_date: normalizeOptional(form.engravedDate),
    notes: normalizeOptional(form.notes),
  };
}
```

**Key Points:**
- `normalizeOptional` helper converts empty strings to `null` for optional fields
- Transform functions map snake_case DB fields to camelCase UI fields
- Date fields are preserved as strings (YYYY-MM-DD format)
- Status and type enums are preserved as-is
- Color enum can be null
- All nullable fields are properly handled

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/inscriptions/hooks/useInscriptions.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Inscription {
  id: string;
  order_id: string;
  inscription_text: string;
  type: 'front' | 'back' | 'side' | 'plaque' | 'additional';
  style: string | null;
  color: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other' | null;
  proof_url: string | null;
  status: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed';
  engraved_by: string | null;
  engraved_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InscriptionInsert = Omit<Inscription, 'id' | 'created_at' | 'updated_at'>;
export type InscriptionUpdate = Partial<InscriptionInsert>;

export const inscriptionsKeys = {
  all: ['inscriptions'] as const,
  byOrder: (orderId: string) => ['inscriptions', 'order', orderId] as const,
  detail: (id: string) => ['inscriptions', id] as const,
};

async function fetchInscriptions(orderId?: string) {
  let query = supabase
    .from('inscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (orderId) {
    query = query.eq('order_id', orderId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as Inscription[];
}

async function fetchInscription(id: string) {
  const { data, error } = await supabase
    .from('inscriptions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function createInscription(inscription: InscriptionInsert) {
  const { data, error } = await supabase
    .from('inscriptions')
    .insert(inscription)
    .select()
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function updateInscription(id: string, updates: InscriptionUpdate) {
  const { data, error } = await supabase
    .from('inscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function deleteInscription(id: string) {
  const { error } = await supabase
    .from('inscriptions')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function useInscriptionsList(orderId?: string) {
  return useQuery({
    queryKey: orderId ? inscriptionsKeys.byOrder(orderId) : inscriptionsKeys.all,
    queryFn: () => fetchInscriptions(orderId),
  });
}

export function useInscription(id: string) {
  return useQuery({
    queryKey: inscriptionsKeys.detail(id),
    queryFn: () => fetchInscription(id),
    enabled: !!id,
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (inscription: InscriptionInsert) => createInscription(inscription),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
    },
  });
}

export function useUpdateInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InscriptionUpdate }) => 
      updateInscription(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
      queryClient.setQueryData(inscriptionsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteInscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
    },
  });
}
```

**Key Points:**
- Query keys: `inscriptionsKeys.all`, `inscriptionsKeys.byOrder(orderId)`, `inscriptionsKeys.detail(id)`
- `useInscriptionsList(orderId?)` - optional orderId filter
- List query orders by `created_at DESC`
- Create mutation invalidates both `all` and `byOrder` queries
- Update mutation invalidates list + sets detail cache + invalidates byOrder
- Delete mutation invalidates list
- All functions throw errors (handled by TanStack Query)

---

## Task 4: Create CreateInscriptionDrawer Component

**File:** `src/modules/inscriptions/components/CreateInscriptionDrawer.tsx`  
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
import { useCreateInscription } from '../hooks/useInscriptions';
import { inscriptionFormSchema, type InscriptionFormData } from '../schemas/inscription.schema';
import { toInscriptionInsert } from '../utils/inscriptionTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

interface CreateInscriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateInscriptionDrawer: React.FC<CreateInscriptionDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createInscription, isPending } = useCreateInscription();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  const form = useForm<InscriptionFormData>({
    resolver: zodResolver(inscriptionFormSchema),
    defaultValues: {
      orderId: '',
      inscriptionText: '',
      type: 'front',
      style: '',
      color: null,
      proofUrl: '',
      status: 'pending',
      engravedBy: '',
      engravedDate: null,
      notes: '',
    },
  });

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.reset({
        orderId: '',
        inscriptionText: '',
        type: 'front',
        style: '',
        color: null,
        proofUrl: '',
        status: 'pending',
        engravedBy: '',
        engravedDate: null,
        notes: '',
      });
    }
  }, [open, form]);

  const onSubmit = (values: InscriptionFormData) => {
    const payload = toInscriptionInsert(values);
    createInscription(payload, {
      onSuccess: () => {
        toast({
          title: 'Inscription created',
          description: 'Inscription has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to create inscription.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error creating inscription',
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
          <DrawerTitle>Create Inscription</DrawerTitle>
          <DrawerDescription>Add a new inscription record.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
            {/* Order Selection - REQUIRED */}
            <FormField
              control={form.control}
              name="orderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an order" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(ordersData) && ordersData.length > 0
                        ? ordersData.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              {order.id} - {order.customer_name} - {order.location || 'No location'}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type - REQUIRED */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="front">Front</SelectItem>
                      <SelectItem value="back">Back</SelectItem>
                      <SelectItem value="side">Side</SelectItem>
                      <SelectItem value="plaque">Plaque</SelectItem>
                      <SelectItem value="additional">Additional</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Inscription Text - REQUIRED */}
            <FormField
              control={form.control}
              name="inscriptionText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inscription Text *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter inscription text..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Style and Color */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Style</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Times New Roman, Script" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="white">White</SelectItem>
                        <SelectItem value="black">Black</SelectItem>
                        <SelectItem value="natural">Natural</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status - REQUIRED */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="proofing">Proofing</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="engraving">Engraving</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="installed">Installed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Proof URL */}
            <FormField
              control={form.control}
              name="proofUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proof URL</FormLabel>
                  <FormControl>
                    <Input 
                      type="url"
                      placeholder="https://example.com/proof.pdf" 
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Engraved By and Engraved Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="engravedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engraved By</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter engraver name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="engravedDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Engraved Date</FormLabel>
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
            </div>

            {/* Notes */}
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
                {isPending ? 'Creating...' : 'Create Inscription'}
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
- Order dropdown loads from `useOrdersList()` hook
- Display format: "Order ID – Customer Name – Location"
- Type dropdown with 5 options (front, back, side, plaque, additional)
- Inscription text is a textarea (multi-line)
- Color dropdown uses `__none__` sentinel value (like Jobs module)
- Status dropdown with 6 options
- Proof URL input with type="url"
- Date picker for engraved date with error handling
- Form resets when drawer opens
- Toast notifications on success/error

---

## Task 5: Create EditInscriptionDrawer Component

**File:** `src/modules/inscriptions/components/EditInscriptionDrawer.tsx`  
**Action:** CREATE

**Complete Code Structure:**

```typescript
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// ... same imports as CreateInscriptionDrawer ...

interface EditInscriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inscription: Inscription;
}

export const EditInscriptionDrawer: React.FC<EditInscriptionDrawerProps> = ({
  open,
  onOpenChange,
  inscription,
}) => {
  const { mutate: updateInscription, isPending } = useUpdateInscription();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  const form = useForm<InscriptionFormData>({
    resolver: zodResolver(inscriptionFormSchema),
    defaultValues: {
      orderId: inscription.order_id,
      inscriptionText: inscription.inscription_text,
      type: inscription.type,
      style: inscription.style || '',
      color: inscription.color || null,
      proofUrl: inscription.proof_url || '',
      status: inscription.status,
      engravedBy: inscription.engraved_by || '',
      engravedDate: inscription.engraved_date || null,
      notes: inscription.notes || '',
    },
  });

  // Reset form when inscription changes
  useEffect(() => {
    if (inscription && open) {
      form.reset({
        orderId: inscription.order_id,
        inscriptionText: inscription.inscription_text,
        type: inscription.type,
        style: inscription.style || '',
        color: inscription.color || null,
        proofUrl: inscription.proof_url || '',
        status: inscription.status,
        engravedBy: inscription.engraved_by || '',
        engravedDate: inscription.engraved_date || null,
        notes: inscription.notes || '',
      });
    }
  }, [inscription, open, form]);

  const onSubmit = (values: InscriptionFormData) => {
    const payload = toInscriptionUpdate(values);
    updateInscription(
      { id: inscription.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Inscription updated',
            description: 'Inscription has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          let errorMessage = 'Failed to update inscription.';
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          toast({
            title: 'Error updating inscription',
            description: errorMessage,
            variant: 'destructive',
          });
        },
      }
    );
  };

  // ... same form structure as CreateInscriptionDrawer, but with pre-filled values ...
};
```

**Key Points:**
- Pre-fills all fields from `inscription` prop
- Same form structure as Create drawer
- Uses `toInscriptionUpdate` for payload
- Updates existing inscription by ID
- Toast notifications on success/error

---

## Task 6: Create DeleteInscriptionDialog Component

**File:** `src/modules/inscriptions/components/DeleteInscriptionDialog.tsx`  
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
import { useDeleteInscription } from '../hooks/useInscriptions';
import { useToast } from '@/shared/hooks/use-toast';
import type { Inscription } from '../hooks/useInscriptions';

interface DeleteInscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inscription: Inscription;
}

export const DeleteInscriptionDialog: React.FC<DeleteInscriptionDialogProps> = ({
  open,
  onOpenChange,
  inscription,
}) => {
  const { mutate: deleteInscription, isPending } = useDeleteInscription();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteInscription(inscription.id, {
      onSuccess: () => {
        toast({
          title: 'Inscription deleted',
          description: 'Inscription has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to delete inscription.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error deleting inscription',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  const inscriptionSnippet = inscription.inscription_text.length > 50
    ? `${inscription.inscription_text.substring(0, 50)}...`
    : inscription.inscription_text;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Inscription</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the <strong>{inscription.type}</strong> inscription?
            <br />
            <br />
            <strong>Snippet:</strong> "{inscriptionSnippet}"
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
- Shows inscription type and text snippet in confirmation
- Loading state on delete button
- Toast notifications on success/error
- Destructive styling on delete button

---

## Task 7: Build InscriptionsPage

**File:** `src/modules/inscriptions/pages/InscriptionsPage.tsx`  
**Action:** CREATE

**Complete Code Structure:**

```typescript
import React, { useMemo, useState } from 'react';
import { useInscriptionsList } from '../hooks/useInscriptions';
import { transformInscriptionsFromDb } from '../utils/inscriptionTransform';
import { CreateInscriptionDrawer } from '../components/CreateInscriptionDrawer';
import { EditInscriptionDrawer } from '../components/EditInscriptionDrawer';
import { DeleteInscriptionDialog } from '../components/DeleteInscriptionDialog';
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
import { Plus, Pencil, Trash2, Italic } from 'lucide-react';
import { format } from 'date-fns';
import type { Inscription } from '../hooks/useInscriptions';
import type { UIInscription } from '../utils/inscriptionTransform';

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  proofing: 'bg-yellow-500',
  approved: 'bg-blue-500',
  engraving: 'bg-purple-500',
  completed: 'bg-green-500',
  installed: 'bg-green-600',
};

const formatType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const InscriptionsPage: React.FC = () => {
  const { data: inscriptionsData, isLoading, error, refetch } = useInscriptionsList();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInscription, setSelectedInscription] = useState<Inscription | null>(null);

  const inscriptions = useMemo(() => {
    if (!inscriptionsData) return [];
    return transformInscriptionsFromDb(inscriptionsData);
  }, [inscriptionsData]);

  const filteredInscriptions = useMemo(() => {
    if (!inscriptions) return [];
    
    let filtered = inscriptions;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.inscriptionText.toLowerCase().includes(query) ||
          (i.style && i.style.toLowerCase().includes(query)) ||
          (i.engravedBy && i.engravedBy.toLowerCase().includes(query))
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    
    return filtered;
  }, [inscriptions, searchQuery, statusFilter]);

  const handleEdit = (inscription: UIInscription) => {
    // Find original DB inscription
    const dbInscription = inscriptionsData?.find((i) => i.id === inscription.id);
    if (dbInscription) {
      setSelectedInscription(dbInscription);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (inscription: UIInscription) => {
    const dbInscription = inscriptionsData?.find((i) => i.id === inscription.id);
    if (dbInscription) {
      setSelectedInscription(dbInscription);
      setDeleteDialogOpen(true);
    }
  };

  const formatEngravedDate = (date: string | null) => {
    if (!date) return 'Not engraved';
    try {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return 'Invalid date';
      }
      return format(parsedDate, 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">Error loading inscriptions</p>
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
          <h1 className="text-3xl font-bold">Inscriptions</h1>
          <p className="text-muted-foreground">
            Manage inscription items for memorial orders
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Inscription
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inscriptions</CardTitle>
          <CardDescription>View and manage all inscription records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search by inscription text, style, or engraver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="proofing">Proofing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="engraving">Engraving</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredInscriptions.length === 0 ? (
            <div className="text-center py-8">
              <Italic className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No inscriptions match your filters'
                  : 'No inscriptions found'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Inscription
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Engraved By</TableHead>
                  <TableHead>Engraved Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInscriptions.map((inscription) => (
                  <TableRow key={inscription.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {inscription.orderId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatType(inscription.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[inscription.status] || 'bg-gray-500'}
                      >
                        {inscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inscription.color ? (
                        <Badge variant="outline">{inscription.color}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {inscription.style || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {inscription.engravedBy || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {formatEngravedDate(inscription.engravedDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(inscription)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(inscription)}
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

      <CreateInscriptionDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {selectedInscription && (
        <>
          <EditInscriptionDrawer
            open={editDrawerOpen}
            onOpenChange={(open) => {
              setEditDrawerOpen(open);
              if (!open) setSelectedInscription(null);
            }}
            inscription={selectedInscription}
          />

          <DeleteInscriptionDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedInscription(null);
            }}
            inscription={selectedInscription}
          />
        </>
      )}
    </div>
  );
};
```

**Key Points:**
- Search filters by inscriptionText, style, engravedBy
- Status filter dropdown (all/pending/proofing/approved/engraving/completed/installed)
- Table columns: Order, Type, Status, Color, Style, Engraved By, Engraved Date, Actions
- Status badges with color coding
- Type displayed as badge
- Color displayed as badge if available
- Engraved date formatted or "Not engraved" if null
- Order shows truncated ID (can be enhanced to show customer name)
- Loading skeleton, empty state, error state
- Edit/Delete actions open respective drawers/dialog

---

## Task 8: Add Module Barrel

**File:** `src/modules/inscriptions/index.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
export { InscriptionsPage } from './pages/InscriptionsPage';
export { CreateInscriptionDrawer } from './components/CreateInscriptionDrawer';
export { EditInscriptionDrawer } from './components/EditInscriptionDrawer';
export { DeleteInscriptionDialog } from './components/DeleteInscriptionDialog';
export { useInscriptionsList, useInscription, useCreateInscription, useUpdateInscription, useDeleteInscription } from './hooks/useInscriptions';
export type { Inscription, InscriptionInsert, InscriptionUpdate } from './hooks/useInscriptions';
export type { UIInscription } from './utils/inscriptionTransform';
```

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add import and route:

```typescript
import { InscriptionsPage } from "@/modules/inscriptions";

// Inside the dashboard routes:
<Route path="inscriptions" element={<InscriptionsPage />} />
```

**Location:** Add after other module routes (orders, customers, companies, memorials, etc.)

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:

```typescript
import { Italic } from 'lucide-react';

// Inside the navigation items array:
{
  title: 'Inscriptions',
  url: '/dashboard/inscriptions',
  icon: Italic,
}
```

**Location:** Add in the operational section, near Orders/Memorials/Inscriptions.

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

1. **Create Inscription:**
   - Click "New Inscription"
   - Select an order
   - Fill required fields (inscription text, type, status)
   - Submit → should create, show toast, close drawer, refresh list

2. **Edit Inscription:**
   - Click edit icon on an inscription
   - Change fields
   - Submit → should update, show toast, close drawer, refresh list

3. **Delete Inscription:**
   - Click delete icon on an inscription
   - Confirm → should delete, show toast, close dialog, refresh list

4. **Search:**
   - Type in search box
   - Should filter by inscription text, style, engraved by
   - Clear search → should show all

5. **Status Filter:**
   - Select status from dropdown
   - Should filter inscriptions by status
   - Select "All Statuses" → should show all

6. **Order Filtering (Future Enhancement):**
   - `useInscriptionsList(orderId)` can be used in Order detail pages
   - Should filter inscriptions by order when orderId provided

7. **Navigation:**
   - Click "Inscriptions" in sidebar
   - Should navigate to `/dashboard/inscriptions`
   - Route should render without errors

### Validation Checklist

- [ ] All TypeScript types defined (no `any`)
- [ ] Zod schema validates required fields
- [ ] Transform functions map DB ↔ UI correctly
- [ ] Query keys invalidate on mutations
- [ ] `useInscriptionsList(orderId?)` works with and without orderId
- [ ] Order dropdown loads and displays readable format
- [ ] Date fields format correctly (display and save)
- [ ] Status badges display with correct colors
- [ ] Type badges display correctly
- [ ] Color badges display correctly (or "-" if null)
- [ ] Search filters work correctly
- [ ] Status filter works correctly
- [ ] Loading/empty/error states render
- [ ] Toast notifications fire on success/error
- [ ] Drawers/dialog close on success
- [ ] Router includes `/dashboard/inscriptions`
- [ ] Sidebar shows "Inscriptions" with icon
- [ ] Proof URL validation works (accepts valid URLs, allows empty)
- [ ] Color dropdown uses `__none__` sentinel value correctly
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No console errors
- [ ] No changes to existing modules

---

## Summary

This implementation plan provides complete step-by-step instructions for building the Inscriptions CRUD module. Each task includes:

- File path and action (CREATE/UPDATE)
- Complete code examples
- Key implementation points
- Integration details

The module follows the same architecture as Orders, Customers, Companies, Jobs, and Memorials modules for consistency and maintainability.

**Ready for implementation via `/implement` command**

