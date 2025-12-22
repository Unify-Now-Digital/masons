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
import { useUpdateMemorial, type Memorial } from '../hooks/useMemorials';
import { memorialFormSchema, type MemorialFormData } from '../schemas/memorial.schema';
import { toMemorialUpdate } from '../utils/memorialTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

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
            title: 'Product updated',
            description: 'Product has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          let errorMessage = 'Failed to update product.';
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          toast({
            title: 'Error updating product',
            description: errorMessage,
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
          <DrawerTitle>Edit Product</DrawerTitle>
          <DrawerDescription>Update product information.</DrawerDescription>
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
                  <FormLabel>Product Type *</FormLabel>
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
                {isPending ? 'Updating...' : 'Update Memorial'}
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

