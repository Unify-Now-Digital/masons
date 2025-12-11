# Detailed Implementation Plan: Jobs Module (Phase 1)

**Branch:** `feature/jobs-crud-integration`  
**Specification:** `specs/jobs-crud-integration-plan.md`  
**Implementation Plan:** `specs/jobs-implementation-plan.md`

---

## Overview

This plan provides step-by-step implementation details for the Jobs module, following the same architecture as Customers, Orders, and Companies modules. All code examples use TypeScript, React Hook Form, Zod validation, and TanStack Query.

**Key Features:**
- CRUD operations for installation/scheduling jobs
- Order linking with auto-fill functionality
- Status and priority tracking
- Date scheduling with calendar picker
- Search and filter capabilities

---

## Task 1: Create Job Schema

**File:** `src/modules/jobs/schemas/job.schema.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { z } from 'zod';

export const jobFormSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().min(1, 'Customer name is required'),
  location_name: z.string().trim().min(1, 'Location name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum(['scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled']).default('scheduled'),
  scheduled_date: z.string().optional().nullable(),
  estimated_duration: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type JobFormData = z.infer<typeof jobFormSchema>;
```

**Key Points:**
- `customer_name`, `location_name`, `address` are required
- `order_id` is optional UUID (can be null for standalone jobs)
- `status` defaults to 'scheduled'
- `priority` defaults to 'medium'
- Optional string fields allow empty strings (normalized to `null` in transforms)
- `latitude`/`longitude` are optional numbers for map integration

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/jobs/utils/jobTransform.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import type { Job, JobInsert, JobUpdate } from '../hooks/useJobs';
import type { JobFormData } from '../schemas/job.schema';

// UI-friendly job format (camelCase)
export interface UIJob {
  id: string;
  orderId: string | null;
  customerName: string;
  locationName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  scheduledDate: string;
  estimatedDuration: string;
  priority: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Transform database job to UI-friendly format
 */
export function transformJobFromDb(job: Job): UIJob {
  return {
    id: job.id,
    orderId: job.order_id,
    customerName: job.customer_name,
    locationName: job.location_name,
    address: job.address,
    latitude: job.latitude,
    longitude: job.longitude,
    status: job.status,
    scheduledDate: job.scheduled_date || '',
    estimatedDuration: job.estimated_duration || '',
    priority: job.priority,
    notes: job.notes || '',
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

/**
 * Transform array of database jobs to UI format
 */
export function transformJobsFromDb(jobs: Job[]): UIJob[] {
  return jobs.map(transformJobFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toJobInsert(form: JobFormData): JobInsert {
  return {
    order_id: form.order_id || null,
    customer_name: form.customer_name.trim(),
    location_name: form.location_name.trim(),
    address: form.address.trim(),
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    status: form.status,
    scheduled_date: normalizeOptional(form.scheduled_date),
    estimated_duration: normalizeOptional(form.estimated_duration),
    priority: form.priority,
    notes: normalizeOptional(form.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toJobUpdate(form: JobFormData): JobUpdate {
  return {
    order_id: form.order_id || null,
    customer_name: form.customer_name.trim(),
    location_name: form.location_name.trim(),
    address: form.address.trim(),
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    status: form.status,
    scheduled_date: normalizeOptional(form.scheduled_date),
    estimated_duration: normalizeOptional(form.estimated_duration),
    priority: form.priority,
    notes: normalizeOptional(form.notes),
  };
}
```

**Key Points:**
- `transformJobFromDb` converts snake_case DB fields to camelCase UI fields
- Empty strings normalized to `null` for optional fields
- `toJobInsert` and `toJobUpdate` prepare form data for Supabase

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/jobs/hooks/useJobs.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Job {
  id: string;
  order_id: string | null;
  customer_name: string;
  location_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
  scheduled_date: string | null;
  estimated_duration: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type JobInsert = Omit<Job, 'id' | 'created_at' | 'updated_at'>;
export type JobUpdate = Partial<JobInsert>;

export const jobsKeys = {
  all: ['jobs'] as const,
  detail: (id: string) => ['jobs', id] as const,
};

async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Job[];
}

async function fetchJob(id: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Job;
}

async function createJob(job: JobInsert) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select()
    .single();
  
  if (error) throw error;
  return data as Job;
}

async function updateJob(id: string, updates: JobUpdate) {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Job;
}

async function deleteJob(id: string) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function useJobsList() {
  return useQuery({
    queryKey: jobsKeys.all,
    queryFn: fetchJobs,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobsKeys.detail(id),
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (job: JobInsert) => createJob(job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: JobUpdate }) => 
      updateJob(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
      queryClient.setQueryData(jobsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}
```

**Key Points:**
- Query ordering: scheduled_date ASC (nulls last), then created_at DESC
- All mutations invalidate list queries
- Update mutation also sets detail cache
- Error handling via throw (handled by React Query)

---

## Task 4: Create CreateJobDrawer Component

**File:** `src/modules/jobs/components/CreateJobDrawer.tsx`  
**Action:** CREATE

**Complete Code:**

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
import { cn } from '@/lib/utils';
import { useCreateJob } from '../hooks/useJobs';
import { jobFormSchema, type JobFormData } from '../schemas/job.schema';
import { toJobInsert } from '../utils/jobTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

interface CreateJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateJobDrawer: React.FC<CreateJobDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createJob, isPending } = useCreateJob();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      order_id: null,
      customer_name: '',
      location_name: '',
      address: '',
      latitude: null,
      longitude: null,
      status: 'scheduled',
      scheduled_date: null,
      estimated_duration: '',
      priority: 'medium',
      notes: '',
    },
  });

  // Auto-fill customer and location when order is selected
  const selectedOrderId = form.watch('order_id');
  const selectedOrder = ordersData?.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (selectedOrder) {
      form.setValue('customer_name', selectedOrder.customer_name);
      if (selectedOrder.location) {
        form.setValue('location_name', selectedOrder.location);
      }
    }
  }, [selectedOrder, form]);

  const onSubmit = (values: JobFormData) => {
    const payload = toJobInsert(values);
    createJob(payload, {
      onSuccess: () => {
        toast({
          title: 'Job created',
          description: 'Job has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const description =
          error instanceof Error ? error.message : 'Failed to create job.';
        toast({
          title: 'Error creating job',
          description,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Create Job</DrawerTitle>
          <DrawerDescription>Add a new installation job.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
            <FormField
              control={form.control}
              name="order_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value || null)}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an order" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {ordersData?.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.id} - {order.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter cemetery/location name" {...field} />
                  <FormControl>
                    <Input />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="ready_for_installation">Ready for Installation</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scheduled_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Scheduled Date</FormLabel>
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
                          {field.value ? (
                            format(new Date(field.value), 'PPP')
                          ) : (
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

            <FormField
              control={form.control}
              name="estimated_duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Duration</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2 hours" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g., 40.7128"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g., -74.0060"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {isPending ? 'Creating...}
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
- Order dropdown fetches from `useOrdersList()`
- Auto-fills customer_name and location_name when order selected
- Date picker uses Calendar component with date-fns formatting
- Latitude/longitude are number inputs
- Form validation via Zod schema

---

## Task 5: Create EditJobDrawer Component

**File:** `src/modules/jobs/components/EditJobDrawer.tsx`  
**Action:** CREATE

**Complete Code:**

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
import { cn } from '@/lib/utils';
import { useUpdateJob, type Job } from '../hooks/useJobs';
import { jobFormSchema, type JobFormData } from '../schemas/job.schema';
import { toJobUpdate } from '../utils/jobTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

interface EditJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

export const EditJobDrawer: React.FC<EditJobDrawerProps> = ({
  open,
  onOpenChange,
  job,
}) => {
  const { mutate: updateJob, isPending } = useUpdateJob();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      order_id: job.order_id || null,
      customer_name: job.customer_name,
      location_name: job.location_name,
      address: job.address,
      latitude: job.latitude || null,
      longitude: job.longitude || null,
      status: job.status,
      scheduled_date: job.scheduled_date || null,
      estimated_duration: job.estimated_duration || '',
      priority: job.priority,
      notes: job.notes || '',
    },
  });

  // Reset form when job changes
  useEffect(() => {
    form.reset({
      order_id: job.order_id || null,
      customer_name: job.customer_name,
      location_name: job.location_name,
      address: job.address,
      latitude: job.latitude || null,
      longitude: job.longitude || null,
      status: job.status,
      scheduled_date: job.scheduled_date || null,
      estimated_duration: job.estimated_duration || '',
      priority: job.priority,
      notes: job.notes || '',
    });
  }, [job, form]);

  // Auto-fill customer and location when order is selected
  const selectedOrderId = form.watch('order_id');
  const selectedOrder = ordersData?.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (selectedOrder) {
      form.setValue('customer_name', selectedOrder.customer_name);
      if (selectedOrder.location) {
        form.setValue('location_name', selectedOrder.location);
      }
    }
  }, [selectedOrder, form]);

  const onSubmit = (values: JobFormData) => {
    const payload = toJobUpdate(values);
    updateJob(
      { id: job.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Job updated',
            description: 'Job has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : 'Failed to update job.';
          toast({
            title: 'Error updating job',
            description,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Edit Job</DrawerTitle>
          <DrawerDescription>Update job information.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
            {/* Same form fields as CreateJobDrawer */}
            {/* Copy all FormField components from CreateJobDrawer */}
            
            <DrawerFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Updating...' : 'Update Job'}
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
- Pre-fills form with existing job data
- Resets form when job prop changes
- Same form structure as CreateJobDrawer
- Uses `toJobUpdate` for payload transformation

---

## Task 6: Create DeleteJobDialog Component

**File:** `src/modules/jobs/components/DeleteJobDialog.tsx`  
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
import { useDeleteJob, type Job } from '../hooks/useJobs';
import { useToast } from '@/shared/hooks/use-toast';

interface DeleteJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

export const DeleteJobDialog: React.FC<DeleteJobDialogProps> = ({
  open,
  onOpenChange,
  job,
}) => {
  const { mutate: deleteJob, isPending } = useDeleteJob();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteJob(job.id, {
      onSuccess: () => {
        toast({
          title: 'Job deleted',
          description: 'Job has been deleted successfully.',
        });
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        const description =
          error instanceof Error ? error.message : 'Failed to delete job.';
        toast({
          title: 'Error deleting job',
          description,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the job for{' '}
            <strong>{job.customer_name}</strong> at <strong>{job.location_name}</strong>
            {job.status && ` (Status: ${job.status.replace('_', ' ')})`}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
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
- Confirmation dialog with job details
- Destructive button styling
- Loading state during deletion
- Toast notifications for success/error

---

## Task 7: Build JobsPage

**File:** `src/modules/jobs/pages/JobsPage.tsx`  
**Action:** CREATE

**Complete Code:**

```typescript
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Search, Plus, Hammer, RefreshCw, Pencil, Trash2, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { useJobsList, type Job } from '../hooks/useJobs';
import { transformJobsFromDb, type UIJob } from '../utils/jobTransform';
import { CreateJobDrawer } from '../components/CreateJobDrawer';
import { EditJobDrawer } from '../components/EditJobDrawer';
import { DeleteJobDialog } from '../components/DeleteJobDialog';
import { format } from 'date-fns';

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'default';
    case 'in_progress':
      return 'secondary';
    case 'ready_for_installation':
      return 'default';
    case 'completed':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-700';
    case 'ready_for_installation':
      return 'bg-green-100 text-green-700';
    case 'completed':
      return 'bg-gray-100 text-gray-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
};

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export const JobsPage: React.FC = () => {
  const { data: jobsData, isLoading, error, refetch } = useJobsList();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  const uiJobs = useMemo<UIJob[]>(() => {
    if (!jobsData) return [];
    return transformJobsFromDb(jobsData);
  }, [jobsData]);

  const filteredJobs = useMemo(() => {
    let filtered = uiJobs;

    // Search filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      filtered = filtered.filter((job) => {
        return (
          job.customerName.toLowerCase().includes(query) ||
          job.address.toLowerCase().includes(query) ||
          job.locationName.toLowerCase().includes(query)
        );
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }

    return filtered;
  }, [uiJobs, searchQuery, statusFilter]);

  const handleEdit = (jobId: string) => {
    const dbJob = jobsData?.find((j) => j.id === jobId);
    if (dbJob) {
      setJobToEdit(dbJob);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (jobId: string) => {
    const dbJob = jobsData?.find((j) => j.id === jobId);
    if (dbJob) {
      setJobToDelete(dbJob);
      setDeleteDialogOpen(true);
    }
  };

  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-6 flex items-center justify-between">
            <div className="text-red-600">
              {error instanceof Error ? error.message : 'Failed to load jobs.'}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (filteredJobs.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Hammer className="h-10 w-10 text-slate-400 mx-auto" />
            <div className="text-lg font-medium">No jobs found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Create your first job to get started.'}
            </div>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={() => setCreateDrawerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scheduled Date</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredJobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{job.customerName}</TableCell>
              <TableCell>{job.locationName}</TableCell>
              <TableCell className="max-w-[200px] truncate">{job.address}</TableCell>
              <TableCell>
                <Badge className={getStatusBadgeColor(job.status)}>
                  {formatStatus(job.status)}
                </Badge>
              </TableCell>
              <TableCell>
                {job.scheduledDate
                  ? format(new Date(job.scheduledDate), 'MMM dd, yyyy')
                  : 'Not scheduled'}
              </TableCell>
              <TableCell>
                <span className={getPriorityColor(job.priority)}>
                  {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                </span>
              </TableCell>
              <TableCell>{job.estimatedDuration || '-'}</TableCell>
              <TableCell className="text-sm text-slate-600">
                {format(new Date(job.createdAt), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(job.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(job.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage installation jobs and schedules
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, address, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="ready_for_installation">Ready for Installation</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderTable()}
        </CardContent>
      </Card>

      <CreateJobDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />
      {jobToEdit && (
        <EditJobDrawer
          open={editDrawerOpen}
          onOpenChange={setEditDrawerOpen}
          job={jobToEdit}
        />
      )}
      {jobToDelete && (
        <DeleteJobDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          job={jobToDelete}
        />
      )}
    </div>
  );
};
```

**Key Points:**
- Search filters by customer, address, location
- Status filter dropdown
- Color-coded status badges
- Priority display with color coding
- Formatted dates with "Not scheduled" fallback
- Loading, error, and empty states
- Row actions for edit/delete

---

## Task 8: Add Module Barrel

**File:** `src/modules/jobs/index.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
export { JobsPage } from './pages/JobsPage';
export { CreateJobDrawer } from './components/CreateJobDrawer';
export { EditJobDrawer } from './components/EditJobDrawer';
export { DeleteJobDialog } from './components/DeleteJobDialog';
export * from './hooks/useJobs';
export * from './schemas/job.schema';
export * from './utils/jobTransform';
```

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add import and route:

```typescript
import { JobsPage } from "@/modules/jobs";
// ... existing imports ...

<Route path="/dashboard" element={<DashboardLayout />}>
  {/* ... existing routes ... */}
  <Route path="jobs" element={<JobsPage />} />
  {/* ... other routes ... */}
</Route>
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add import and navigation item:

```typescript
import { Hammer } from 'lucide-react';
// ... existing imports ...

const navigationItems = [
  // ... existing items ...
  { title: "Jobs", url: "/dashboard/jobs", icon: Hammer },
  // ... other items ...
];
```

---

## Task 11: Validation & QA

**Actions:**
1. Run `npm run lint` - fix any ESLint errors
2. Run `npm run build` - ensure TypeScript compilation succeeds
3. Test manual flows:
   - Create job → appears in list
   - Create job with order → auto-fills customer/location
   - Edit job → changes reflected
   - Delete job → removed from list
   - Search/filter → works correctly
   - Navigation → route loads without errors

---

## Dependencies Required

Ensure these packages are installed:
- `date-fns` - for date formatting
- `@hookform/resolvers` - for Zod resolver
- `react-hook-form` - for form management
- `zod` - for schema validation
- `@tanstack/react-query` - for data fetching
- `lucide-react` - for icons

---

## Notes

### Order Integration
- Jobs can be linked to orders via `order_id`
- When order selected, customer_name and location_name auto-fill
- User can still edit auto-filled fields
- Jobs can exist without orders (standalone)

### Date Handling
- `scheduled_date` stored as ISO date string (YYYY-MM-DD)
- Display formatted with date-fns
- Calendar component from shadcn/ui

### Status Colors
- `scheduled`: Blue
- `in_progress`: Yellow
- `ready_for_installation`: Green
- `completed`: Gray
- `cancelled`: Red

### Priority Colors
- `high`: Red
- `medium`: Yellow
- `low`: Green

---

*Implementation Plan created: Jobs Module Phase 1 CRUD Integration*  
*Ready for execution via `/implement` command*

