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
import { useUpdatePayment, type Payment } from '../hooks/usePayments';
import { paymentFormSchema, type PaymentFormData } from '../schemas/payment.schema';
import { toPaymentUpdate } from '../utils/paymentTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useInvoicesList } from '@/modules/invoicing/hooks/useInvoices';

interface EditPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
}

export const EditPaymentDrawer: React.FC<EditPaymentDrawerProps> = ({
  open,
  onOpenChange,
  payment,
}) => {
  const { mutate: updatePayment, isPending } = useUpdatePayment();
  const { toast } = useToast();
  const { data: invoicesData } = useInvoicesList();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      invoiceId: payment.invoice_id,
      amount: payment.amount,
      date: payment.date,
      method: payment.method,
      reference: payment.reference || '',
      notes: payment.notes || '',
    },
  });

  // Reset form when payment changes
  useEffect(() => {
    if (payment && open) {
      form.reset({
        invoiceId: payment.invoice_id,
        amount: payment.amount,
        date: payment.date,
        method: payment.method,
        reference: payment.reference || '',
        notes: payment.notes || '',
      });
    }
  }, [payment, open, form]);

  const onSubmit = (values: PaymentFormData) => {
    const payload = toPaymentUpdate(values);
    
    updatePayment(
      { id: payment.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Payment updated',
            description: 'Payment has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          let errorMessage = 'Failed to update payment.';
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = String(error.message);
          }
          toast({
            title: 'Error updating payment',
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
          <DrawerTitle>Edit Payment</DrawerTitle>
          <DrawerDescription>Update payment information.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
            {/* Invoice Selection - REQUIRED */}
            <FormField
              control={form.control}
              name="invoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an invoice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(invoicesData) && invoicesData.length > 0
                        ? invoicesData.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {invoice.invoice_number} - {invoice.customer_name || 'Unknown Customer'}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount - REQUIRED */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date - REQUIRED */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date *</FormLabel>
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
                        onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : payment.date)}
                        disabled={(date) => date < new Date('1900-01-01')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Method - REQUIRED */}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference - OPTIONAL */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., check number, transaction ID" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes - OPTIONAL */}
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
                {isPending ? 'Updating...' : 'Update Payment'}
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

