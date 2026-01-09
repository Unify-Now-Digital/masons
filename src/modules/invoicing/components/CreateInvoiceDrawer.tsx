import React, { useState, useMemo, useEffect } from 'react';
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
import { useCreateInvoice } from '../hooks/useInvoices';
import { invoiceFormSchema, type InvoiceFormData } from '../schemas/invoice.schema';
import { useToast } from '@/shared/hooks/use-toast';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useCreateOrder, useCreateAdditionalOption } from '@/modules/orders/hooks/useOrders';
import { orderFormSchema, type OrderFormData } from '@/modules/orders/schemas/order.schema';
import { OrderFormInline } from './OrderFormInline';
import { getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import type { Order } from '@/modules/orders/types/orders.types';
import { toMoneyNumber } from '@/modules/orders/utils/numberParsing';
import { useGeocodeOrderAddress } from '@/modules/orders/hooks/useGeocodeOrderAddress';

interface CreateInvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to build notes with dimensions prefix
const buildNotes = (dimensions: string, notes: string): string | null => {
  const parts: string[] = [];
  
  if (dimensions?.trim()) {
    parts.push(`Dimensions: ${dimensions.trim()}`);
  }
  
  if (notes?.trim()) {
    parts.push(notes.trim());
  }
  
  return parts.length > 0 ? parts.join('\n\n') : null;
};

// Sentinel value for "no person selected" in Radix Select (cannot use empty string)
const NO_PERSON_SENTINEL = '__none__';

/**
 * Calculate the total cost of inline additional options from form data
 * @param orderData - Partial order form data containing additional_options array
 * @returns Sum of all option costs (defensive: blank/null => 0, no NaN)
 */
function getInlineOptionsTotal(orderData: Partial<OrderFormData>): number {
  const options = orderData.additional_options || [];
  return options.reduce((sum, opt) => {
    if (!opt || !opt.name?.trim()) {
      // Skip options without a name (not valid)
      return sum;
    }
    // Use toMoneyNumber for defensive parsing (blank/null/undefined => 0)
    const cost = toMoneyNumber(opt.cost);
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);
}

export const CreateInvoiceDrawer: React.FC<CreateInvoiceDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutateAsync: createInvoiceAsync, isPending } = useCreateInvoice();
  const { mutateAsync: createOrderAsync } = useCreateOrder();
  const { mutateAsync: createOptionAsync } = useCreateAdditionalOption();
  const geocodeMutation = useGeocodeOrderAddress();
  const { toast } = useToast();
  const { data: customers } = useCustomersList();
  
  const [orders, setOrders] = useState<Array<{ id: string; data: Partial<OrderFormData> }>>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
  const [dimensions, setDimensions] = useState<Record<string, string>>({});

  // Calculate amount from Orders (includes base value + permit cost + additional options)
  const calculatedAmount = useMemo(() => {
    return orders.reduce((sum, order) => {
      // Calculate inline options total from form data (not from additional_options_total which is 0 for unsaved orders)
      const inlineOptionsTotal = getInlineOptionsTotal(order.data);
      
      // Convert form data to Order-like structure for getOrderTotal utility
      // For Renovation orders, base value comes from renovation_service_cost; for New Memorial, from value
      const orderLike: Pick<Order, 'value' | 'permit_cost' | 'additional_options_total' | 'order_type' | 'renovation_service_cost'> = {
        order_type: order.data.order_type!,
        value: order.data.order_type === 'Renovation' ? null : (order.data.value ?? null),
        renovation_service_cost: order.data.order_type === 'Renovation' ? (order.data.renovation_service_cost ?? null) : null,
        permit_cost: order.data.permit_cost ?? null,
        additional_options_total: inlineOptionsTotal, // Use computed total from inline options
      };
      return sum + getOrderTotal(orderLike as Order);
    }, 0);
  }, [orders]);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customer_name: '',
      amount: 0,
      status: 'pending',
      due_date: '',
      issue_date: new Date().toISOString().split('T')[0],
      payment_method: 'Credit Card',
      payment_date: null,
      notes: null,
    },
  });

  // Update form with calculated amount
  useEffect(() => {
    form.setValue('amount', calculatedAmount);
  }, [calculatedAmount, form]);

  const onSubmit = async (data: InvoiceFormData) => {
    // Validate at least one Order exists
    if (orders.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one order is required.',
        variant: 'destructive',
      });
      return;
    }

    // Validate all Orders
    const orderValidationErrors: string[] = [];
    orders.forEach((order, index) => {
      try {
        orderFormSchema.parse(order.data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid';
        orderValidationErrors.push(`Order ${index + 1}: ${errorMessage}`);
      }
    });

    if (orderValidationErrors.length > 0) {
      toast({
        title: 'Validation Error',
        description: orderValidationErrors.join('\n'),
        variant: 'destructive',
      });
      return;
    }

    // Calculate final amount (includes base value + permit cost + additional options from all orders)
    const finalAmount = orders.reduce((sum, order) => {
      // Calculate inline options total from form data (not from additional_options_total which is 0 for unsaved orders)
      const inlineOptionsTotal = getInlineOptionsTotal(order.data);
      
      // Convert form data to Order-like structure for getOrderTotal utility
      // For Renovation orders, base value comes from renovation_service_cost; for New Memorial, from value
      const orderLike: Pick<Order, 'value' | 'permit_cost' | 'additional_options_total' | 'order_type' | 'renovation_service_cost'> = {
        order_type: order.data.order_type!,
        value: order.data.order_type === 'Renovation' ? null : (order.data.value ?? null),
        renovation_service_cost: order.data.order_type === 'Renovation' ? (order.data.renovation_service_cost ?? null) : null,
        permit_cost: order.data.permit_cost ?? null,
        additional_options_total: inlineOptionsTotal, // Use computed total from inline options
      };
      return sum + getOrderTotal(orderLike as Order);
    }, 0);

    // Create Invoice first
    const invoiceData = {
      ...data,
      amount: finalAmount,
      order_id: null, // No longer used, but keep for type compatibility
      payment_method: data.payment_method ?? null,
      payment_date: data.payment_date ?? null,
      notes: data.notes ?? null,
      issue_date: data.issue_date || new Date().toISOString().split('T')[0],
    };

    try {
      const createdInvoice = await createInvoiceAsync(invoiceData);
      
      // Create all Orders with invoice_id
      // If invoice has customer_name, try to match it to a customer to get person_id
      const invoicePerson = data.customer_name && data.customer_name.trim() 
        ? customers?.find(c => `${c.first_name} ${c.last_name}` === data.customer_name.trim())
        : null;

      const orderPromises = orders.map(async (order) => {
        const notesValue = buildNotes(dimensions[order.id] || '', order.data.notes || '');
        
        // For New Memorial orders: ensure value is a valid number (not null/NaN)
        // If no product selected or value is missing, default to 0
        const orderValue = order.data.order_type === 'Renovation' 
          ? null // Renovation orders use renovation_service_cost as base value
          : (order.data.value !== null && order.data.value !== undefined && !isNaN(order.data.value))
            ? order.data.value
            : 0; // Default to 0 for New Memorial if value is missing/invalid
        
        const orderData = {
          customer_name: order.data.customer_name?.trim() || '',
          location: order.data.location?.trim() || '',
          sku: order.data.sku?.trim() || '',
          order_type: order.data.order_type!,
          material: order.data.material || null,
          color: order.data.color || null,
          // For Renovation orders, value should be null (base value comes from renovation_service_cost)
          // For New Memorial orders, value must be a valid number (defaults to 0 if missing)
          value: orderValue,
          // DB constraint: permit_cost is NOT NULL DEFAULT 0, so we must send 0 (not null) when empty
          permit_cost: toMoneyNumber(order.data.permit_cost),
          // Product photo URL snapshot: Only for New Memorial orders, null for Renovation
          product_photo_url: order.data.order_type === 'Renovation' 
            ? null // Renovation orders don't have product photos
            : (order.data.productPhotoUrl ?? null), // Snapshot photo URL for New Memorial orders
          // Renovation service fields (only used for Renovation order types)
          // For New Memorial: explicitly set to null/0 to satisfy NOT NULL constraints
          renovation_service_description: order.data.order_type === 'Renovation' 
            ? (order.data.renovation_service_description?.trim() || null)
            : null, // Explicitly null for New Memorial orders
          renovation_service_cost: order.data.order_type === 'Renovation' 
            ? toMoneyNumber(order.data.renovation_service_cost) // Blank => 0 for Renovation
            : 0, // Must be 0 for New Memorial orders (NOT NULL constraint, cannot send null)
          notes: notesValue,
          latitude: order.data.latitude ?? null,
          longitude: order.data.longitude ?? null,
          // Person assignment: inherit from invoice if available
          person_id: invoicePerson?.id || null,
          person_name: invoicePerson ? `${invoicePerson.first_name} ${invoicePerson.last_name}` : null,
          customer_email: null,
          customer_phone: null,
          stone_status: 'NA' as const,
          permit_status: 'pending' as const,
          proof_status: 'Not_Received' as const,
          deposit_date: null,
          second_payment_date: null,
          due_date: null,
          installation_date: null,
          progress: 0,
          assigned_to: null,
          priority: 'medium' as const,
          timeline_weeks: 12,
          invoice_id: createdInvoice.id,
        };

        // Create the order first
        const createdOrder = await createOrderAsync(orderData);

        // After order is created, trigger geocoding in the background if location present
        const locationForGeocode = orderData.location?.trim();
        if (locationForGeocode && locationForGeocode.length >= 6) {
          geocodeMutation.mutate({
            orderId: createdOrder.id,
            location: locationForGeocode,
          });
        }
        
        // Create additional options if any
        const additionalOptions = order.data.additional_options || [];
        if (additionalOptions.length > 0) {
          let successCount = 0;
          let errorCount = 0;
          const totalOptions = additionalOptions.filter(opt => opt.name?.trim()).length;
          
          // Create each option
          for (const option of additionalOptions) {
            if (option.name?.trim()) {
              try {
                await createOptionAsync({
                  order_id: createdOrder.id,
                  name: option.name.trim(),
                  cost: toMoneyNumber(option.cost),
                  description: option.description?.trim() || null,
                });
                successCount++;
              } catch (error) {
                console.error('Failed to create additional option:', error);
                errorCount++;
              }
            }
          }
          
          // Show warning if some options failed
          if (errorCount > 0) {
            toast({
              title: 'Order created with warnings',
              description: `Order created. ${successCount} option(s) added, ${errorCount} failed.`,
              variant: 'destructive',
            });
          }
        }
        
        return createdOrder;
      });

      try {
        await Promise.all(orderPromises);
        toast({
          title: 'Invoice created',
          description: `Invoice and ${orders.length} order(s) created successfully.`,
        });
        form.reset();
        setOrders([]);
        setSelectedProductIds({});
        setDimensions({});
        onOpenChange(false);
      } catch (error) {
        // Log the actual error for debugging
        console.error('INLINE ORDER CREATE ERROR', error);
        
        // Extract error message from Supabase error (which often has a message property)
        let errorMessage = 'Failed to create some orders.';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'message' in error) {
          errorMessage = String(error.message);
        }
        
        toast({
          title: 'Partial Success',
          description: `Invoice created, but some orders failed to create. ${errorMessage}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Failed to create invoice.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Create New Invoice</DrawerTitle>
          <DrawerDescription>
            Fill in the details to create a new invoice with orders.
          </DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 p-4 pb-4 overflow-y-auto flex-1">
              {/* Person Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Person Information</h3>
                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Person</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === NO_PERSON_SENTINEL) {
                            field.onChange(''); // Map sentinel to empty string for form state
                          } else if (value) {
                            const customer = customers?.find(c => c.id === value);
                            if (customer) {
                              field.onChange(`${customer.first_name} ${customer.last_name}`);
                            }
                          }
                        }}
                        value={
                          field.value && field.value !== ''
                            ? customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? NO_PERSON_SENTINEL
                            : NO_PERSON_SENTINEL
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select person (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>
                          {!customers || customers.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">No people available</div>
                          ) : (
                            customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.first_name} {customer.last_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Orders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Orders</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newId = `temp-${Date.now()}`;
                      // Initialize new order with default order_type to prevent undefined issues
                      setOrders([...orders, { id: newId, data: { order_type: 'New Memorial' } }]);
                    }}
                  >
                    Add Order
                  </Button>
                </div>
                
                {orders.length === 0 && (
                  <div className="text-sm text-muted-foreground p-4 border rounded">
                    No orders added. Click "Add Order" to create an order for this invoice.
                  </div>
                )}
                
                {orders.map((order, index) => (
                  <OrderFormInline
                    key={order.id}
                    order={order}
                    index={index}
                    onUpdate={(data) => {
                      setOrders(orders.map(o => o.id === order.id ? { ...o, data } : o));
                    }}
                    onRemove={() => {
                      setOrders(orders.filter(o => o.id !== order.id));
                      const newSelectedProductIds = { ...selectedProductIds };
                      delete newSelectedProductIds[order.id];
                      setSelectedProductIds(newSelectedProductIds);
                      const newDimensions = { ...dimensions };
                      delete newDimensions[order.id];
                      setDimensions(newDimensions);
                    }}
                    selectedProductId={selectedProductIds[order.id] || ''}
                    onProductSelect={(productId) => {
                      setSelectedProductIds({ ...selectedProductIds, [order.id]: productId });
                    }}
                    dimensions={dimensions[order.id] || ''}
                    onDimensionsChange={(value) => {
                      setDimensions({ ...dimensions, [order.id]: value });
                    }}
                  />
                ))}
              </div>

              {/* Invoice Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormItem>
                    <FormLabel>Amount ($) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={calculatedAmount.toFixed(2)}
                        readOnly
                        className="bg-muted"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Calculated from orders
                    </p>
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? undefined}
                          defaultValue={field.value ?? undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Important Dates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="issue_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issue Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value || '')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value || '')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Payment Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Payment Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? undefined}
                          defaultValue={field.value ?? undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Check">Check</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payment_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                        placeholder="Additional notes about this invoice..."
                        className="resize-none"
                        rows={4}
                        {...field}
                        value={field.value || ''}
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

export default CreateInvoiceDrawer;
