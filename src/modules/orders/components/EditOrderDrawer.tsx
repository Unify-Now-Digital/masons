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
import { useUpdateOrder } from '../hooks/useOrders';
import { orderFormSchema, type OrderFormData } from '../schemas/order.schema';
import { useToast } from '@/shared/hooks/use-toast';
import type { Order } from '../types/orders.types';

interface EditOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}

export const EditOrderDrawer: React.FC<EditOrderDrawerProps> = ({
  open,
  onOpenChange,
  order,
}) => {
  const { mutate: updateOrder, isPending } = useUpdateOrder();
  const { toast } = useToast();

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customer_name: order.customer_name,
      customer_email: order.customer_email || '',
      customer_phone: order.customer_phone || '',
      order_type: order.order_type,
      sku: order.sku || '',
      material: order.material || '',
      color: order.color || '',
      stone_status: order.stone_status,
      permit_status: order.permit_status,
      proof_status: order.proof_status,
      deposit_date: order.deposit_date || null,
      second_payment_date: order.second_payment_date || null,
      due_date: order.due_date || null,
      installation_date: order.installation_date || null,
      location: order.location || '',
      value: order.value,
      progress: order.progress,
      assigned_to: order.assigned_to || '',
      priority: order.priority,
      timeline_weeks: order.timeline_weeks,
      notes: order.notes || '',
    },
  });

  // Reset form when order changes
  useEffect(() => {
    if (order) {
      form.reset({
        customer_name: order.customer_name,
        customer_email: order.customer_email || '',
        customer_phone: order.customer_phone || '',
        order_type: order.order_type,
        sku: order.sku || '',
        material: order.material || '',
        color: order.color || '',
        stone_status: order.stone_status,
        permit_status: order.permit_status,
        proof_status: order.proof_status,
        deposit_date: order.deposit_date || null,
        second_payment_date: order.second_payment_date || null,
        due_date: order.due_date || null,
        installation_date: order.installation_date || null,
        location: order.location || '',
        value: order.value,
        progress: order.progress,
        assigned_to: order.assigned_to || '',
        priority: order.priority,
        timeline_weeks: order.timeline_weeks,
        notes: order.notes || '',
      });
    }
  }, [order, form]);

  const onSubmit = (data: OrderFormData) => {
    // Convert empty strings to null for optional fields
    const orderData = {
      ...data,
      customer_email: data.customer_email || null,
      customer_phone: data.customer_phone || null,
      sku: data.sku || null,
      material: data.material || null,
      color: data.color || null,
      location: data.location || null,
      assigned_to: data.assigned_to || null,
      notes: data.notes || null,
      deposit_date: data.deposit_date || null,
      second_payment_date: data.second_payment_date || null,
      due_date: data.due_date || null,
      installation_date: data.installation_date || null,
    };

    updateOrder(
      { id: order.id, updates: orderData },
      {
        onSuccess: () => {
          toast({
            title: 'Order updated',
            description: 'Order has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description = error instanceof Error ? error.message : 'Failed to update order.';
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
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Edit Order</DrawerTitle>
          <DrawerDescription>
            Update the details for this memorial order.
          </DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customer_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customer_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+44 123 456 7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Order Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Order Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="order_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Type *</FormLabel>
                      <FormControl>
                        <Input placeholder="Granite Headstone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="GH-001-BLK" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="material"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material</FormLabel>
                      <FormControl>
                        <Input placeholder="Black Granite" {...field} />
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
                        <Input placeholder="Jet Black" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Status Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="stone_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stone Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NA">NA</SelectItem>
                          <SelectItem value="Ordered">Ordered</SelectItem>
                          <SelectItem value="In Stock">In Stock</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="permit_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permit Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="form_sent">Form Sent</SelectItem>
                          <SelectItem value="customer_completed">Customer Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="proof_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proof Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NA">NA</SelectItem>
                          <SelectItem value="Not_Received">Not Received</SelectItem>
                          <SelectItem value="Received">Received</SelectItem>
                          <SelectItem value="In_Progress">In Progress</SelectItem>
                          <SelectItem value="Lettered">Lettered</SelectItem>
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
                  name="deposit_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Date</FormLabel>
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
                <FormField
                  control={form.control}
                  name="second_payment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Second Payment Date</FormLabel>
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
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
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
                <FormField
                  control={form.control}
                  name="installation_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Installation Date</FormLabel>
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

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Oak Hill Cemetery" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="2500.00"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="progress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progress (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <FormControl>
                        <Input placeholder="Mike Johnson" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
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
                <FormField
                  control={form.control}
                  name="timeline_weeks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeline (Weeks)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="12"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 12)}
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
                        placeholder="Additional notes about this order..."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DrawerFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Updating...' : 'Update Order'}
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

export default EditOrderDrawer;

