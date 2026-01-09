import React, { useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderFormSchema, type OrderFormData } from '@/modules/orders/schemas/order.schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { useMemorialsList } from '@/modules/memorials/hooks/useMemorials';
import { transformMemorialsFromDb } from '@/modules/memorials/utils/memorialTransform';
import type { UIMemorial } from '@/modules/memorials/utils/memorialTransform';
import { X, Plus, Trash2 } from 'lucide-react';
import { toMoneyNumber } from '@/modules/orders/utils/numberParsing';

interface OrderFormInlineProps {
  order: { id: string; data: Partial<OrderFormData> };
  index: number;
  onUpdate: (data: Partial<OrderFormData>) => void;
  onRemove: () => void;
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
  dimensions: string;
  onDimensionsChange: (value: string) => void;
}

export const OrderFormInline: React.FC<OrderFormInlineProps> = ({
  order,
  index,
  onUpdate,
  onRemove,
  selectedProductId,
  onProductSelect,
  dimensions,
  onDimensionsChange,
}) => {
  const { data: memorialsData } = useMemorialsList();
  
  const products = useMemo(() => {
    if (!memorialsData) return [];
    return transformMemorialsFromDb(memorialsData);
  }, [memorialsData]);

  const getProductDisplayName = (product: UIMemorial): string => {
    return product.name || product.memorialType || `Product ${product.id.substring(0, 8)}`;
  };

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customer_name: order.data.customer_name || '',
      order_type: order.data.order_type || 'New Memorial', // Default to 'New Memorial' if undefined
      sku: order.data.sku || '',
      location: order.data.location || '',
      latitude: order.data.latitude ?? null,
      longitude: order.data.longitude ?? null,
      material: order.data.material || '',
      color: order.data.color || '',
      value: order.data.value ?? null,
      permit_cost: order.data.permit_cost ?? null,
      renovation_service_description: order.data.renovation_service_description ?? null,
      renovation_service_cost: order.data.renovation_service_cost ?? null,
      notes: order.data.notes || '',
      productPhotoUrl: order.data.productPhotoUrl ?? null,
      // Required fields with defaults
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
      additional_options: order.data.additional_options || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'additional_options',
  });

  // Watch order_type for conditional rendering (with defensive default)
  const orderType = form.watch('order_type') || 'New Memorial';

  // Handle order_type change to clear incompatible state
  useEffect(() => {
    if (orderType === 'Renovation') {
      // Clear product selection when switching to Renovation
      // Use prop callbacks to update parent state (no local state setters)
      onProductSelect('');
      onDimensionsChange('');
      // Clear form fields (product-specific for New Memorial)
      form.setValue('material', '');
      form.setValue('color', '');
      form.setValue('value', null);
      form.setValue('productPhotoUrl', null); // Clear photo URL for Renovation
      // Ensure renovation fields are set (will be populated by user)
    } else if (orderType === 'New Memorial') {
      // Clear renovation fields when switching back to New Memorial
      form.setValue('renovation_service_description', null);
      form.setValue('renovation_service_cost', null);
      // Ensure value is set (will be populated by product selection or manual entry)
      // If value is null/undefined, set to 0 to prevent DB constraint issues
      if (form.getValues('value') === null || form.getValues('value') === undefined) {
        form.setValue('value', 0);
      }
    }
  }, [orderType, form, onProductSelect, onDimensionsChange]);

  // Update parent when form changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      onUpdate(value as Partial<OrderFormData>);
    });
    return () => subscription.unsubscribe();
  }, [form, onUpdate]);

  // Handle product selection (only for New Memorial)
  const handleProductSelect = (productId: string) => {
    // Defensive guard: only process if orderType is New Memorial and products are loaded
    if (orderType !== 'New Memorial' || !products || products.length === 0) {
      onProductSelect(productId); // Still update parent state
      form.setValue('productPhotoUrl', null); // Clear photo URL if not New Memorial
      return;
    }
    
    // If product is cleared (empty string), clear product fields including photo URL
    if (!productId || productId === '') {
      onProductSelect('');
      form.setValue('material', '');
      form.setValue('color', '');
      form.setValue('value', null);
      form.setValue('productPhotoUrl', null); // Clear photo URL when product is cleared
      onDimensionsChange('');
      return;
    }
    
    onProductSelect(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue('material', product.material || '');
      form.setValue('color', product.color || '');
      form.setValue('value', product.price ?? null);
      form.setValue('productPhotoUrl', product.photoUrl ?? null); // Snapshot photo URL
      onDimensionsChange(product.dimensions || '');
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Order {index + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Form {...form}>
        {/* Order Type */}
        <FormField
          control={form.control}
          name="order_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Type *</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? undefined}
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

        {/* Deceased & Location */}
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
                  <Input placeholder="e.g., Plot 123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Coordinates */}
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
                    {!products || products.length === 0 ? (
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

            {/* Product Details */}
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
                      onChange={(e) => onDimensionsChange(e.target.value)}
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

        {/* Permit Cost - Visible for both order types */}
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

        {/* Additional Options - Visible for both order types */}
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
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </div>
  );
};

