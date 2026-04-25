import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { GooglePlacesAutocompleteInput } from '@/shared/components/GooglePlacesAutocompleteInput';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateOrder, useCreateAdditionalOption, useSaveOrderPeopleMutation } from '../hooks/useOrders';
import { INSCRIPTION_FONT_OPTIONS } from '@/modules/orders';
import { useGeocodeOrderAddress } from '../hooks/useGeocodeOrderAddress';
import { orderFormSchema, type OrderFormData } from '../schemas/order.schema';
import { useToast } from '@/shared/hooks/use-toast';
import { toMoneyNumber } from '../utils/numberParsing';
import { useProductsList } from '@/modules/products/hooks/useProducts';
import { transformProductsFromDb, type UIProduct } from '@/modules/products/utils/productTransform';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { OrderPeoplePicker } from './OrderPeoplePicker';
import { usePermitForms } from '@/modules/permitForms/hooks/usePermitForms';
import { PermitFormPicker } from './PermitFormPicker';

interface CreateOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string | null; // Optional invoice ID for pre-filling invoice_id
}

export const CreateOrderDrawer: React.FC<CreateOrderDrawerProps> = ({
  open,
  onOpenChange,
  invoiceId,
}) => {
  const { mutate: createOrder, isPending } = useCreateOrder();
  const { mutate: createOption } = useCreateAdditionalOption();
  const { mutateAsync: saveOrderPeople } = useSaveOrderPeopleMutation();
  const geocodeMutation = useGeocodeOrderAddress();
  const { toast } = useToast();
  const { data: productsData } = useProductsList();
  const { data: customers } = useCustomersList();
  const { data: permitFormsData } = usePermitForms();
  const [dimensions, setDimensions] = useState<string>('');

  const products = useMemo(() => {
    if (!productsData) return [];
    return transformProductsFromDb(productsData);
  }, [productsData]);

  // Get product display name
  const getProductDisplayName = (product: UIProduct): string => {
    return product.name || `Product ${product.id.substring(0, 8)}`;
  };

  // Build notes with dimensions prefix
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

  // Handle product selection (only for New Memorial orders)
  const handleProductSelect = (productId: string) => {
    const currentOrderType = form.watch('order_type');
    if (currentOrderType !== 'New Memorial' || !products.length) {
      form.setValue('product_id', null);
      form.setValue('productPhotoUrl', null);
      return;
    }
    if (!productId) {
      form.setValue('product_id', null);
      form.setValue('value', null);
      form.setValue('productPhotoUrl', null);
      setDimensions('');
      return;
    }
    form.setValue('product_id', productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      form.setValue('value', product.price ?? null);
      form.setValue('productPhotoUrl', product.imageUrl ?? null);
    }
  };

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      order_people: [] as { person_id: string; is_primary: boolean }[],
      person_id: null,
      customer_name: '',
      order_type: undefined,
      sku: '',
      location: '',
      material: '',
      color: '',
      value: null,
      permit_cost: null,
      permit_form_id: null,
      renovation_service_description: null,
      renovation_service_cost: null,
      notes: '',
      // Keep all other fields for schema compatibility
      customer_email: '',
      customer_phone: '',
      stone_status: 'NA',
      permit_status: 'pending',
      proof_status: 'Not_Received',
      deposit_date: null,
      second_payment_date: null,
      due_date: null,
      installation_date: null,
      progress: 0,
      assigned_to: '',
      priority: 'medium',
      timeline_weeks: 12,
      product_id: null,
      dimensions: undefined,
      productPhotoUrl: null,
      additional_options: [],
      inscription_text: null,
      inscription_font: null,
      inscription_font_other: null,
      inscription_layout: null,
      inscription_additional: null,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'additional_options',
  });

  // Watch order_type for conditional rendering
  const orderType = form.watch('order_type');
  // Drive Font Other visibility without useState
  const watchedInscriptionFont = form.watch('inscription_font');
  const showFontOther = watchedInscriptionFont === 'Other';

  // Handle order_type change to clear incompatible state
  useEffect(() => {
    if (orderType === 'Renovation') {
      // Clear product selection when switching to Renovation
      form.setValue('product_id', null);
      setDimensions('');
      form.setValue('material', '');
      form.setValue('color', '');
      form.setValue('value', null);
      form.setValue('productPhotoUrl', null); // Clear photo URL for Renovation
    } else if (orderType === 'New Memorial') {
      // Clear renovation fields when switching back to New Memorial
      form.setValue('renovation_service_description', null);
      form.setValue('renovation_service_cost', null);
    }
  }, [orderType, form]);

  // Clear any draft state when the drawer has been closed
  useOnDrawerReset(() => {
    form.reset();
    setDimensions('');
  });

  const onSubmit = async (data: OrderFormData) => {
    const people = data.order_people || [];
    if (people.length === 0) return;

    // Build notes with dimensions prefix
    const notesValue = buildNotes(dimensions, data.notes || '');

    const primary = people.find((p) => p.is_primary) ?? people[0];
    const selectedCustomer = customers?.find((c) => c.id === primary.person_id);
    const personName = selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : null;

    // Build order payload - do not include dimensions (form-only; merged into notes)
    const orderData = {
      // Required fields
      customer_name: data.customer_name.trim(),
      location: data.location.trim() || null, // Convert empty string to null if optional
      sku: data.sku.trim() || null, // Convert empty string to null if optional
      order_type: data.order_type,

      product_id: data.order_type === 'Renovation' ? null : (data.product_id ?? null),
      
      // Person assignment (primary for backward compat)
      person_id: primary.person_id,
      person_name: personName,
      
      // Snapshot fields (editable)
      material: data.material?.trim() || null,
      color: data.color?.trim() || null,
      
      // Value field: For Renovation orders, value should be null (base value comes from renovation_service_cost)
      // For New Memorial orders, value comes from product price (can be null if no product selected)
      value: data.order_type === 'Renovation' ? null : (data.value ?? null),
      
      // DB constraint: permit_cost is NOT NULL DEFAULT 0, so we must send 0 (not null) when empty
      permit_cost: toMoneyNumber(data.permit_cost),

      permit_form_id: data.permit_form_id ?? null,
      
      // Product photo URL snapshot: Only for New Memorial orders, null for Renovation
      product_photo_url: data.order_type === 'Renovation' 
        ? null // Renovation orders don't have product photos
        : (data.productPhotoUrl ?? null), // Snapshot photo URL for New Memorial orders
      
      // Renovation service fields
      renovation_service_description: data.order_type === 'Renovation' 
        ? (data.renovation_service_description?.trim() || null)
        : null, // Explicitly null for New Memorial orders
      
      // DB constraint: renovation_service_cost is NOT NULL DEFAULT 0
      // For Renovation: use the provided cost (or 0 if empty)
      // For New Memorial: send 0 to match the default (NOT NULL field, cannot send null)
      renovation_service_cost: data.order_type === 'Renovation' 
        ? toMoneyNumber(data.renovation_service_cost) // Blank => 0 for Renovation
        : 0, // Send 0 for New Memorial (NOT NULL DEFAULT 0, cannot send null)
      
      notes: notesValue,
      inscription_text: data.inscription_text?.trim() || null,
      inscription_font: data.inscription_font?.trim() || null,
      inscription_font_other: data.inscription_font_other?.trim() || null,
      inscription_layout: data.inscription_layout?.trim() || null,
      inscription_additional: data.inscription_additional?.trim() || null,
      
      // Removed fields (set to defaults)
      customer_email: null,
      customer_phone: null,
      stone_status: 'NA',
      permit_status: 'pending',
      proof_status: 'Not_Received',
      deposit_date: null,
      second_payment_date: null,
      due_date: null,
      installation_date: null,
      progress: 0,
      assigned_to: null,
      priority: 'medium',
      timeline_weeks: 12,
      
      invoice_id: invoiceId || null,
    };

    createOrder(orderData, {
      onSuccess: async (createdOrder) => {
        await saveOrderPeople({ orderId: createdOrder.id, people });
        // After order is successfully created, trigger geocoding in the background
        const locationForGeocode = data.location?.trim();
        if (locationForGeocode && locationForGeocode.length >= 6) {
          geocodeMutation.mutate({
            orderId: createdOrder.id,
            location: locationForGeocode,
          });
        }

        // Create additional options if any
        const additionalOptions = data.additional_options || [];
        if (additionalOptions.length > 0) {
          let successCount = 0;
          let errorCount = 0;
          const totalOptions = additionalOptions.filter(opt => opt.name?.trim()).length;
          
          additionalOptions.forEach((option) => {
            if (option.name?.trim()) {
              createOption({
                order_id: createdOrder.id,
                name: option.name.trim(),
                cost: toMoneyNumber(option.cost),
                description: option.description?.trim() || null,
              }, {
                onSuccess: () => {
                  successCount++;
                  if (successCount + errorCount === totalOptions) {
                    if (errorCount > 0) {
                      toast({
                        title: 'Order created with warnings',
                        description: `Order created. ${successCount} option(s) added, ${errorCount} failed.`,
                        variant: 'destructive',
                      });
                    } else {
                      toast({
                        title: 'Order created',
                        description: 'Order and additional options have been created successfully.',
                      });
                    }
                    form.reset();
                    setSelectedProductId('');
                    setDimensions('');
                    onOpenChange(false);
                  }
                },
                onError: (error) => {
                  errorCount++;
                  const errorMessage = error instanceof Error ? error.message : 'Failed to create additional option';
                  toast({
                    title: 'Warning',
                    description: `Failed to add option "${option.name}": ${errorMessage}`,
                    variant: 'destructive',
                  });
                  if (successCount + errorCount === totalOptions) {
                    toast({
                      title: 'Order created with warnings',
                      description: `Order created. ${successCount} option(s) added, ${errorCount} failed.`,
                      variant: 'destructive',
                    });
                    form.reset();
                    setSelectedProductId('');
                    setDimensions('');
                    onOpenChange(false);
                  }
                },
              });
            }
          });
          
          // If no valid options, just show success
          if (totalOptions === 0) {
            toast({
              title: 'Order created',
              description: 'Order has been created successfully.',
            });
            form.reset();
            setSelectedProductId('');
            setDimensions('');
            onOpenChange(false);
          }
        } else {
          toast({
            title: 'Order created',
            description: 'Order has been created successfully.',
          });
          form.reset();
          setSelectedProductId('');
          setDimensions('');
          onOpenChange(false);
        }
      },
      onError: (error: unknown) => {
        // Improved error reporting to diagnose database errors
        console.error('[CreateOrderDrawer] Order creation error:', error);
        console.error('[CreateOrderDrawer] Order data payload:', JSON.stringify(orderData, null, 2));
        
        let errorMessage = 'Failed to create order.';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          // Check if it's a Supabase error with more details
          if ('code' in error || 'details' in error || 'hint' in error) {
            const supabaseError = error as { code?: string; details?: string; hint?: string };
            const parts = [error.message];
            if (supabaseError.details) parts.push(`Details: ${supabaseError.details}`);
            if (supabaseError.hint) parts.push(`Hint: ${supabaseError.hint}`);
            if (supabaseError.code) parts.push(`Code: ${supabaseError.code}`);
            errorMessage = parts.join('\n');
          }
        } else if (error && typeof error === 'object') {
          // Try to stringify the error object
          try {
            errorMessage = JSON.stringify(error, null, 2);
          } catch (e) {
            errorMessage = String(error);
          }
        } else {
          errorMessage = String(error);
        }
        
        toast({
          title: 'Error creating order',
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Create New Order"
              description="Fill in the details to create a new memorial order."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Creating...' : 'Create'}
              primaryDisabled={isPending || (form.watch('order_people')?.length ?? 0) === 0}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
            <div className="space-y-4 p-4 pb-4 overflow-y-auto flex-1">
              {/* Order Type */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Order Type</h3>
                <FormField
                  control={form.control}
                  name="order_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? undefined}
                        defaultValue={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select order type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="New Memorial">New Memorial</SelectItem>
                          <SelectItem value="Renovation">Renovation</SelectItem>
                          <SelectItem value="Kerb Set">Kerb Set</SelectItem>
                          <SelectItem value="Additional Inscription">Additional Inscription</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Person Assignment */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">People *</h3>
                <FormField
                  control={form.control}
                  name="order_people"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select at least one person</FormLabel>
                      <FormControl>
                        <OrderPeoplePicker
                          value={field.value}
                          onChange={field.onChange}
                          customers={customers ?? []}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Deceased & Location */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Deceased & Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deceased Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <GooglePlacesAutocompleteInput
                            value={field.value || ''}
                            onChange={(value) => field.onChange(value)}
                            placeholder="Enter installation address"
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                        {/* Geocode status (create flow) */}
                        {geocodeMutation.isPending && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Locating...
                          </p>
                        )}
                        {geocodeMutation.isSuccess && geocodeMutation.data?.ok && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Pinned
                          </p>
                        )}
                        {geocodeMutation.isSuccess && geocodeMutation.data && !geocodeMutation.data.ok && (
                          <p className="text-xs text-red-600 mt-1">
                            Couldn't locate address
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grave Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Plot 123, Section A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Renovation Service Fields - Only shown for Renovation orders */}
              {orderType === 'Renovation' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Service Details</h3>
                  <FormField
                    control={form.control}
                    name="renovation_service_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service / Service Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Headstone cleaning and relettering" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="renovation_service_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Cost (GBP)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Product Selection - Only shown for New Memorial orders */}
              {orderType === 'New Memorial' && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Product Selection</h3>
                    <div>
                      <Select
                        value={form.watch('product_id') ?? ''}
                        onValueChange={handleProductSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">No products available</div>
                          ) : (
                            products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {getProductDisplayName(product)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Product Snapshot Fields */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Product Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="material"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stone Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Black Granite" {...field} />
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
                        <FormLabel>Stone Color</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Jet Black" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Dimensions</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 24x18x4"
                        value={dimensions}
                        onChange={(e) => setDimensions(e.target.value)}
                      />
                    </FormControl>
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    </div>
                  </div>
                </>
              )}

              {/* Permit Cost - Available for both order types */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="permit_form_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permit form</FormLabel>
                      <FormControl>
                        <PermitFormPicker
                          value={field.value}
                          onChange={field.onChange}
                          permitForms={permitFormsData ?? []}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="permit_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permit Cost (GBP)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Additional Options</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ name: '', cost: null, description: null })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
                {fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">No additional options added.</p>
                )}
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Option {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`additional_options.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Engraving, Picture" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`additional_options.${index}.cost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost (GBP)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`additional_options.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Optional description..."
                              rows={2}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

              {/* Inscription */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Inscription</h3>
                <FormField
                  control={form.control}
                  name="inscription_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscription Text</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Name, dates, epitaph…"
                          rows={4}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inscription_additional"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Lines</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Verse, symbols, additional text…"
                          rows={2}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inscription_font"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Font Style</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val || null);
                          if (val !== 'Other') form.setValue('inscription_font_other', null);
                        }}
                        value={field.value ?? ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select font style (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INSCRIPTION_FONT_OPTIONS.map((font) => (
                            <SelectItem key={font} value={font}>{font}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {showFontOther && (
                  <FormField
                    control={form.control}
                    name="inscription_font_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Font (specify)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Specify font name…"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="inscription_layout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Layout / Position</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Centred, top third of stone"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Notes</h3>
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
            </div>
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

export default CreateOrderDrawer;

