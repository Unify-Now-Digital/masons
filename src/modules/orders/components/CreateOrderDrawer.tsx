import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Plus, Trash2 } from 'lucide-react';
import { useCreateOrder, useCreateAdditionalOption } from '../hooks/useOrders';
import { useGeocodeOrderAddress } from '../hooks/useGeocodeOrderAddress';
import { orderFormSchema, type OrderFormData } from '../schemas/order.schema';
import { useToast } from '@/shared/hooks/use-toast';
import { toMoneyNumber } from '../utils/numberParsing';
import { useMemorialsList } from '@/modules/memorials/hooks/useMemorials';
import { transformMemorialsFromDb } from '@/modules/memorials/utils/memorialTransform';
import type { UIMemorial } from '@/modules/memorials/utils/memorialTransform';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';

// Sentinel value for "no person selected" in Radix Select (cannot use empty string)
const NO_PERSON_SENTINEL = '__none__';

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
  const geocodeMutation = useGeocodeOrderAddress();
  const { toast } = useToast();
  const { data: memorialsData } = useMemorialsList();
  const { data: customers } = useCustomersList();
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [dimensions, setDimensions] = useState<string>('');

  const products = useMemo(() => {
    if (!memorialsData) return [];
    return transformMemorialsFromDb(memorialsData);
  }, [memorialsData]);

  // Get product display name
  const getProductDisplayName = (product: UIMemorial): string => {
    return product.name || product.memorialType || `Product ${product.id.substring(0, 8)}`;
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

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    // If product is cleared (empty string), clear product fields including photo URL
    if (!productId || productId === '') {
      form.setValue('material', '');
      form.setValue('color', '');
      form.setValue('value', null);
      form.setValue('productPhotoUrl', null); // Clear photo URL when product is cleared
      setDimensions('');
      return;
    }
    // Product selected - snapshot product values including photo URL
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue('material', product.material || '');
      form.setValue('color', product.color || '');
      form.setValue('value', product.price ?? null);
      form.setValue('productPhotoUrl', product.photoUrl ?? null); // Snapshot photo URL
      setDimensions(product.dimensions || '');
    }
  };

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      person_id: null,
      customer_name: '',
      order_type: undefined,
      sku: '',
      location: '',
      latitude: null,
      longitude: null,
      material: '',
      color: '',
      value: null,
      permit_cost: null,
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
      productId: undefined,
      dimensions: undefined,
      productPhotoUrl: null,
      additional_options: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'additional_options',
  });

  // Watch order_type for conditional rendering
  const orderType = form.watch('order_type');

  // Handle order_type change to clear incompatible state
  useEffect(() => {
    if (orderType === 'Renovation') {
      // Clear product selection when switching to Renovation
      setSelectedProductId('');
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

  const onSubmit = (data: OrderFormData) => {
    // Build notes with dimensions prefix
    const notesValue = buildNotes(dimensions, data.notes || '');

    // Get person name if person_id is selected
    const selectedCustomer = data.person_id ? customers?.find(c => c.id === data.person_id) : null;
    const personName = selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : null;

    // Build order payload - DO NOT include productId or dimensions (form-only fields)
    const orderData = {
      // Required fields
      customer_name: data.customer_name.trim(),
      location: data.location.trim() || null, // Convert empty string to null if optional
      sku: data.sku.trim() || null, // Convert empty string to null if optional
      order_type: data.order_type,
      
      // Person assignment (optional)
      person_id: data.person_id || null,
      person_name: personName,
      
      // Snapshot fields (editable)
      material: data.material?.trim() || null,
      color: data.color?.trim() || null,
      
      // Value field: For Renovation orders, value should be null (base value comes from renovation_service_cost)
      // For New Memorial orders, value comes from product price (can be null if no product selected)
      value: data.order_type === 'Renovation' ? null : (data.value ?? null),
      
      // DB constraint: permit_cost is NOT NULL DEFAULT 0, so we must send 0 (not null) when empty
      permit_cost: toMoneyNumber(data.permit_cost),
      
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
      
      // Coordinates
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      
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
      onSuccess: (createdOrder) => {
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
      <DrawerContent className="max-h-[96vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Create New Order</DrawerTitle>
          <DrawerDescription>
            Fill in the details to create a new memorial order.
          </DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Person Assignment */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Person Assignment</h3>
                <FormField
                  control={form.control}
                  name="person_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Person (Optional)</FormLabel>
                      <Select
                        value={field.value || NO_PERSON_SENTINEL}
                        onValueChange={(value) => {
                          if (value === NO_PERSON_SENTINEL) {
                            field.onChange(null);
                            form.setValue('person_name', null);
                          } else {
                            field.onChange(value);
                            // Set person_name snapshot
                            const customer = customers?.find(c => c.id === value);
                            if (customer) {
                              form.setValue('person_name', `${customer.first_name} ${customer.last_name}`);
                            }
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select person (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_PERSON_SENTINEL}>None</SelectItem>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.first_name} {customer.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          <Input placeholder="Oak Hill Cemetery" {...field} />
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

              {/* Coordinates */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Coordinates (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.00000001"
                            placeholder="e.g., 51.5074"
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
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longitude</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.00000001"
                            placeholder="e.g., -0.1278"
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
                        value={selectedProductId}
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

export default CreateOrderDrawer;

