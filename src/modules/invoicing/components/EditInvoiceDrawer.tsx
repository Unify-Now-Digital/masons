import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer, DrawerContent, useOnDrawerReset } from '@/shared/components/ui/drawer';
import { AppDrawerLayout } from '@/shared/components/drawer';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Calendar } from '@/shared/components/ui/calendar';
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
import { Calendar as CalendarIcon } from 'lucide-react';
import { useUpdateInvoice, useInvoice } from '../hooks/useInvoices';
import { invoiceFormSchema, type InvoiceFormData } from '../schemas/invoice.schema';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersByInvoice } from '@/modules/orders/hooks/useOrders';
import { getOrderTotal, getOrderTotalFormatted, getOrderBaseValue, getOrderPermitCost, getOrderAdditionalOptionsTotal } from '@/modules/orders/utils/orderCalculations';
import { getOrderDisplayIdShort } from '@/modules/orders/utils/orderDisplayId';
import type { Invoice } from '../types/invoicing.types';
import type { Order } from '@/modules/orders/types/orders.types';
import { formatDateDMY, formatGbpDecimal } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function dateToYmd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function depositPercentDisplay(deposit: number | null | undefined, total: number): string {
  if (deposit == null || total <= 0) return '';
  return ((deposit / total) * 100).toFixed(1);
}

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
  const { data: freshInvoice } = useInvoice(invoice.id);
  const inv = freshInvoice ?? invoice;
  const [depositPercentInput, setDepositPercentInput] = useState<string>('');

  // Calculate invoice amount from linked orders (includes base value + permit cost + additional options)
  const calculatedAmount = useMemo(() => {
    if (!linkedOrders || linkedOrders.length === 0) {
      return inv.amount; // Fall back to existing amount if no orders
    }
    return linkedOrders.reduce((sum, order) => {
      return sum + getOrderTotal(order);
    }, 0);
  }, [linkedOrders, inv.amount]);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      order_id: inv.order_id ?? undefined,
      customer_name: inv.customer_name,
      amount: inv.amount,
      status: inv.status,
      due_date: inv.due_date,
      issue_date: inv.issue_date,
      payment_method: inv.payment_method ?? 'Credit Card',
      payment_date: inv.payment_date ?? null,
      notes: inv.notes ?? null,
      intended_deposit: inv.intended_deposit_pence != null ? inv.intended_deposit_pence / 100 : null,
    },
  });

  // Reset form when invoice changes and update amount from orders
  useEffect(() => {
    if (inv) {
      form.reset({
        order_id: inv.order_id ?? undefined,
        customer_name: inv.customer_name,
        amount: calculatedAmount,
        status: inv.status,
        due_date: inv.due_date,
        issue_date: inv.issue_date,
        payment_method: inv.payment_method ?? 'Credit Card',
        payment_date: inv.payment_date ?? null,
        notes: inv.notes ?? null,
        intended_deposit: inv.intended_deposit_pence != null ? inv.intended_deposit_pence / 100 : null,
      });
    }
  }, [inv, form, calculatedAmount]);

  // Update amount when calculatedAmount changes
  useEffect(() => {
    if (linkedOrders && linkedOrders.length > 0) {
      form.setValue('amount', calculatedAmount);
    }
  }, [calculatedAmount, linkedOrders, form]);

  // Refresh % display when order total changes (reads £ form value only)
  useEffect(() => {
    const deposit = form.getValues('intended_deposit');
    setDepositPercentInput(depositPercentDisplay(deposit, calculatedAmount));
  }, [calculatedAmount, form]);

  // Clear any draft state when the drawer has been closed
  useOnDrawerReset(() => {
    form.reset();
  });

  const onSubmit = (data: InvoiceFormData) => {
    const { intended_deposit, ...rest } = data;
    const invoiceData = {
      ...rest,
      order_id: data.order_id ?? null,
      payment_method: data.payment_method ?? null,
      payment_date: data.payment_date ?? null,
      notes: data.notes ?? null,
      intended_deposit_pence: intended_deposit != null ? Math.round(intended_deposit * 100) : null,
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
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Edit Invoice"
              description={`Update the details for invoice ${invoice.invoice_number}.`}
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Updating...' : 'Save Changes'}
              primaryDisabled={isPending}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
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
                              <span className="ml-2 font-mono text-xs">{getOrderDisplayIdShort(order)}</span>
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
                                {formatGbpDecimal(getOrderBaseValue(order))}
                              </span>
                            </div>
                            {getOrderPermitCost(order) > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Permit Cost:</span>
                                <span className="font-medium">
                                  {formatGbpDecimal(getOrderPermitCost(order))}
                                </span>
                              </div>
                            )}
                            {getOrderAdditionalOptionsTotal(order) > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Additional Options:</span>
                                <span className="font-medium">
                                  {formatGbpDecimal(getOrderAdditionalOptionsTotal(order))}
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
                <FormField
                  control={form.control}
                  name="intended_deposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit amount (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="Optional"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed = raw === '' ? null : Number.parseFloat(raw);
                            field.onChange(parsed);
                            setDepositPercentInput(depositPercentDisplay(parsed, calculatedAmount));
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Optional. Pre-fills the partial-payment amount when collecting payment later.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Deposit (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      placeholder="Optional"
                      disabled={calculatedAmount === 0}
                      value={depositPercentInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setDepositPercentInput(raw);
                        const normalised = raw.replace(',', '.').trim();
                        if (normalised === '') {
                          form.setValue('intended_deposit', null);
                          return;
                        }
                        const parsed = Number.parseFloat(normalised);
                        if (!Number.isFinite(parsed) || calculatedAmount <= 0) {
                          return;
                        }
                        let pct = parsed;
                        if (pct < 0) pct = 0;
                        if (pct > 100) pct = 100;
                        form.setValue('intended_deposit', round2(calculatedAmount * (pct / 100)));
                      }}
                    />
                  </FormControl>
                </FormItem>
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'h-9 w-full pl-3 pr-2 text-left font-normal text-xs',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              <span>{formatDateDMY(field.value)}</span>
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? ymdToDate(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? dateToYmd(date) : '')}
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
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'h-9 w-full pl-3 pr-2 text-left font-normal text-xs',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              <span>{formatDateDMY(field.value)}</span>
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? ymdToDate(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? dateToYmd(date) : '')}
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'h-9 w-full pl-3 pr-2 text-left font-normal text-xs',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              <span>{formatDateDMY(field.value)}</span>
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? ymdToDate(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? dateToYmd(date) : null)}
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
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

export default EditInvoiceDrawer;

