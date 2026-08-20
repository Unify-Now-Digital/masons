import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer, DrawerContent } from '@/shared/components/ui/drawer';
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
import { useCreatePayment } from '../hooks/usePayments';
import { paymentFormSchema, type PaymentFormData } from '../schemas/payment.schema';
import { toPaymentInsert } from '../utils/paymentTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useInvoicesList } from '@/modules/invoicing/hooks/useInvoices';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';

interface CreatePaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePaymentDrawer: React.FC<CreatePaymentDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createPayment, isPending } = useCreatePayment();
  const { toast } = useToast();
  const { data: invoicesData } = useInvoicesList();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      invoiceId: '',
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      method: 'cash',
      reference: '',
      notes: '',
    },
  });

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.reset({
        invoiceId: '',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        method: 'cash',
        reference: '',
        notes: '',
      });
    }
  }, [open, form]);

  // Auto-fill amount when invoice is selected (optional enhancement)
  const selectedInvoiceId = form.watch('invoiceId');
  const selectedInvoice = invoicesData?.find((i) => i.id === selectedInvoiceId);

  useEffect(() => {
    if (selectedInvoice && open) {
      // Optionally auto-fill amount from invoice
      if (selectedInvoice.amount && selectedInvoice.amount > 0) {
        form.setValue('amount', selectedInvoice.amount);
      }
    }
  }, [selectedInvoice, open, form]);

  const onSubmit = (values: PaymentFormData) => {
    const payload = toPaymentInsert(values);
    
    createPayment(payload, {
      onSuccess: () => {
        toast({
          title: 'Payment created',
          description: 'Payment has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to create payment.';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String(error.message);
        }
        console.error('Error creating payment:', error);
        toast({
          title: 'Error creating payment',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0 [--background:40_50%_98%]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Create Payment"
              description="Add a new payment record."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Creating...' : 'Create Payment'}
              primaryDisabled={isPending}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
              <DrawerSection>
                <DrawerGrid cols={2}>
                  <FormField
                    control={form.control}
                    name="invoiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Invoice *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
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
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Amount *</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Date *</FormLabel>
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
                              onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))}
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
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Payment Method *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
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
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Reference</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="e.g., check number, transaction ID" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
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
                </DrawerGrid>
              </DrawerSection>
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

