import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import { Badge } from '@/shared/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { INSCRIPTION_FONT_OPTIONS } from '@/modules/orders';
import { 
  useUpdateOrder, 
  useOrderPeople,
  useSaveOrderPeople,
  useAdditionalOptionsByOrder,
  useCreateAdditionalOption,
  useUpdateAdditionalOption,
  useDeleteAdditionalOption,
} from '../hooks/useOrders';
import { orderFormSchema, type OrderFormData } from '../schemas/order.schema';
import { useToast } from '@/shared/hooks/use-toast';
import { toMoneyNumber } from '../utils/numberParsing';
import type { Order, OrderAdditionalOption } from '../types/orders.types';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useProductsList } from '@/modules/products/hooks/useProducts';
import { transformProductsFromDb, type UIProduct } from '@/modules/products/utils/productTransform';
import { useGeocodeOrderAddress } from '../hooks/useGeocodeOrderAddress';
import { OrderPeoplePicker } from './OrderPeoplePicker';
import { usePermitForms } from '@/modules/permitForms/hooks/usePermitForms';
import { PermitFormPicker } from './PermitFormPicker';

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
  const { mutate: createOption } = useCreateAdditionalOption();
  const { mutate: updateOption } = useUpdateAdditionalOption();
  const { mutate: deleteOption } = useDeleteAdditionalOption();
  const { toast } = useToast();
  const { data: customers } = useCustomersList();
  const { data: permitFormsData } = usePermitForms();
  const { data: orderPeople } = useOrderPeople(order.id);
  const { mutateAsync: saveOrderPeople } = useSaveOrderPeople(order.id);
  const { data: existingOptions } = useAdditionalOptionsByOrder(order.id);
  const { data: productsData } = useProductsList();
  const [dimensions, setDimensions] = useState<string>('');
  const geocodeMutation = useGeocodeOrderAddress();
  const initialLocationRef = useRef<string | null>(order.location || null);
  const [lastGeocodeResult, setLastGeocodeResult] = useState<{ ok: boolean; isManual: boolean } | null>(null);
  const [lastGeocodeLocation, setLastGeocodeLocation] = useState<string | null>(order.location || null);

  const findMatchingProduct = (o: Order, productList: UIProduct[]): string => {
    // Never throw; always return a safe productId string.
    try {
      if (o.product_id && productList.some((p) => p.id === o.product_id)) {
        return o.product_id;
      }
      // 1) Priority: match by stored product photo URL -> product.imageUrl
      if (o.product_photo_url) {
        const byImageUrl = productList.find(
          (p) => p.imageUrl && p.imageUrl === o.product_photo_url
        );
        if (byImageUrl?.id) return byImageUrl.id;
      }

      // 2) Fallback: match by order.value -> product.price (normalized, finite only)
      if (o.value != null) {
        const orderValue = Number(o.value);
        if (Number.isFinite(orderValue)) {
          const tolerance = 0.0001;
          const byPrice = productList.find((p) => {
            if (p.price == null) return false;
            const productPrice = Number(p.price);
            if (!Number.isFinite(productPrice)) return false;
            return Math.abs(productPrice - orderValue) <= tolerance;
          });
          if (byPrice?.id) return byPrice.id;
        }
      }
    } catch {
      // Intentionally ignore matching errors; drawer should still open safely.
    }

    return "";
  };

  const products = useMemo(() => {
    if (!productsData) return [];
    return transformProductsFromDb(productsData);
  }, [productsData]);

  // Get product display name
  const getProductDisplayName = (product: UIProduct): string => {
    return product.name || `Product ${product.id.substring(0, 8)}`;
  };

  // Extract dimensions from notes (if stored as "Dimensions: ...")
  const extractDimensionsFromNotes = (notes: string | null): string => {
    if (!notes) return '';
    const match = notes.match(/^Dimensions:\s*(.+?)(?:\n\n|$)/i);
    return match ? match[1].trim() : '';
  };

  // Matching by material/color/value relied on memorial-only fields; intentionally removed for products.

  // Handle product selection (only for New Memorial orders)
  const handleProductSelect = (productId: string) => {
    // Defensive guard: only process if orderType is New Memorial
    const currentOrderType = form.watch('order_type') || order.order_type;
    if (currentOrderType !== 'New Memorial' || !products || products.length === 0) {
      form.setValue('product_id', null);
      form.setValue('productPhotoUrl', null); // Clear photo URL if not New Memorial
      return;
    }

    // If product is cleared (empty string), clear product fields including photo URL
    if (!productId || productId === '') {
      form.setValue('product_id', null);
      form.setValue('value', null);
      form.setValue('productPhotoUrl', null); // Clear photo URL when product is cleared
      setDimensions('');
      return;
    }

    form.setValue('product_id', productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      form.setValue('value', product.price ?? null);
      form.setValue('productPhotoUrl', product.imageUrl ?? null); // Snapshot photo URL
    }
  };

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      order_people:
        order.person_id != null
          ? [{ person_id: order.person_id, is_primary: true }]
          : ([] as { person_id: string; is_primary: boolean }[]),
      person_id: order.person_id || null,
      customer_name: order.customer_name,
      customer_email: order.customer_email || '',
      customer_phone: order.customer_phone || '',
      order_type: order.order_type as 'New Memorial' | 'Renovation' | 'Kerb Set' | 'Additional Inscription',
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
      permit_cost: order.permit_cost,
      permit_form_id: order.permit_form_id ?? null,
      renovation_service_description: order.renovation_service_description,
      renovation_service_cost: order.renovation_service_cost,
      progress: order.progress,
      assigned_to: order.assigned_to || '',
      priority: order.priority,
      timeline_weeks: order.timeline_weeks,
      notes: order.notes || '',
      product_id: order.product_id ?? null,
      productPhotoUrl: order.product_photo_url ?? null,
      additional_options: [], // Will be populated by existingOptions effect after form initialization
      inscription_text: order.inscription_text || '',
      inscription_font: order.inscription_font || '',
      inscription_font_other: order.inscription_font_other || '',
      inscription_layout: order.inscription_layout || '',
      inscription_additional: order.inscription_additional || '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'additional_options',
  });

  // Track the last order ID to only reset when order actually changes
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  // Reset form when drawer opens and order ID changes (not on every order change)
  useEffect(() => {
    if (open && order && order.id !== lastOrderId) {
      // Extract dimensions from notes if present
      const extractedDimensions = extractDimensionsFromNotes(order.notes);
      const notesWithoutDimensions = order.notes 
        ? order.notes.replace(/^Dimensions:\s*.+?(?:\n\n|$)/i, '').trim()
        : '';
      
      // Reset form WITHOUT additional_options (handled separately via existingOptions)
      // order_people: hydrate from orderPeople effect; fallback to order.person_id for legacy
      const initialOrderPeople =
        order.person_id != null
          ? [{ person_id: order.person_id, is_primary: true }]
          : ([] as { person_id: string; is_primary: boolean }[]);

      form.reset({
        order_people: initialOrderPeople,
        person_id: order.person_id || null,
        customer_name: order.customer_name,
        customer_email: order.customer_email || '',
        customer_phone: order.customer_phone || '',
        order_type: order.order_type as 'New Memorial' | 'Renovation' | 'Kerb Set' | 'Additional Inscription',
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
        permit_cost: order.permit_cost,
        permit_form_id: order.permit_form_id ?? null,
        renovation_service_description: order.renovation_service_description,
        renovation_service_cost: order.renovation_service_cost,
        progress: order.progress,
        assigned_to: order.assigned_to || '',
        priority: order.priority,
        timeline_weeks: order.timeline_weeks,
        notes: notesWithoutDimensions,
        product_id: order.product_id ?? null,
        productPhotoUrl: order.product_photo_url ?? null,
        additional_options: [], // Will be populated by existingOptions effect below
        inscription_text: order.inscription_text || '',
        inscription_font: order.inscription_font || '',
        inscription_font_other: order.inscription_font_other || '',
        inscription_layout: order.inscription_layout || '',
        inscription_additional: order.inscription_additional || '',
      });
      
      // Set dimensions
      setDimensions(extractedDimensions);
      
      // Update last order ID
      setLastOrderId(order.id);
      // Reset local geocode tracking for this order
      initialLocationRef.current = order.location || null;
      setLastGeocodeLocation(order.location || null);
      setLastGeocodeResult(null);
    }
  }, [open, order, lastOrderId, form]);

  // Hydrate order_people from useOrderPeople (overrides legacy fallback when data loads)
  useEffect(() => {
    if (open && order && orderPeople !== undefined) {
      if (orderPeople.length > 0) {
        form.setValue(
          'order_people',
          orderPeople.map((op) => ({
            person_id: op.person_id,
            is_primary: op.is_primary,
          }))
        );
      }
    }
  }, [open, order, orderPeople, form]);

  // Hydrate additional_options from useAdditionalOptionsByOrder hook (single source of truth)
  // Only when drawer is open and options data is available (not undefined, even if empty array)
  // This effect runs after the form reset effect, so options will hydrate correctly
  useEffect(() => {
    if (open && order && existingOptions !== undefined) {
      // Map existingOptions to fieldArray format
      const mappedOptions = existingOptions.map(opt => ({
        id: opt.id, // Track existing options by ID
        name: opt.name,
        cost: opt.cost,
        description: opt.description || '',
      }));
      
      // Use replace() from useFieldArray to properly hydrate the field array
      // This will set the options even if mappedOptions is empty array (no options for this order)
      replace(mappedOptions);
    }
  }, [open, order, existingOptions, replace]);

  // Match or hydrate product_id after products load (prefer stored orders.product_id)
  useEffect(() => {
    if (!order) return;
    if (order.order_type === 'Renovation') {
      form.setValue('product_id', null);
      setDimensions('');
      return;
    }
    if (order.order_type !== 'New Memorial' || products.length === 0) return;
    if (order.product_id) {
      form.setValue('product_id', order.product_id);
      return;
    }
    const matchedProductId = findMatchingProduct(order, products);
    if (matchedProductId) form.setValue('product_id', matchedProductId);
  }, [order, products, form]);

  // Drive Font Other visibility without useState
  const watchedInscriptionFont = form.watch('inscription_font');
  const showFontOther = watchedInscriptionFont === 'Other';
  const selectedProductId = form.watch('product_id');
  const propQuoteProductName = order.quote_product_name?.trim() || null;
  const quoteProductFallback =
    !selectedProductId &&
    order.quote_id &&
    propQuoteProductName &&
    propQuoteProductName.length > 0
      ? propQuoteProductName
      : null;

  // Watch order_type for conditional rendering
  const orderType = form.watch('order_type') || order.order_type;

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

  // Build notes with dimensions prefix (same as CreateOrderDrawer)
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

  const onSubmit = async (data: OrderFormData) => {
    const people = data.order_people || [];
    if (people.length === 0) return;

    // Build notes with dimensions prefix
    const notesValue = buildNotes(dimensions, data.notes || '');

    // Exclude additional_options, order_people, person_id, person_name, latitude, longitude (saveOrderPeople handles people; geocoding owns coords)
    const {
      additional_options,
      order_people: _orderPeople,
      person_id: _pid,
      person_name: _pname,
      latitude: _lat,
      longitude: _lng,
      dimensions: _dimensions,
      ...orderDataWithoutOptions
    } = data;
    const orderData = {
      ...orderDataWithoutOptions,
      product_id: data.product_id ?? null,
      customer_email: data.customer_email || null,
      customer_phone: data.customer_phone || null,
      sku: data.sku || null,
      material: data.material || null,
      color: data.color || null,
      location: data.location || null,
      assigned_to: data.assigned_to || null,
      notes: notesValue,
      deposit_date: data.deposit_date || null,
      second_payment_date: data.second_payment_date || null,
      due_date: data.due_date || null,
      installation_date: data.installation_date || null,
      // DB constraint: permit_cost is NOT NULL DEFAULT 0, so we must send 0 (not null) when empty
      permit_cost: toMoneyNumber(data.permit_cost),
      permit_form_id: data.permit_form_id ?? null,
      // Product photo URL snapshot: Only for New Memorial orders, null for Renovation
      product_photo_url: data.order_type === 'Renovation' 
        ? null // Renovation orders don't have product photos
        : (data.productPhotoUrl ?? null), // Snapshot photo URL for New Memorial orders
      // Value field: For Renovation orders, value should be null (base value comes from renovation_service_cost)
      // For New Memorial orders, value comes from product price
      value: data.order_type === 'Renovation' ? null : (data.value ?? null),
      // Renovation service fields (only used for Renovation order types)
      renovation_service_description: data.order_type === 'Renovation' 
        ? (data.renovation_service_description?.trim() || null)
        : null, // Explicitly null for New Memorial orders
      // DB constraint: renovation_service_cost is NOT NULL DEFAULT 0
      renovation_service_cost: data.order_type === 'Renovation' 
        ? toMoneyNumber(data.renovation_service_cost) // Blank => 0 for Renovation
        : 0, // Send 0 for New Memorial (NOT NULL DEFAULT 0, cannot send null)
      inscription_text: data.inscription_text?.trim() || null,
      inscription_font: data.inscription_font?.trim() || null,
      inscription_font_other: data.inscription_font_other?.trim() || null,
      inscription_layout: data.inscription_layout?.trim() || null,
      inscription_additional: data.inscription_additional?.trim() || null,
    };

    await saveOrderPeople(people);
    updateOrder(
      { id: order.id, updates: orderData },
      {
        onSuccess: () => {
          // After successful update, trigger geocoding only if location changed
          const newLocation = (data.location || '').trim();
          const previousLocation = (initialLocationRef.current || '').trim();
          const locationChanged = newLocation.length >= 6 && newLocation !== previousLocation;

          if (locationChanged) {
            // TEMP DEBUG: log automatic geocode trigger
            console.debug('[EditOrderDrawer] Auto geocode after save', {
              orderId: order.id,
              newLocation,
              previousLocation,
            });
            geocodeMutation.mutate(
              {
                orderId: order.id,
                location: newLocation,
              },
              {
                onSuccess: (result) => {
                  console.debug('[EditOrderDrawer] Auto geocode result', {
                    orderId: order.id,
                    location: newLocation,
                    result,
                  });
                  setLastGeocodeLocation(newLocation);
                  setLastGeocodeResult({ ok: !!result.ok, isManual: false });
                },
              }
            );
            // Update baseline so subsequent saves compare against latest value
            initialLocationRef.current = newLocation;
          }
          // Sync additional options
          const formOptions = data.additional_options || [];
          const existingOptionsMap = new Map((existingOptions || []).map(opt => [opt.id, opt]));
          const formOptionsMap = new Map(formOptions.filter(opt => opt.id).map(opt => [opt.id!, opt]));
          
          // Delete options that were removed
          existingOptions?.forEach(existingOpt => {
            if (!formOptionsMap.has(existingOpt.id)) {
              deleteOption(existingOpt.id, {
                onError: (error) => {
                  toast({
                    title: 'Warning',
                    description: `Failed to delete option "${existingOpt.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
                    variant: 'destructive',
                  });
                },
              });
            }
          });
          
          // Create new options and update existing ones
          let pendingOps = 0;
          let successCount = 0;
          let errorCount = 0;
          
          formOptions.forEach((formOpt) => {
            if (!formOpt.name?.trim()) return; // Skip empty options
            pendingOps++;
            
            if (formOpt.id) {
              // Update existing option
              const existingOpt = existingOptionsMap.get(formOpt.id);
              if (existingOpt && (
                existingOpt.name !== formOpt.name.trim() ||
                existingOpt.cost !== toMoneyNumber(formOpt.cost) ||
                (existingOpt.description || null) !== (formOpt.description?.trim() || null)
              )) {
                updateOption(
                  { id: formOpt.id, updates: {
                    name: formOpt.name.trim(),
                    cost: toMoneyNumber(formOpt.cost),
                    description: formOpt.description?.trim() || null,
                  }},
                  {
                    onSuccess: () => {
                      successCount++;
                      if (successCount + errorCount === pendingOps) {
                        if (errorCount > 0) {
                          toast({
                            title: 'Order updated with warnings',
                            description: `Order updated. ${successCount} option(s) synced, ${errorCount} failed.`,
                            variant: 'destructive',
                          });
                        } else {
                          toast({
                            title: 'Order updated',
                            description: 'Order and additional options have been updated successfully.',
                          });
                        }
                        onOpenChange(false);
                      }
                    },
                    onError: (error) => {
                      errorCount++;
                      toast({
                        title: 'Warning',
                        description: `Failed to update option "${formOpt.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
                        variant: 'destructive',
                      });
                      if (successCount + errorCount === pendingOps) {
                        toast({
                          title: 'Order updated with warnings',
                          description: `Order updated. ${successCount} option(s) synced, ${errorCount} failed.`,
                          variant: 'destructive',
                        });
                        onOpenChange(false);
                      }
                    },
                  }
                );
              } else {
                // No changes, count as success
                successCount++;
                if (successCount + errorCount === pendingOps) {
                  if (errorCount > 0) {
                    toast({
                      title: 'Order updated with warnings',
                      description: `Order updated. ${successCount} option(s) synced, ${errorCount} failed.`,
                      variant: 'destructive',
                    });
                  } else {
                    toast({
                      title: 'Order updated',
                      description: 'Order and additional options have been updated successfully.',
                    });
                  }
                  onOpenChange(false);
                }
              }
            } else {
              // Create new option
              createOption({
                order_id: order.id,
                name: formOpt.name.trim(),
                cost: toMoneyNumber(formOpt.cost),
                description: formOpt.description?.trim() || null,
              }, {
                onSuccess: () => {
                  successCount++;
                  if (successCount + errorCount === pendingOps) {
                    if (errorCount > 0) {
                      toast({
                        title: 'Order updated with warnings',
                        description: `Order updated. ${successCount} option(s) synced, ${errorCount} failed.`,
                        variant: 'destructive',
                      });
                    } else {
                      toast({
                        title: 'Order updated',
                        description: 'Order and additional options have been updated successfully.',
                      });
                    }
                    onOpenChange(false);
                  }
                },
                onError: (error) => {
                  errorCount++;
                  toast({
                    title: 'Warning',
                    description: `Failed to create option "${formOpt.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
                    variant: 'destructive',
                  });
                  if (successCount + errorCount === pendingOps) {
                    toast({
                      title: 'Order updated with warnings',
                      description: `Order updated. ${successCount} option(s) synced, ${errorCount} failed.`,
                      variant: 'destructive',
                    });
                    onOpenChange(false);
                  }
                },
              });
            }
          });
          
          // If no options to sync, just show success
          if (pendingOps === 0) {
            toast({
              title: 'Order updated',
              description: 'Order has been updated successfully.',
            });
            onOpenChange(false);
          }
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
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Edit Order"
              description="Update the details for this memorial order."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Updating...' : 'Save Changes'}
              primaryDisabled={isPending || (form.watch('order_people')?.length ?? 0) === 0}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
            <div className="space-y-4 p-4 pb-4 overflow-y-auto flex-1">
            {order.quote_id != null && String(order.quote_id).trim() !== '' && (
              <div className="flex items-center gap-2 rounded-md border border-gardens-bdr bg-gardens-page px-3 py-2">
                <Badge variant="secondary" className="text-xs font-normal shrink-0">
                  From Quote
                </Badge>
                <span className="text-xs text-muted-foreground">This order was created from a quote.</span>
              </div>
            )}
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

            {/* Person Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Deceased & Contact Information</h3>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      value={selectedProductId ?? ''}
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
                    {quoteProductFallback && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        (From quote: {quoteProductFallback})
                      </p>
                    )}
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
                          <SelectItem value="customer_completed">Person Completed</SelectItem>
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
                        <GooglePlacesAutocompleteInput
                          value={field.value || ''}
                          onChange={(value) => field.onChange(value)}
                          placeholder="Enter installation address"
                        />
                      </FormControl>
                      <FormMessage />
                      {/* Geocode status + manual recalc (edit flow) */}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {(() => {
                          const hasCoords =
                            typeof order.latitude === 'number' &&
                            typeof order.longitude === 'number' &&
                            Number.isFinite(order.latitude) &&
                            Number.isFinite(order.longitude) &&
                            order.latitude >= -90 &&
                            order.latitude <= 90 &&
                            order.longitude >= -180 &&
                            order.longitude <= 180;

                          if (geocodeMutation.isPending) {
                            return (
                              <span className="text-xs text-muted-foreground">Locating...</span>
                            );
                          }

                          if (lastGeocodeResult) {
                            if (lastGeocodeResult.ok || hasCoords) {
                              return (
                                <span className="text-xs text-gardens-grn-dk">✓ Pinned</span>
                              );
                            }

                            // Failure case
                            if (!lastGeocodeResult.ok) {
                              // Manual retry failure on same address without coords: keep neutral message
                              if (lastGeocodeResult.isManual && !hasCoords) {
                                return (
                                  <span className="text-xs text-muted-foreground">
                                    Location not yet pinned
                                  </span>
                                );
                              }

                              // Automatic failure or manual failure when coords exist
                              return (
                                <span className="text-xs text-gardens-red-dk">
                                  Couldn't locate address
                                </span>
                              );
                            }
                          }

                          // No recent mutation result: fall back to persisted status/coords
                          if (order.geocode_status === 'ok' || hasCoords) {
                            return (
                              <span className="text-xs text-gardens-grn-dk">✓ Pinned</span>
                            );
                          }

                          if (order.geocode_status === 'failed') {
                            return (
                              <span className="text-xs text-gardens-red-dk">
                                Couldn't locate address
                              </span>
                            );
                          }

                          return (
                            <span className="text-xs text-muted-foreground">
                              Location not yet pinned
                            </span>
                          );
                        })()}
                        {(() => {
                          const currentLocation = (form.watch('location') || '').trim();
                          const coordsMissing =
                            typeof order.latitude !== 'number' ||
                            typeof order.longitude !== 'number' ||
                            !Number.isFinite(order.latitude) ||
                            !Number.isFinite(order.longitude) ||
                            order.latitude < -90 ||
                            order.latitude > 90 ||
                            order.longitude < -180 ||
                            order.longitude > 180;
                          const persistedFailed = order.geocode_status === 'failed';
                          const shouldShowRecalc =
                            currentLocation.length >= 6 &&
                            (coordsMissing || persistedFailed);
                          if (!shouldShowRecalc) return null;
                          return (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                if (currentLocation) {
                                  // TEMP DEBUG: log manual recalc trigger
                                  console.debug('[EditOrderDrawer] Manual geocode recalc', {
                                    orderId: order.id,
                                    location: currentLocation,
                                  });
                                  geocodeMutation.mutate(
                                    {
                                      orderId: order.id,
                                      location: currentLocation,
                                    },
                                    {
                                      onSuccess: (result) => {
                                        console.debug('[EditOrderDrawer] Manual geocode result', {
                                          orderId: order.id,
                                          location: currentLocation,
                                          result,
                                        });
                                        setLastGeocodeLocation(currentLocation);
                                        setLastGeocodeResult({
                                          ok: !!result.ok,
                                          isManual: true,
                                        });
                                      },
                                    }
                                  );
                                }
                              }}
                              disabled={geocodeMutation.isPending}
                            >
                              Recalculate location
                            </Button>
                          );
                        })()}
                      </div>
                    </FormItem>
                  )}
                />
                {/* Value field - Only shown for New Memorial orders (Renovation uses renovation_service_cost) */}
                {orderType === 'New Memorial' && (
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
                )}
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
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

export default EditOrderDrawer;

