import React, { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer, DrawerContent, useOnDrawerReset } from '@/shared/components/ui/drawer';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';
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
import { useUpdateJob, type Job } from '../hooks/useJobs';
import { jobFormSchema, type JobFormData } from '../schemas/job.schema';
import { toJobUpdate } from '../utils/jobTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { useWorkersByJob } from '@/modules/workers/hooks/useWorkers';
import { AssignWorkersDialog } from './AssignWorkersDialog';
import { Badge } from '@/shared/components/ui/badge';
import { UserCog } from 'lucide-react';

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
  const { data: assignedWorkers } = useWorkersByJob(job.id);
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);

  // Compute default values with proper schema structure
  // order_ids can be empty array for EditJobDrawer (jobs may have no orders)
  const defaultValues = useMemo(() => {
    try {
      return {
        order_ids: job.order_id ? [job.order_id] : [],
        worker_ids: assignedWorkers?.map(w => w.id) || [],
        assigned_people_ids: [],
        customer_name: job.customer_name || '',
        location_name: job.location_name || '',
        address: job.address || '',
        latitude: job.latitude ?? null,
        longitude: job.longitude ?? null,
        status: job.status || 'scheduled',
        scheduled_date: job.scheduled_date || null,
        estimated_duration: job.estimated_duration || '',
        priority: job.priority || 'medium',
        notes: job.notes || '',
      };
    } catch (error) {
      console.error('Error computing default values:', error);
      // Return safe defaults
      return {
        order_ids: [],
        worker_ids: [],
        assigned_people_ids: [],
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
      };
    }
  }, [job, assignedWorkers]);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues,
    mode: 'onBlur', // Only validate on blur, not on mount or change
  });

  const didInitRef = useRef(false);

  // Initialize form once per open cycle to avoid overwriting user input while typing
  useEffect(() => {
    if (!open) {
      didInitRef.current = false;
      return;
    }
    if (didInitRef.current) return;

    form.reset({
      order_ids: job.order_id ? [job.order_id] : [],
      worker_ids: assignedWorkers?.map(w => w.id) || [],
      assigned_people_ids: [],
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

    didInitRef.current = true;
  }, [open, job, assignedWorkers, form]);

  // Clear any draft state when the drawer has been closed
  useOnDrawerReset(() => {
    form.reset();
    didInitRef.current = false;
  });

  // Auto-fill customer and location when order is selected (using first order_id from order_ids array)
  const selectedOrderIds = form.watch('order_ids');
  const selectedOrderId = selectedOrderIds && selectedOrderIds.length > 0 ? selectedOrderIds[0] : null;
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
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <div data-jobs-drawer-root className="flex flex-col flex-1 min-h-0">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 min-h-0"
            >
            <AppDrawerLayout
              title="Edit Job"
              description="Update job information."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Updating...' : 'Update Job'}
              primaryDisabled={isPending}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
            <div className="space-y-4 px-4 pb-4">
            {/* Note: order_ids is UI-only field for CreateJobDrawer. 
                EditJobDrawer doesn't need to edit orders, but we keep it in form for schema compatibility.
                The order_id from job is already set in defaultValues. */}

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Customer Name *</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="Enter customer name" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Location Name *</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="Enter cemetery/location name" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Address *</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="Enter address" {...field} />
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
                    <FormLabel className="text-xs font-medium">Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Priority *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scheduled_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Scheduled Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'h-9 w-full pl-3 text-left font-normal text-xs',
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
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimated_duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Estimated Duration</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="e.g., 2 hours" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Latitude</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9"
                        type="number"
                        step="any"
                        placeholder="e.g., 40.7128"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Longitude</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9"
                        type="number"
                        step="any"
                        placeholder="e.g., -74.0060"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes..."
                      className="min-h-[60px] resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Workers Section */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserCog className="h-4 w-4" />
                  <FormLabel>Assigned Workers</FormLabel>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  Assign Workers
                </Button>
              </div>
              {assignedWorkers && assignedWorkers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {assignedWorkers.map((worker) => {
                    const initials = worker.full_name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <Badge
                        key={worker.id}
                        variant="secondary"
                        className="h-8 px-3 flex items-center gap-2"
                      >
                        <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                          {initials}
                        </span>
                        <span>{worker.full_name}</span>
                        <span className="text-xs opacity-70">({worker.role})</span>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No workers assigned</p>
              )}
            </div>
            </div>
            </AppDrawerLayout>
            </form>
          </Form>
          <AssignWorkersDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            jobId={job.id}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

