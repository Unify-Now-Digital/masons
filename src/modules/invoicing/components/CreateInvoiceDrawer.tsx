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
import { useCreateOrder } from '@/modules/orders/hooks/useOrders';
import { orderFormSchema, type OrderFormData } from '@/modules/orders/schemas/order.schema';
import { OrderFormInline } from './OrderFormInline';

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

export const CreateInvoiceDrawer: React.FC<CreateInvoiceDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutateAsync: createInvoiceAsync, isPending } = useCreateInvoice();
  const { mutateAsync: createOrderAsync } = useCreateOrder();
  const { toast } = useToast();
  const { data: customers } = useCustomersList();
  
  const [orders, setOrders] = useState<Array<{ id: string; data: Partial<OrderFormData> }>>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
  const [dimensions, setDimensions] = useState<Record<string, string>>({});

  // Calculate amount from Orders
  const calculatedAmount = useMemo(() => {
    return orders.reduce((sum, order) => {
      const orderValue = order.data.value ?? 0;
      return sum + orderValue;
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

    // Calculate final amount
    const finalAmount = orders.reduce((sum, order) => sum + (order.data.value ?? 0), 0);

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
      const orderPromises = orders.map(async (order) => {
        const notesValue = buildNotes(dimensions[order.id] || '', order.data.notes || '');
        
        const orderData = {
          customer_name: order.data.customer_name?.trim() || '',
          location: order.data.location?.trim() || '',
          sku: order.data.sku?.trim() || '',
          order_type: order.data.order_type!,
          material: order.data.material || null,
          color: order.data.color || null,
          value: order.data.value ?? null,
          notes: notesValue,
          latitude: order.data.latitude ?? null,
          longitude: order.data.longitude ?? null,
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

        return createOrderAsync(orderData);
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
        const description = error instanceof Error ? error.message : 'Failed to create some orders.';
        toast({
          title: 'Partial Success',
          description: 'Invoice created, but some orders failed to create.',
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
                      <FormLabel>Person *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const customer = customers?.find(c => c.id === value);
                          if (customer) {
                            field.onChange(`${customer.first_name} ${customer.last_name}`);
                          }
                        }}
                        value={customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select person" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                      setOrders([...orders, { id: newId, data: {} }]);
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
