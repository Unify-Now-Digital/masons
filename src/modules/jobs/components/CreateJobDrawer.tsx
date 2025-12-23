import React, { useEffect, useMemo } from 'react';
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

interface CreateJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateJobDrawer: React.FC<CreateJobDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutateAsync: createJobAsync, isPending } = useCreateJob();
  const { mutateAsync: updateOrderAsync } = useUpdateOrder();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();
  const { data: customers } = useCustomersList();

  // Filter Orders to show only unassigned ones
  const availableOrders = useMemo(() => {
    return ordersData?.filter(order => !order.job_id) || [];
  }, [ordersData]);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      order_ids: [],
      assigned_people_ids: [],
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

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.reset({
        order_ids: [],
        assigned_people_ids: [],
        location_name: '',
        address: '',
        latitude: null,
        longitude: null,
        status: 'scheduled',
        scheduled_date: null,
        estimated_duration: '',
        priority: 'medium',
        notes: '',
      });
    }
  }, [open, form]);

  // Auto-fill location from first selected Order
  const selectedOrderIds = form.watch('order_ids');
  const firstSelectedOrder = useMemo(() => {
    if (!selectedOrderIds || selectedOrderIds.length === 0) return null;
    return ordersData?.find(order => order.id === selectedOrderIds[0]);
  }, [selectedOrderIds, ordersData]);

  useEffect(() => {
    if (firstSelectedOrder && open) {
      // Only auto-fill if fields are empty (don't override user edits)
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
  }, [firstSelectedOrder, open, form]);

  const onSubmit = async (values: JobFormData) => {
    // Extract UI-only fields
    const { order_ids, assigned_people_ids, ...jobData } = values;
    
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
      
      toast({
        title: 'Job created',
        description: `Job and ${order_ids.length} order(s) updated successfully.`,
      });
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
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Create Job</DrawerTitle>
          <DrawerDescription>Add a new installation job with orders.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 px-4 pb-4 overflow-y-auto flex-1">
              {/* Orders Multi-Select */}
              <FormField
                control={form.control}
                name="order_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orders *</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* People Multi-Select */}
              <FormField
                control={form.control}
                name="assigned_people_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned People (Optional)</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location Fields */}
              <FormField
                control={form.control}
                name="location_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter cemetery/location name" {...field} />
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || 'scheduled'}
                      >
                        <FormControl>
                          <SelectTrigger>
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || 'medium'}
                      >
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
            </div>

            <DrawerFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create'}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};
