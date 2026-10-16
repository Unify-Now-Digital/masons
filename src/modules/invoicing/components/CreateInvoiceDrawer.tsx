import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command';
import { depositPoundsFromTotal } from '@/shared/lib/deposit';
import { Calendar as CalendarIcon, ChevronsUpDown } from 'lucide-react';
import { useCreateInvoice, invoicesKeys } from '../hooks/useInvoices';
import { invoiceFormSchema, type InvoiceFormData } from '../schemas/invoice.schema';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useCustomersList, type Customer } from '@/modules/customers/hooks/useCustomers';
import { useCreateOrder, useCreateAdditionalOption, ordersKeys } from '@/modules/orders/hooks/useOrders';
import { deleteAdditionalOption, fetchAdditionalOptionsByOrder, linkOrdersToInvoice, updateOrder } from '@/modules/orders/api/orders.api';
import { orderFormSchema, type OrderFormData } from '@/modules/orders/schemas/order.schema';
import { OrderFormInline } from './OrderFormInline';
import type { Order, OrderAdditionalOption } from '@/modules/orders/types/orders.types';
import { balanceInvoiceAmount, extendedMoney, formOrderGross, orderToInvoiceForm, personSelectOptions } from '../utils/invoiceBuilder';
import { toMoneyNumber } from '@/modules/orders/utils/numberParsing';
import { useGeocodeOrderAddress } from '@/modules/orders/hooks/useGeocodeOrderAddress';
import { getDefaultDueDate } from '../utils/dateDefaults';
import { cn } from '@/shared/lib/utils';
import { formatDateDMY } from '@/shared/lib/formatters';
import { QuickCreatePersonDialog } from './QuickCreatePersonDialog';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { canBuildInvoices } from '../invoiceBuilderAccess';
interface CreateInvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pre-existing orders this invoice covers (conversation-sidebar flow). Shown in the
   * order editor, included in the amount, and linked via `invoice_id` — never re-created.
   */
  preloadedOrders?: Order[];
  /**
   * Payments already received, in pounds. Subtracted from the order total so a
   * balance invoice opens on the outstanding amount. Null while that figure is
   * still loading — the full total is not shown in its place.
   */
  alreadyPaid?: number | null;
  /** Linked pipeline job; written to `invoices.job_id` and onto inline-created orders. */
  jobId?: string | null;
  /** Pre-selects the person in the form (selection stays editable). */
  initialPersonId?: string | null;
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
  // Construct as local date to avoid timezone shifting.
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

export const CreateInvoiceDrawer: React.FC<CreateInvoiceDrawerProps> = ({
  open,
  onOpenChange,
  preloadedOrders,
  alreadyPaid,
  jobId,
  initialPersonId,
}) => {
  const queryClient = useQueryClient();
  const { mutateAsync: createInvoiceAsync, isPending } = useCreateInvoice();
  const { mutateAsync: createOrderAsync } = useCreateOrder();
  const { mutateAsync: createOptionAsync } = useCreateAdditionalOption();
  const geocodeMutation = useGeocodeOrderAddress();
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const { data: customers } = useCustomersList();
  
  const [orders, setOrders] = useState<Array<{ id: string; existing?: boolean; data: Partial<OrderFormData> }>>([]);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [quickPersonOpen, setQuickPersonOpen] = useState(false);
  // Person created via QuickCreatePersonDialog; merged into the Select options so the
  // selection renders before the customers list refetch lands.
  const [justCreated, setJustCreated] = useState<Customer | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
  const [dimensions, setDimensions] = useState<Record<string, string>>({});
  const [depositPercentInput, setDepositPercentInput] = useState<string>('');

  const peopleOptions = useMemo(() => {
    const list = customers ?? [];
    if (justCreated && !list.some(c => c.id === justCreated.id)) {
      return [justCreated, ...list];
    }
    return list;
  }, [customers, justCreated]);

  const personOptions = useMemo(
    () => personSelectOptions(peopleOptions),
    [peopleOptions],
  );

  const preloaded = useMemo(() => preloadedOrders ?? [], [preloadedOrders]);
  const preloadKey = preloaded.map((order) => order.id).join(',');
  const optionQueries = useQueries({
    queries: preloaded.map((order) => ({
      queryKey: ordersKeys.additionalOptions(order.id),
      queryFn: () => fetchAdditionalOptionsByOrder(order.id),
      enabled: open,
      staleTime: 30_000,
    })),
  });
  const optionsStamp = optionQueries.map((query) => (query.isSuccess ? 'ok' : query.isError ? 'err' : 'wait')).join(',');
  const optionRows = optionQueries.map((query) => (query.data ?? []) as OrderAdditionalOption[]);
  const optionRowsRef = useRef(optionRows);
  optionRowsRef.current = optionRows;

  useEffect(() => {
    if (!open || preloaded.length === 0 || seededKey === preloadKey) return;
    if (optionsStamp.split(',').some((state) => state === 'wait')) return;
    const seeded = preloaded.map((order, index) => ({
      id: order.id,
      existing: true,
      data: orderToInvoiceForm(order, optionRowsRef.current[index] ?? []),
    }));
    setOrders((prev) => [...seeded, ...prev.filter((order) => order.id.startsWith('temp-'))]);
    setSeededKey(preloadKey);
  }, [open, preloaded, preloadKey, optionsStamp, seededKey]);

  const grossAmount = useMemo(
    () => orders.reduce((sum, order) => sum + formOrderGross(order.data), 0),
    [orders],
  );
  const figuresReady = alreadyPaid !== null && (preloaded.length === 0 || seededKey === preloadKey);
  const invoiceAmount = figuresReady ? balanceInvoiceAmount(grossAmount, alreadyPaid ?? 0) : null;
  const calculatedAmount = invoiceAmount ?? 0;
  const balanceInvoice = alreadyPaid === null || (alreadyPaid ?? 0) > 0;
  // Permit fees across the orders on the form (pounds) for the SM deposit rule.
  const permitTotal = useMemo(
    () => orders.reduce((sum, order) => sum + (Number(order.data.permit_cost) || 0), 0),
    [orders],
  );

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      person_id: null,
      customer_name: '',
      amount: 0,
      status: 'pending',
      due_date: getDefaultDueDate(),
      issue_date: new Date().toISOString().split('T')[0],
      notes: null,
      intended_deposit: null,
    },
  });

  // Clear any draft state when the drawer has been closed; reset dates to "today" and "today + 3 days"
  useOnDrawerReset(() => {
    form.reset({
      person_id: null,
      customer_name: '',
      amount: 0,
      status: 'pending',
      due_date: getDefaultDueDate(),
      issue_date: new Date().toISOString().split('T')[0],
      notes: null,
      intended_deposit: null,
    });
    setOrders([]);
    setSeededKey(null);
    setSelectedProductIds({});
    setDimensions({});
    setDepositPercentInput('');
    setJustCreated(null);
  });

  // When drawer opens in create mode, ensure due_date and issue_date are prefilled so they are visible
  useEffect(() => {
    if (!open) return;
    const due = form.getValues('due_date');
    if (!due?.trim()) {
      form.setValue('due_date', getDefaultDueDate(), { shouldDirty: false, shouldValidate: false });
    }
    const issue = form.getValues('issue_date');
    if (!issue?.trim()) {
      form.setValue('issue_date', new Date().toISOString().split('T')[0], { shouldDirty: false, shouldValidate: false });
    }
  }, [open, form]);

  // Pre-select the person for the sidebar flow (selection stays editable in the form)
  useEffect(() => {
    if (!open || !initialPersonId) return;
    if (form.getValues('person_id')) return;
    form.setValue('person_id', initialPersonId, { shouldDirty: false, shouldValidate: false });
    const customer = personOptions.find((c) => c.id === initialPersonId);
    if (customer) {
      form.setValue('customer_name', customer.label, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [open, initialPersonId, personOptions, form]);

  // Update form with calculated amount. A balance invoice waits until payments are known.
  useEffect(() => {
    if (invoiceAmount == null) return;
    form.setValue('amount', invoiceAmount);
  }, [invoiceAmount, form]);

  // Refresh % display when order total changes (reads £ form value only)
  useEffect(() => {
    const deposit = form.getValues('intended_deposit');
    setDepositPercentInput(depositPercentDisplay(deposit, calculatedAmount));
  }, [calculatedAmount, form]);

  const onSubmit = async (data: InvoiceFormData) => {
    if (invoiceAmount == null) {
      toast({
        title: 'Still working out the balance',
        description: 'The outstanding amount is not ready yet.',
        variant: 'destructive',
      });
      return;
    }
    // Validate at least one Order exists (inline or preloaded)
    if (orders.length === 0 && preloaded.length === 0) {
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

    const finalAmount = invoiceAmount;

    // Create Invoice first
    const { intended_deposit, ...invoiceFormFields } = data;
    const invoiceData = {
      ...invoiceFormFields,
      amount: finalAmount,
      organization_id: organizationId,
      order_id: null, // No longer used, but keep for type compatibility
      job_id: jobId ?? null,
      payment_method: null,
      payment_date: null,
      notes: data.notes ?? null,
      issue_date: data.issue_date || new Date().toISOString().split('T')[0],
      intended_deposit_pence:
        intended_deposit != null ? Math.round(intended_deposit * 100) : null,
    };

    try {
      // Fast path: only await invoice creation
      const createdInvoice = await createInvoiceAsync(invoiceData);

      // Close drawer immediately and show success
      toast({
        title: 'Invoice created',
        description: orders.length > 0
          ? `Adding ${orders.length} order(s) in the background.`
          : preloaded.length > 0
            ? `Linking ${preloaded.length} order(s) in the background.`
            : 'Invoice created successfully.',
      });
      form.reset({
        person_id: null,
        customer_name: '',
        amount: 0,
        status: 'pending',
        due_date: getDefaultDueDate(),
        issue_date: new Date().toISOString().split('T')[0],
        notes: null,
        intended_deposit: null,
      });
      setOrders([]);
      setSeededKey(null);
      setSelectedProductIds({});
      setDimensions({});
      setDepositPercentInput('');
      setJustCreated(null);
      onOpenChange(false);

      // Background path: orders, Stripe, invalidations (non-blocking)
      const ordersSnapshot = [...orders];
      const dimensionsSnapshot = { ...dimensions };
      const productIdsSnapshot = { ...selectedProductIds };
      const customersSnapshot = peopleOptions;
      const invoiceId = createdInvoice.id;

      (async () => {
        const invoicePerson = data.person_id && customersSnapshot
          ? customersSnapshot.find(c => c.id === data.person_id)
          : null;
        const personLabel = invoicePerson
          ? personSelectOptions([invoicePerson])[0]?.label ?? `${invoicePerson.first_name} ${invoicePerson.last_name}`.trim()
          : null;
        const freshOrders = ordersSnapshot.filter((order) => !order.existing);
        const existingOrders = ordersSnapshot.filter((order) => order.existing);

        const orderPromises = freshOrders.map(async (order) => {
          const notesValue = buildNotes(dimensionsSnapshot[order.id] || '', order.data.notes || '');
          const orderValue = order.data.order_type === 'Renovation'
            ? null
            : extendedMoney(order.data.value, order.data.product_quantity);
          const orderData = {
            customer_name: order.data.customer_name?.trim() || '',
            location: order.data.location?.trim() || null,
            sku: order.data.sku?.trim() || null,
            custom_product_name: order.data.order_type === 'Renovation' ? null : (order.data.custom_product_name?.trim() || null),
            order_type: order.data.order_type!,
            material: order.data.material || null,
            color: order.data.color || null,
            inscription_text: order.data.inscription_text?.trim() || null,
            value: orderValue,
            permit_cost: toMoneyNumber(order.data.permit_cost),
            permit_form_id: order.data.permit_form_id ?? null,
            product_photo_url: order.data.order_type === 'Renovation'
              ? null
              : (order.data.productPhotoUrl ?? null),
            renovation_service_description: order.data.order_type === 'Renovation'
              ? (order.data.renovation_service_description?.trim() || null)
              : null,
            renovation_service_cost: order.data.order_type === 'Renovation'
              ? extendedMoney(order.data.renovation_service_cost, order.data.product_quantity)
              : 0,
            notes: notesValue,
            person_id: invoicePerson?.id || null,
            person_name: personLabel,
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
            invoice_id: invoiceId,
            job_id: jobId ?? null,
            ...(productIdsSnapshot[order.id] ? { product_id: productIdsSnapshot[order.id] } : {}),
          };
          const createdOrder = await createOrderAsync(orderData);
          const locationForGeocode = orderData.location?.trim();
          if (locationForGeocode && locationForGeocode.length >= 6) {
            geocodeMutation.mutate({ orderId: createdOrder.id, location: locationForGeocode });
          }
          const additionalOptions = order.data.additional_options || [];
          for (const option of additionalOptions) {
            if (option.name?.trim()) {
              try {
                await createOptionAsync({
                  order_id: createdOrder.id,
                  name: option.name.trim(),
                  cost: extendedMoney(option.cost, option.quantity),
                  description: option.description?.trim() || null,
                });
              } catch (err) {
                console.error('Failed to create additional option:', err);
                toast({
                  title: 'Order created with warnings',
                  description: `Some additional options could not be added.`,
                  variant: 'destructive',
                });
              }
            }
          }
          return createdOrder;
        });

        const existingPromises = existingOrders.map(async (order) => {
          const notesValue = buildNotes(dimensionsSnapshot[order.id] || '', order.data.notes || '');
          await updateOrder(order.id, {
            customer_name: order.data.customer_name?.trim() || '',
            location: order.data.location?.trim() || null,
            sku: order.data.sku?.trim() || null,
            custom_product_name: order.data.order_type === 'Renovation' ? null : (order.data.custom_product_name?.trim() || null),
            order_type: order.data.order_type!,
            material: order.data.material || null,
            color: order.data.color || null,
            inscription_text: order.data.inscription_text?.trim() || null,
            value: order.data.order_type === 'Renovation' ? null : extendedMoney(order.data.value, order.data.product_quantity),
            permit_cost: toMoneyNumber(order.data.permit_cost),
            product_photo_url: order.data.order_type === 'Renovation' ? null : (order.data.productPhotoUrl ?? null),
            renovation_service_description: order.data.order_type === 'Renovation'
              ? (order.data.renovation_service_description?.trim() || null)
              : null,
            renovation_service_cost: order.data.order_type === 'Renovation'
              ? extendedMoney(order.data.renovation_service_cost, order.data.product_quantity)
              : 0,
            notes: notesValue,
            invoice_id: invoiceId,
            ...(productIdsSnapshot[order.id] ? { product_id: productIdsSnapshot[order.id] } : {}),
          });
          const currentOptions = await fetchAdditionalOptionsByOrder(order.id);
          for (const option of currentOptions) {
            await deleteAdditionalOption(option.id);
          }
          for (const option of order.data.additional_options ?? []) {
            if (!option.name?.trim()) continue;
            await createOptionAsync({
              order_id: order.id,
              name: option.name.trim(),
              cost: extendedMoney(option.cost, option.quantity),
              description: option.description?.trim() || null,
            });
          }
        });

        try {
          // Existing orders are updated and linked. New rows are created. Nothing is duplicated.
          const linkPromise =
            existingOrders.length > 0 && organizationId
              ? linkOrdersToInvoice(
                  existingOrders.map((order) => order.id),
                  invoiceId,
                  organizationId
                ).then(() => {
                  queryClient.invalidateQueries({ queryKey: ordersKeys.all });
                })
              : Promise.resolve();
          await Promise.all([...orderPromises, ...existingPromises, linkPromise]);
        } catch (err) {
          console.error('INLINE ORDER CREATE ERROR', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to create some orders.';
          toast({
            title: 'Partial success',
            description: `Invoice created. Orders could not all be created: ${errorMessage}`,
            variant: 'destructive',
          });
        } finally {
          queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
          if (organizationId) {
            queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoiceId, organizationId) });
          }
        }
      })();
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Failed to create invoice.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    }
  };

  const canBuildInvoice = canBuildInvoices(useCanSeeMoney());
  useEffect(() => {
    if (open && !canBuildInvoice) onOpenChange(false);
  }, [open, canBuildInvoice, onOpenChange]);
  if (!canBuildInvoice) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0 [--background:40_50%_98%]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title={balanceInvoice ? 'Balance invoice' : 'Create New Invoice'}
              description={balanceInvoice ? 'Outstanding balance after payments already received.' : 'Fill in the details to create a new invoice with orders.'}
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Creating...' : 'Create'}
              primaryDisabled={isPending || !figuresReady}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
            <div className="space-y-4 p-4 pb-4 overflow-y-auto flex-1">
              {/* Person Information */}
              <div className="space-y-4">
                <h3 className="m-0 flex min-h-11 items-center text-xs font-semibold text-gardens-tx">Person Information</h3>
                <FormField
                  control={form.control}
                  name="person_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Person</FormLabel>
                      <Popover open={personOpen} onOpenChange={setPersonOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button type="button" variant="outline" role="combobox" aria-expanded={personOpen} className="w-full justify-between font-normal">
                              <span className="truncate">
                                {field.value
                                  ? (personOptions.find((person) => person.id === field.value)?.label ?? 'Selected person')
                                  : 'Select person (optional)'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search people…" />
                            <CommandList>
                              <CommandEmpty>No one matches.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => {
                                    field.onChange(null);
                                    form.setValue('customer_name', '');
                                    setPersonOpen(false);
                                  }}
                                >
                                  None
                                </CommandItem>
                                <CommandItem
                                  value="create new person"
                                  onSelect={() => {
                                    setPersonOpen(false);
                                    setQuickPersonOpen(true);
                                  }}
                                >
                                  + Create new person
                                </CommandItem>
                                {personOptions.filter((person) => person.group !== 'other').map((person) => (
                                  <CommandItem
                                    key={person.id}
                                    value={`${person.label} ${person.search}`}
                                    onSelect={() => {
                                      field.onChange(person.id);
                                      form.setValue('customer_name', person.label);
                                      setPersonOpen(false);
                                    }}
                                  >
                                    {person.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              {personOptions.some((person) => person.group === 'other') && (
                                <CommandGroup heading="Other contacts">
                                  {personOptions.filter((person) => person.group === 'other').map((person) => (
                                    <CommandItem
                                      key={person.id}
                                      value={`${person.label} ${person.search}`}
                                      className="text-gardens-txm"
                                      onSelect={() => {
                                        field.onChange(person.id);
                                        form.setValue('customer_name', person.label);
                                        setPersonOpen(false);
                                      }}
                                    >
                                      {person.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Orders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="m-0 flex min-h-11 items-center text-xs font-semibold text-gardens-tx">Orders</h3>
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
                
                {open && preloaded.length > 0 && seededKey !== preloadKey && (
                  <p className="text-sm text-muted-foreground p-4 border rounded">Loading the order so it can be edited…</p>
                )}

                {orders.length === 0 && preloaded.length === 0 && (
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
                <h3 className="m-0 flex min-h-11 items-center text-xs font-semibold text-gardens-tx">Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormItem>
                    <FormLabel>Amount (£) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceAmount == null ? '' : invoiceAmount.toFixed(2)}
                        readOnly
                        placeholder={invoiceAmount == null ? 'Calculating balance…' : undefined}
                        className="bg-muted"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {balanceInvoice
                        ? 'Outstanding balance (order total minus payments received).'
                        : 'Calculated from orders'}
                    </p>
                  </FormItem>
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
                  <div className="flex gap-2" data-testid="deposit-presets">
                    {([
                      { label: 'Deposit (50% + permit)', full: false },
                      { label: 'Pay in full', full: true },
                    ] as const).map(({ label, full }) => (
                      <Button
                        key={label}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={calculatedAmount <= 0}
                        title={full ? undefined : '50% of the memorial + 100% of the permit fee'}
                        onClick={() => {
                          const v = full
                            ? round2(calculatedAmount)
                            : round2(depositPoundsFromTotal(calculatedAmount, permitTotal));
                          form.setValue('intended_deposit', v);
                          setDepositPercentInput(depositPercentDisplay(v, calculatedAmount));
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
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
                <h3 className="m-0 flex min-h-11 items-center text-xs font-semibold text-gardens-tx">Important Dates</h3>
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
        <QuickCreatePersonDialog
          open={quickPersonOpen}
          onOpenChange={setQuickPersonOpen}
          onCreated={(person) => {
            setJustCreated(person);
            form.setValue('person_id', person.id);
            form.setValue('customer_name', `${person.first_name} ${person.last_name}`);
            setQuickPersonOpen(false);
          }}
        />
      </DrawerContent>
    </Drawer>
  );
};

export default CreateInvoiceDrawer;
