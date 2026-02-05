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
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { useCreateJob } from '../hooks/useJobs';
import { jobFormSchema, type JobFormData } from '../schemas/job.schema';
import { toJobInsert } from '../utils/jobTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList, useUpdateOrder } from '@/modules/orders/hooks/useOrders';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useWorkers, useSetWorkersForJob } from '@/modules/workers/hooks/useWorkers';

interface CreateJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOrderIds?: string[]; // NEW - pre-fill order_ids
  initialLocation?: string; // NEW - pre-fill location
  onJobCreated?: () => void; // NEW - callback after successful creation
  onError?: (error: Error) => void; // NEW - error callback
}

export const CreateJobDrawer: React.FC<CreateJobDrawerProps> = ({
  open,
  onOpenChange,
  initialOrderIds = [],
  initialLocation = '',
  onJobCreated,
  onError,
}) => {
  const { mutateAsync: createJobAsync, isPending } = useCreateJob();
  const { mutateAsync: updateOrderAsync } = useUpdateOrder();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();
  const { data: customers } = useCustomersList();
  const { data: workers } = useWorkers({ activeOnly: true });
  const { mutateAsync: setWorkersAsync } = useSetWorkersForJob();

  // Filter Orders to show only unassigned ones
  const availableOrders = useMemo(() => {
    return ordersData?.filter(order => !order.job_id) || [];
  }, [ordersData]);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      order_ids: initialOrderIds,
      assigned_people_ids: [],
      worker_ids: [],
      location_name: initialLocation,
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

  const didInitRef = useRef(false);

  // Clear any draft state when the drawer has been closed
  useOnDrawerReset(() => {
    form.reset();
    didInitRef.current = false;
  });

  // Initialize form once per open cycle to avoid overwriting user input while typing
  useEffect(() => {
    if (!open) {
      didInitRef.current = false;
      return;
    }
    if (didInitRef.current) return;

    form.reset({
      order_ids: initialOrderIds,
      assigned_people_ids: [],
      worker_ids: [],
      location_name: initialLocation,
      address: '',
      latitude: null,
      longitude: null,
      status: 'scheduled',
      scheduled_date: null,
      estimated_duration: '',
      priority: 'medium',
      notes: '',
    });

    didInitRef.current = true;
  }, [open, form, initialOrderIds, initialLocation]);

  // Auto-fill location from first selected Order (only if not provided via initialLocation)
  const selectedOrderIds = form.watch('order_ids');
  const firstSelectedOrder = useMemo(() => {
    if (!selectedOrderIds || selectedOrderIds.length === 0) return null;
    return ordersData?.find(order => order.id === selectedOrderIds[0]);
  }, [selectedOrderIds, ordersData]);

  useEffect(() => {
    if (firstSelectedOrder && open && !initialLocation) {
      // Only auto-fill if initialLocation was not provided and fields are empty
      if (!form.getValues('location_name') && firstSelectedOrder.location) {
        form.setValue('location_name', firstSelectedOrder.location);
      }
      if (!form.getValues('latitude') && firstSelectedOrder.latitude !== null) {
        form.setValue('latitude', firstSelectedOrder.latitude);
      }
      if (!form.getValues('longitude') && firstSelectedOrder.longitude !== null) {
        form.setValue('longitude', firstSelectedOrder.longitude);
      }
    }
  }, [firstSelectedOrder, open, form, initialLocation]);

  const onSubmit = async (values: JobFormData) => {
    // Validate order_ids for CreateJobDrawer (required for job creation)
    if (!values.order_ids || values.order_ids.length === 0) {
      toast({
        title: 'Validation error',
        description: 'At least one order is required to create a job.',
        variant: 'destructive',
      });
      return;
    }

    // Extract UI-only fields
    const { order_ids, assigned_people_ids, worker_ids, ...jobData } = values;
    
    // Build People snapshot text
    let assignedPeopleText = '';
    if (assigned_people_ids && assigned_people_ids.length > 0 && customers) {
      const assignedPeople = customers
        .filter(c => assigned_people_ids.includes(c.id))
        .map(c => `${c.first_name} ${c.last_name}`)
        .join(', ');
      assignedPeopleText = `Assigned People: ${assignedPeople}\n\n`;
    }
    
    // Build Job payload (without UI-only fields)
    const jobPayload = toJobInsert({
      ...jobData,
      notes: assignedPeopleText + (jobData.notes || ''),
      order_ids, // Include in form data for transform, but it will be excluded
      assigned_people_ids, // Include in form data for transform, but it will be excluded
    });
    
    try {
      // Create Job first
      const createdJob = await createJobAsync(jobPayload);
      
      // Update Orders with job_id
      await Promise.all(
        order_ids.map(orderId => 
          updateOrderAsync({ id: orderId, updates: { job_id: createdJob.id } })
        )
      );
      
      // Assign workers if any selected
      if (worker_ids && worker_ids.length > 0) {
        await setWorkersAsync({ jobId: createdJob.id, workerIds: worker_ids });
      }
      
      toast({
        title: 'Job created',
        description: `Job and ${order_ids.length} order(s) updated successfully.`,
      });
      
      // Call success callback if provided
      onJobCreated?.();
      
      form.reset();
      onOpenChange(false);
    } catch (error) {
      let errorMessage = 'Failed to create job.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      toast({
        title: 'Error creating job',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Call error callback if provided
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
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
              title="Create Job"
              description="Add a new installation job with orders."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Creating...' : 'Create'}
              primaryDisabled={isPending}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
            <div className="space-y-4 px-4 pb-4">
              {/* Orders Multi-Select */}
              <FormField
                control={form.control}
                name="order_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Orders *</FormLabel>
                    <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                      {availableOrders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No available orders</p>
                      ) : (
                        availableOrders.map((order) => (
                          <div key={order.id} className="flex items-center space-x-2 py-2">
                            <Checkbox
                              id={order.id}
                              checked={field.value?.includes(order.id)}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, order.id]);
                                } else {
                                  field.onChange(currentValue.filter(id => id !== order.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={order.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {order.customer_name} - {order.location || 'No location'} - {order.order_type}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* People Multi-Select */}
              <FormField
                control={form.control}
                name="assigned_people_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Assigned People (Optional)</FormLabel>
                    <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                      {!customers || customers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No people available</p>
                      ) : (
                        customers.map((person) => (
                          <div key={person.id} className="flex items-center space-x-2 py-2">
                            <Checkbox
                              id={`person-${person.id}`}
                              checked={field.value?.includes(person.id)}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, person.id]);
                                } else {
                                  field.onChange(currentValue.filter(id => id !== person.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`person-${person.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {person.first_name} {person.last_name}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Workers Multi-Select */}
              <FormField
                control={form.control}
                name="worker_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Assigned Workers (Optional)</FormLabel>
                    <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                      {!workers || workers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No workers available</p>
                      ) : (
                        workers.map((worker) => (
                          <div key={worker.id} className="flex items-center space-x-2 py-2">
                            <Checkbox
                              id={`worker-${worker.id}`}
                              checked={field.value?.includes(worker.id)}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, worker.id]);
                                } else {
                                  field.onChange(currentValue.filter(id => id !== worker.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`worker-${worker.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {worker.full_name} ({worker.role})
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {/* Location Fields */}
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
                    <FormMessage className="text-[11px]" />
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || 'scheduled'}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Planned</SelectItem>
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || 'medium'}
                      >
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
            </div>
            </AppDrawerLayout>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
