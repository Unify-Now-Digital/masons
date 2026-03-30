# Detailed Implementation Plan: Memorials Module (Phase 1)

**Branch:** `feature/memorials-crud-integration`  
**Specification:** `specs/memorials-crud-integration-plan.md`  
**Implementation Plan:** `specs/memorials-implementation-plan.md`

---

## Overview

This plan provides step-by-step implementation details for the Memorials module, following the same architecture as Customers, Orders, Companies, and Jobs modules. All code examples use TypeScript, React Hook Form, Zod validation, and TanStack Query.

**Key Features:**
- CRUD operations for memorial records
- Order requirement (every memorial MUST belong to an Order)
- Optional Job linking
- Deceased information tracking (name, dates)
- Cemetery details (name, section, plot)
- Memorial details (type, material, color, dimensions)
- Inscription tracking (text, language)
- Installation tracking (date, status, condition)
- Search and status filtering
- Order auto-fill for cemetery name

---

## Task 1: Create Memorial Schema

**File:** `src/modules/memorials/schemas/memorial.schema.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { z } from 'zod';

export const memorialFormSchema = z.object({
  orderId: z.string().uuid('Order is required'),
  jobId: z.string().uuid().optional().nullable(),
  deceasedName: z.string().trim().min(1, 'Deceased name is required'),
  dateOfBirth: z.string().optional().nullable(),
  dateOfDeath: z.string().optional().nullable(),
  cemeteryName: z.string().trim().min(1, 'Cemetery name is required'),
  cemeterySection: z.string().trim().optional().or(z.literal('')),
  cemeteryPlot: z.string().trim().optional().or(z.literal('')),
  memorialType: z.string().trim().min(1, 'Memorial type is required'),
  material: z.string().trim().optional().or(z.literal('')),
  color: z.string().trim().optional().or(z.literal('')),
  dimensions: z.string().trim().optional().or(z.literal('')),
  inscriptionText: z.string().trim().optional().or(z.literal('')),
  inscriptionLanguage: z.string().trim().optional().or(z.literal('')),
  installationDate: z.string().optional().nullable(),
  status: z.enum(['planned', 'in_progress', 'installed', 'removed']).default('planned'),
  condition: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type MemorialFormData = z.infer<typeof memorialFormSchema>;
```

**Key Points:**
- `orderId` is REQUIRED (UUID) - memorial MUST belong to an Order
- `deceasedName`, `cemeteryName`, `memorialType` are required strings
- `status` defaults to 'planned'
- Optional string fields allow empty strings (normalized to `null` in transforms)
- Date fields (`dateOfBirth`, `dateOfDeath`, `installationDate`) are optional strings (YYYY-MM-DD format)
- `jobId` is optional UUID (can be null)

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/memorials/utils/memorialTransform.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import type { Memorial, MemorialInsert, MemorialUpdate } from '../hooks/useMemorials';
import type { MemorialFormData } from '../schemas/memorial.schema';

// UI-friendly memorial format (camelCase)
export interface UIMemorial {
  id: string;
  orderId: string;
  jobId: string | null;
  deceasedName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  cemeteryName: string;
  cemeterySection: string | null;
  cemeteryPlot: string | null;
  memorialType: string;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscriptionText: string | null;
  inscriptionLanguage: string | null;
  installationDate: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
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
 * Transform database memorial to UI-friendly format
 */
export function transformMemorialFromDb(memorial: Memorial): UIMemorial {
  return {
    id: memorial.id,
    orderId: memorial.order_id,
    jobId: memorial.job_id,
    deceasedName: memorial.deceased_name,
    dateOfBirth: memorial.date_of_birth || null,
    dateOfDeath: memorial.date_of_death || null,
    cemeteryName: memorial.cemetery_name,
    cemeterySection: memorial.cemetery_section || null,
    cemeteryPlot: memorial.cemetery_plot || null,
    memorialType: memorial.memorial_type,
    material: memorial.material || null,
    color: memorial.color || null,
    dimensions: memorial.dimensions || null,
    inscriptionText: memorial.inscription_text || null,
    inscriptionLanguage: memorial.inscription_language || null,
    installationDate: memorial.installation_date || null,
    status: memorial.status,
    condition: memorial.condition || null,
    notes: memorial.notes || null,
    createdAt: memorial.created_at,
    updatedAt: memorial.updated_at,
  };
}

/**
 * Transform array of database memorials to UI format
 */
export function transformMemorialsFromDb(memorials: Memorial[]): UIMemorial[] {
  return memorials.map(transformMemorialFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toMemorialInsert(form: MemorialFormData): MemorialInsert {
  return {
    order_id: form.orderId,
    job_id: form.jobId || null,
    deceased_name: form.deceasedName.trim(),
    date_of_birth: normalizeOptional(form.dateOfBirth),
    date_of_death: normalizeOptional(form.dateOfDeath),
    cemetery_name: form.cemeteryName.trim(),
    cemetery_section: normalizeOptional(form.cemeterySection),
    cemetery_plot: normalizeOptional(form.cemeteryPlot),
    memorial_type: form.memorialType.trim(),
    material: normalizeOptional(form.material),
    color: normalizeOptional(form.color),
    dimensions: normalizeOptional(form.dimensions),
    inscription_text: normalizeOptional(form.inscriptionText),
    inscription_language: normalizeOptional(form.inscriptionLanguage),
    installation_date: normalizeOptional(form.installationDate),
    status: form.status,
    condition: normalizeOptional(form.condition),
    notes: normalizeOptional(form.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toMemorialUpdate(form: MemorialFormData): MemorialUpdate {
  return {
    order_id: form.orderId,
    job_id: form.jobId || null,
    deceased_name: form.deceasedName.trim(),
    date_of_birth: normalizeOptional(form.dateOfBirth),
    date_of_death: normalizeOptional(form.dateOfDeath),
    cemetery_name: form.cemeteryName.trim(),
    cemetery_section: normalizeOptional(form.cemeterySection),
    cemetery_plot: normalizeOptional(form.cemeteryPlot),
    memorial_type: form.memorialType.trim(),
    material: normalizeOptional(form.material),
    color: normalizeOptional(form.color),
    dimensions: normalizeOptional(form.dimensions),
    inscription_text: normalizeOptional(form.inscriptionText),
    inscription_language: normalizeOptional(form.inscriptionLanguage),
    installation_date: normalizeOptional(form.installationDate),
    status: form.status,
    condition: normalizeOptional(form.condition),
    notes: normalizeOptional(form.notes),
  };
}
```

**Key Points:**
- `normalizeOptional` helper converts empty strings to `null` for optional fields
- Transform functions map snake_case DB fields to camelCase UI fields
- Date fields are preserved as strings (YYYY-MM-DD format)
- Status enum is preserved as-is
- All nullable fields are properly handled

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/memorials/hooks/useMemorials.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Memorial {
  id: string;
  order_id: string;
  job_id: string | null;
  deceased_name: string;
  date_of_birth: string | null;
  date_of_death: string | null;
  cemetery_name: string;
  cemetery_section: string | null;
  cemetery_plot: string | null;
  memorial_type: string;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscription_text: string | null;
  inscription_language: string | null;
  installation_date: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type MemorialInsert = Omit<Memorial, 'id' | 'created_at' | 'updated_at'>;
export type MemorialUpdate = Partial<MemorialInsert>;

export const memorialsKeys = {
  all: ['memorials'] as const,
  detail: (id: string) => ['memorials', id] as const,
};

async function fetchMemorials() {
  const { data, error } = await supabase
    .from('memorials')
    .select('*')
    .order('installation_date', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Memorial[];
}

async function fetchMemorial(id: string) {
  const { data, error } = await supabase
    .from('memorials')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function createMemorial(memorial: MemorialInsert) {
  const { data, error } = await supabase
    .from('memorials')
    .insert(memorial)
    .select()
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function updateMemorial(id: string, updates: MemorialUpdate) {
  const { data, error } = await supabase
    .from('memorials')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Memorial;
}

async function deleteMemorial(id: string) {
  const { error } = await supabase
    .from('memorials')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function useMemorialsList() {
  return useQuery({
    queryKey: memorialsKeys.all,
    queryFn: fetchMemorials,
  });
}

export function useMemorial(id: string) {
  return useQuery({
    queryKey: memorialsKeys.detail(id),
    queryFn: () => fetchMemorial(id),
    enabled: !!id,
  });
}

export function useCreateMemorial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (memorial: MemorialInsert) => createMemorial(memorial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memorialsKeys.all });
    },
  });
}

export function useUpdateMemorial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MemorialUpdate }) => 
      updateMemorial(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: memorialsKeys.all });
      queryClient.setQueryData(memorialsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteMemorial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteMemorial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memorialsKeys.all });
    },
  });
}
```

**Key Points:**
- Query keys: `memorialsKeys.all` and `memorialsKeys.detail(id)`
- List query orders by `installation_date DESC NULLS LAST`, then `created_at DESC`
- Create mutation invalidates list on success
- Update mutation invalidates list + sets detail cache
- Delete mutation invalidates list
- All functions throw errors (handled by TanStack Query)

---

## Task 4: Create CreateMemorialDrawer Component

**File:** `src/modules/memorials/components/CreateMemorialDrawer.tsx`  
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
import { useCreateMemorial } from '../hooks/useMemorials';
import { memorialFormSchema, type MemorialFormData } from '../schemas/memorial.schema';
import { toMemorialInsert } from '../utils/memorialTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

interface CreateMemorialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateMemorialDrawer: React.FC<CreateMemorialDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createMemorial, isPending } = useCreateMemorial();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  const form = useForm<MemorialFormData>({
    resolver: zodResolver(memorialFormSchema),
    defaultValues: {
      orderId: '',
      jobId: null,
      deceasedName: '',
      dateOfBirth: null,
      dateOfDeath: null,
      cemeteryName: '',
      cemeterySection: '',
      cemeteryPlot: '',
      memorialType: '',
      material: '',
      color: '',
      dimensions: '',
      inscriptionText: '',
      inscriptionLanguage: '',
      installationDate: null,
      status: 'planned',
      condition: '',
      notes: '',
    },
  });

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.reset({
        orderId: '',
        jobId: null,
        deceasedName: '',
        dateOfBirth: null,
        dateOfDeath: null,
        cemeteryName: '',
        cemeterySection: '',
        cemeteryPlot: '',
        memorialType: '',
        material: '',
        color: '',
        dimensions: '',
        inscriptionText: '',
        inscriptionLanguage: '',
        installationDate: null,
        status: 'planned',
        condition: '',
        notes: '',
      });
    }
  }, [open, form]);

  // Auto-fill cemetery name when order is selected
  const selectedOrderId = form.watch('orderId');
  const selectedOrder = ordersData?.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (selectedOrder && open) {
      if (selectedOrder.location) {
        form.setValue('cemeteryName', selectedOrder.location);
      }
    }
  }, [selectedOrder, open, form]);

  const onSubmit = (values: MemorialFormData) => {
    const payload = toMemorialInsert(values);
    createMemorial(payload, {
      onSuccess: () => {
        toast({
          title: 'Memorial created',
          description: 'Memorial has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to create memorial.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error creating memorial',
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
          <DrawerTitle>Create Memorial</DrawerTitle>
          <DrawerDescription>Add a new memorial record.</DrawerDescription>
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
                              {order.id} - {order.customer_name}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Deceased Name - REQUIRED */}
            <FormField
              control={form.control}
              name="deceasedName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deceased Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter deceased name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date of Birth and Date of Death */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Birth</FormLabel>
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
                            {field.value ? format(new Date(field.value), 'PPP') : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : null)}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfDeath"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Death</FormLabel>
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
                            {field.value ? format(new Date(field.value), 'PPP') : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : null)}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cemetery Name - REQUIRED */}
            <FormField
              control={form.control}
              name="cemeteryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cemetery Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter cemetery name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cemetery Section and Plot */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cemeterySection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cemetery Section</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter section" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cemeteryPlot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cemetery Plot</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter plot" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Memorial Type - REQUIRED */}
            <FormField
              control={form.control}
              name="memorialType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Memorial Type *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Headstone, Plaque, Marker" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Material, Color, Dimensions */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="material"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Granite" {...field} />
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
                    <FormControl>
                      <Input placeholder="e.g., Black" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dimensions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dimensions</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 24x12x6" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Inscription Text */}
            <FormField
              control={form.control}
              name="inscriptionText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inscription Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter inscription text..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Inscription Language */}
            <FormField
              control={form.control}
              name="inscriptionLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inscription Language</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., English" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status and Installation Date */}
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="installed">Installed</SelectItem>
                        <SelectItem value="removed">Removed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="installationDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Installation Date</FormLabel>
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
                            {field.value ? format(new Date(field.value), 'PPP') : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
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

            {/* Condition */}
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Excellent, Good, Fair" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Job Link (Optional - Placeholder for Phase 1) */}
            <FormField
              control={form.control}
              name="jobId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Job linking coming in Phase 2" 
                      disabled 
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isPending ? 'Creating...' : 'Create Memorial'}
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
- Auto-fills `cemeteryName` from `order.location` when order selected
- All required fields marked with `*`
- Date pickers use Calendar component with proper formatting
- Status dropdown with 4 options
- Job field is placeholder (disabled) for Phase 1
- Form resets when drawer opens
- Toast notifications on success/error

---

## Task 5: Create EditMemorialDrawer Component

**File:** `src/modules/memorials/components/EditMemorialDrawer.tsx`  
**Action:** CREATE

**Complete Code Structure:**

```typescript
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// ... same imports as CreateMemorialDrawer ...

interface EditMemorialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memorial: Memorial;
}

export const EditMemorialDrawer: React.FC<EditMemorialDrawerProps> = ({
  open,
  onOpenChange,
  memorial,
}) => {
  const { mutate: updateMemorial, isPending } = useUpdateMemorial();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  const form = useForm<MemorialFormData>({
    resolver: zodResolver(memorialFormSchema),
    defaultValues: {
      orderId: memorial.order_id,
      jobId: memorial.job_id || null,
      deceasedName: memorial.deceased_name,
      dateOfBirth: memorial.date_of_birth || null,
      dateOfDeath: memorial.date_of_death || null,
      cemeteryName: memorial.cemetery_name,
      cemeterySection: memorial.cemetery_section || '',
      cemeteryPlot: memorial.cemetery_plot || '',
      memorialType: memorial.memorial_type,
      material: memorial.material || '',
      color: memorial.color || '',
      dimensions: memorial.dimensions || '',
      inscriptionText: memorial.inscription_text || '',
      inscriptionLanguage: memorial.inscription_language || '',
      installationDate: memorial.installation_date || null,
      status: memorial.status,
      condition: memorial.condition || '',
      notes: memorial.notes || '',
    },
  });

  // Reset form when memorial changes
  useEffect(() => {
    if (memorial && open) {
      form.reset({
        orderId: memorial.order_id,
        jobId: memorial.job_id || null,
        deceasedName: memorial.deceased_name,
        dateOfBirth: memorial.date_of_birth || null,
        dateOfDeath: memorial.date_of_death || null,
        cemeteryName: memorial.cemetery_name,
        cemeterySection: memorial.cemetery_section || '',
        cemeteryPlot: memorial.cemetery_plot || '',
        memorialType: memorial.memorial_type,
        material: memorial.material || '',
        color: memorial.color || '',
        dimensions: memorial.dimensions || '',
        inscriptionText: memorial.inscription_text || '',
        inscriptionLanguage: memorial.inscription_language || '',
        installationDate: memorial.installation_date || null,
        status: memorial.status,
        condition: memorial.condition || '',
        notes: memorial.notes || '',
      });
    }
  }, [memorial, open, form]);

  // Auto-fill cemetery name when order changes
  const selectedOrderId = form.watch('orderId');
  const selectedOrder = ordersData?.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (selectedOrder && open) {
      if (selectedOrder.location) {
        form.setValue('cemeteryName', selectedOrder.location);
      }
    }
  }, [selectedOrder, open, form]);

  const onSubmit = (values: MemorialFormData) => {
    const payload = toMemorialUpdate(values);
    updateMemorial(
      { id: memorial.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Memorial updated',
            description: 'Memorial has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          let errorMessage = 'Failed to update memorial.';
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          toast({
            title: 'Error updating memorial',
            description: errorMessage,
            variant: 'destructive',
          });
        },
      }
    );
  };

  // ... same form structure as CreateMemorialDrawer, but with pre-filled values ...
};
```

**Key Points:**
- Pre-fills all fields from `memorial` prop
- Same form structure as Create drawer
- Uses `toMemorialUpdate` for payload
- Updates existing memorial by ID
- Toast notifications on success/error

---

## Task 6: Create DeleteMemorialDialog Component

**File:** `src/modules/memorials/components/DeleteMemorialDialog.tsx`  
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
import { useDeleteMemorial } from '../hooks/useMemorials';
import { useToast } from '@/shared/hooks/use-toast';
import type { Memorial } from '../hooks/useMemorials';

interface DeleteMemorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memorial: Memorial;
}

export const DeleteMemorialDialog: React.FC<DeleteMemorialDialogProps> = ({
  open,
  onOpenChange,
  memorial,
}) => {
  const { mutate: deleteMemorial, isPending } = useDeleteMemorial();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteMemorial(memorial.id, {
      onSuccess: () => {
        toast({
          title: 'Memorial deleted',
          description: 'Memorial has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to delete memorial.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error deleting memorial',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Memorial</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the memorial for{' '}
            <strong>{memorial.deceased_name}</strong> at{' '}
            <strong>{memorial.cemetery_name}</strong>? This action cannot be undone.
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
- Shows deceased name and cemetery name in confirmation
- Loading state on delete button
- Toast notifications on success/error
- Destructive styling on delete button

---

## Task 7: Build MemorialsPage

**File:** `src/modules/memorials/pages/MemorialsPage.tsx`  
**Action:** CREATE

**Complete Code Structure:**

```typescript
import React, { useMemo, useState } from 'react';
import { useMemorialsList } from '../hooks/useMemorials';
import { transformMemorialsFromDb } from '../utils/memorialTransform';
import { CreateMemorialDrawer } from '../components/CreateMemorialDrawer';
import { EditMemorialDrawer } from '../components/EditMemorialDrawer';
import { DeleteMemorialDialog } from '../components/DeleteMemorialDialog';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Memorial } from '../hooks/useMemorials';
import type { UIMemorial } from '../utils/memorialTransform';

const statusColors: Record<string, string> = {
  planned: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  installed: 'bg-green-500',
  removed: 'bg-red-500',
};

export const MemorialsPage: React.FC = () => {
  const { data: memorialsData, isLoading, error, refetch } = useMemorialsList();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMemorial, setSelectedMemorial] = useState<Memorial | null>(null);

  const memorials = useMemo(() => {
    if (!memorialsData) return [];
    return transformMemorialsFromDb(memorialsData);
  }, [memorialsData]);

  const filteredMemorials = useMemo(() => {
    if (!memorials) return [];
    
    let filtered = memorials;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.deceasedName.toLowerCase().includes(query) ||
          m.cemeteryName.toLowerCase().includes(query) ||
          (m.cemeteryPlot && m.cemeteryPlot.toLowerCase().includes(query)) ||
          m.memorialType.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((m) => m.status === statusFilter);
    }
    
    return filtered;
  }, [memorials, searchQuery, statusFilter]);

  const handleEdit = (memorial: UIMemorial) => {
    // Find original DB memorial
    const dbMemorial = memorialsData?.find((m) => m.id === memorial.id);
    if (dbMemorial) {
      setSelectedMemorial(dbMemorial);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (memorial: UIMemorial) => {
    const dbMemorial = memorialsData?.find((m) => m.id === memorial.id);
    if (dbMemorial) {
      setSelectedMemorial(dbMemorial);
      setDeleteDialogOpen(true);
    }
  };

  const formatCemeteryInfo = (memorial: UIMemorial) => {
    if (memorial.cemeterySection && memorial.cemeteryPlot) {
      return `${memorial.cemeteryName} - ${memorial.cemeterySection} ${memorial.cemeteryPlot}`;
    }
    return memorial.cemeteryName;
  };

  const formatInstallationDate = (date: string | null) => {
    if (!date) return 'Not installed';
    try {
      return format(new Date(date), 'MMM dd, yyyy');
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
              <p className="text-destructive mb-4">Error loading memorials</p>
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
          <h1 className="text-3xl font-bold">Memorials</h1>
          <p className="text-muted-foreground">
            Manage client memorial records for installed/planned memorials
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Memorial
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Memorials</CardTitle>
          <CardDescription>View and manage all memorial records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search by deceased name, cemetery, plot, or memorial type..."
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
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredMemorials.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No memorials match your filters'
                  : 'No memorials found'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Memorial
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deceased</TableHead>
                  <TableHead>Cemetery</TableHead>
                  <TableHead>Memorial Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Installation Date</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemorials.map((memorial) => (
                  <TableRow key={memorial.id}>
                    <TableCell className="font-medium">
                      {memorial.deceasedName}
                    </TableCell>
                    <TableCell>{formatCemeteryInfo(memorial)}</TableCell>
                    <TableCell>{memorial.memorialType}</TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[memorial.status] || 'bg-gray-500'}
                      >
                        {memorial.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatInstallationDate(memorial.installationDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {memorial.orderId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(memorial)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(memorial)}
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

      <CreateMemorialDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {selectedMemorial && (
        <>
          <EditMemorialDrawer
            open={editDrawerOpen}
            onOpenChange={(open) => {
              setEditDrawerOpen(open);
              if (!open) setSelectedMemorial(null);
            }}
            memorial={selectedMemorial}
          />

          <DeleteMemorialDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedMemorial(null);
            }}
            memorial={selectedMemorial}
          />
        </>
      )}
    </div>
  );
};
```

**Key Points:**
- Search filters by deceasedName, cemeteryName, cemeteryPlot, memorialType
- Status filter dropdown (all/planned/in_progress/installed/removed)
- Table columns: Deceased, Cemetery, Memorial Type, Status, Installation Date, Order, Actions
- Status badges with color coding
- Cemetery info shows name + section/plot if available
- Installation date formatted or "Not installed" if null
- Order shows truncated ID (can be enhanced to show customer name)
- Loading skeleton, empty state, error state
- Edit/Delete actions open respective drawers/dialog

---

## Task 8: Add Module Barrel

**File:** `src/modules/memorials/index.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
export { MemorialsPage } from './pages/MemorialsPage';
export { CreateMemorialDrawer } from './components/CreateMemorialDrawer';
export { EditMemorialDrawer } from './components/EditMemorialDrawer';
export { DeleteMemorialDialog } from './components/DeleteMemorialDialog';
export { useMemorialsList, useMemorial, useCreateMemorial, useUpdateMemorial, useDeleteMemorial } from './hooks/useMemorials';
export type { Memorial, MemorialInsert, MemorialUpdate } from './hooks/useMemorials';
export type { UIMemorial } from './utils/memorialTransform';
```

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add import and route:

```typescript
import { MemorialsPage } from "@/modules/memorials";

// Inside the dashboard routes:
<Route path="memorials" element={<MemorialsPage />} />
```

**Location:** Add after other module routes (orders, customers, companies, jobs, etc.)

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:

```typescript
import { Landmark } from 'lucide-react';

// Inside the navigation items array:
{
  title: 'Memorials',
  url: '/dashboard/memorials',
  icon: Landmark,
}
```

**Location:** Add in the operational section, near Orders/Jobs/Memorials.

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

1. **Create Memorial:**
   - Click "New Memorial"
   - Select an order (should auto-fill cemetery name)
   - Fill required fields (deceased name, cemetery name, memorial type)
   - Submit → should create, show toast, close drawer, refresh list

2. **Edit Memorial:**
   - Click edit icon on a memorial
   - Change fields
   - Submit → should update, show toast, close drawer, refresh list

3. **Delete Memorial:**
   - Click delete icon on a memorial
   - Confirm → should delete, show toast, close dialog, refresh list

4. **Search:**
   - Type in search box
   - Should filter by deceased name, cemetery, plot, memorial type
   - Clear search → should show all

5. **Status Filter:**
   - Select status from dropdown
   - Should filter memorials by status
   - Select "All Statuses" → should show all

6. **Navigation:**
   - Click "Memorials" in sidebar
   - Should navigate to `/dashboard/memorials`
   - Route should render without errors

### Validation Checklist

- [ ] All TypeScript types defined (no `any`)
- [ ] Zod schema validates required fields
- [ ] Transform functions map DB ↔ UI correctly
- [ ] Query keys invalidate on mutations
- [ ] Order dropdown loads and auto-fills cemetery name
- [ ] Date fields format correctly (display and save)
- [ ] Status badges display with correct colors
- [ ] Search filters work correctly
- [ ] Status filter works correctly
- [ ] Loading/empty/error states render
- [ ] Toast notifications fire on success/error
- [ ] Drawers/dialog close on success
- [ ] Router includes `/dashboard/memorials`
- [ ] Sidebar shows "Memorials" with icon
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No console errors
- [ ] No changes to existing modules

---

## Summary

This implementation plan provides complete step-by-step instructions for building the Memorials CRUD module. Each task includes:

- File path and action (CREATE/UPDATE)
- Complete code examples
- Key implementation points
- Integration details

The module follows the same architecture as Orders, Customers, Companies, and Jobs modules for consistency and maintainability.

**Ready for implementation via `/implement` command**

