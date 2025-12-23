import React, { useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { X } from 'lucide-react';

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
      order_type: order.data.order_type,
      sku: order.data.sku || '',
      location: order.data.location || '',
      latitude: order.data.latitude ?? null,
      longitude: order.data.longitude ?? null,
      material: order.data.material || '',
      color: order.data.color || '',
      value: order.data.value ?? null,
      notes: order.data.notes || '',
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
    },
  });

  // Update parent when form changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      onUpdate(value as Partial<OrderFormData>);
    });
    return () => subscription.unsubscribe();
  }, [form, onUpdate]);

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    onProductSelect(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue('material', product.material || '');
      form.setValue('color', product.color || '');
      form.setValue('value', product.price ?? null);
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

        {/* Product Selection */}
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

        {/* Product Details */}
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

