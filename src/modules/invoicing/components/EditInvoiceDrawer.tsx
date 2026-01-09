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
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useUpdateInvoice } from '../hooks/useInvoices';
import { invoiceFormSchema, type InvoiceFormData } from '../schemas/invoice.schema';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import { getOrderTotal, getOrderTotalFormatted, getOrderBaseValue, getOrderPermitCost, getOrderAdditionalOptionsTotal } from '@/modules/orders/utils/orderCalculations';
import type { Invoice } from '../types/invoicing.types';
import type { Order } from '@/modules/orders/types/orders.types';

interface EditInvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
}

export const EditInvoiceDrawer: React.FC<EditInvoiceDrawerProps> = ({
  open,
  onOpenChange,
  invoice,
}) => {
  const { mutate: updateInvoice, isPending } = useUpdateInvoice();
  const { toast } = useToast();
  const { data: linkedOrders, isLoading: isOrdersLoading } = useOrdersByInvoice(invoice.id);

  // Calculate invoice amount from linked orders (includes base value + permit cost + additional options)
  const calculatedAmount = useMemo(() => {
    if (!linkedOrders || linkedOrders.length === 0) {
      return invoice.amount; // Fall back to existing amount if no orders
    }
    return linkedOrders.reduce((sum, order) => {
      return sum + getOrderTotal(order);
    }, 0);
  }, [linkedOrders, invoice.amount]);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      order_id: invoice.order_id ?? undefined,
      customer_name: invoice.customer_name,
      amount: invoice.amount,
      status: invoice.status,
      due_date: invoice.due_date,
      issue_date: invoice.issue_date,
      payment_method: invoice.payment_method ?? 'Credit Card',
      payment_date: invoice.payment_date ?? null,
      notes: invoice.notes ?? null,
    },
  });

  // Reset form when invoice changes and update amount from orders
  useEffect(() => {
    if (invoice) {
      form.reset({
        order_id: invoice.order_id ?? undefined,
        customer_name: invoice.customer_name,
        amount: calculatedAmount,
        status: invoice.status,
        due_date: invoice.due_date,
        issue_date: invoice.issue_date,
        payment_method: invoice.payment_method ?? 'Credit Card',
        payment_date: invoice.payment_date ?? null,
        notes: invoice.notes ?? null,
      });
    }
  }, [invoice, form, calculatedAmount]);

  // Update amount when calculatedAmount changes
  useEffect(() => {
    if (linkedOrders && linkedOrders.length > 0) {
      form.setValue('amount', calculatedAmount);
    }
  }, [calculatedAmount, linkedOrders, form]);

  const onSubmit = (data: InvoiceFormData) => {
    // Convert undefined to null for optional fields
    const invoiceData = {
      ...data,
      order_id: data.order_id ?? null,
      payment_method: data.payment_method ?? null,
      payment_date: data.payment_date ?? null,
      notes: data.notes ?? null,
    };

    updateInvoice(
      { id: invoice.id, updates: invoiceData },
      {
        onSuccess: () => {
          toast({
            title: 'Invoice updated',
            description: 'Invoice has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description = error instanceof Error ? error.message : 'Failed to update invoice.';
          toast({
            title: 'Error',
            description,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Edit Invoice</DrawerTitle>
          <DrawerDescription>
            Update the details for invoice {invoice.invoice_number}.
          </DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 p-4 pb-4 overflow-y-auto flex-1">
              {/* Invoice Number (Read-only) */}
              <FormItem>
                <FormLabel>Invoice Number</FormLabel>
                <Input value={invoice.invoice_number} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">Invoice number cannot be changed</p>
              </FormItem>

              {/* Linked Orders */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Linked Orders</h3>
                {isOrdersLoading ? (
                  <p className="text-sm text-muted-foreground">Loading orders...</p>
                ) : !linkedOrders || linkedOrders.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 border rounded">
                    No orders linked to this invoice.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {linkedOrders.map((order) => (
                      <Card key={order.id} className="border">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">
                            {order.customer_name} - {order.order_type}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-0">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Order ID:</span>
                              <span className="ml-2 font-mono text-xs">{order.id.substring(0, 8)}...</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">SKU:</span>
                              <span className="ml-2">{order.sku || 'N/A'}</span>
                            </div>
                            {order.material && (
                              <div>
                                <span className="text-muted-foreground">Material:</span>
                                <span className="ml-2">{order.material}</span>
                              </div>
                            )}
                            {order.color && (
                              <div>
                                <span className="text-muted-foreground">Color:</span>
                                <span className="ml-2">{order.color}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="pt-2 border-t space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Base Value:</span>
                              <span className="font-medium">
                                £{getOrderBaseValue(order).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            {getOrderPermitCost(order) > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Permit Cost:</span>
                                <span className="font-medium">
                                  £{getOrderPermitCost(order).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            {getOrderAdditionalOptionsTotal(order) > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Additional Options:</span>
                                <span className="font-medium">
                                  £{getOrderAdditionalOptionsTotal(order).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                              <span>Order Total:</span>
                              <span>{getOrderTotalFormatted(order)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

            {/* Person Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Person Information</h3>
              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Invoice Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Invoice Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (GBP) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="2500.00"
                          value={calculatedAmount.toFixed(2)}
                          readOnly
                          className="bg-muted"
                          {...field}
                          onChange={(e) => {
                            // Keep form value in sync but don't allow manual editing
                            field.onChange(calculatedAmount);
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Calculated from linked orders (base value + permit cost + additional options)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                {isPending ? 'Updating...' : 'Save Changes'}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

export default EditInvoiceDrawer;

