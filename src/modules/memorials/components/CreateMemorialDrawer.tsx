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
import { Button } from '@/shared/components/ui/button';
import { useCreateMemorial } from '../hooks/useMemorials';
import { memorialFormSchema, type MemorialFormData } from '../schemas/memorial.schema';
import { toMemorialInsert } from '../utils/memorialTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { HeadstoneTypePicker } from './HeadstoneTypePicker';
import type { HeadstoneType } from '../constants/headstoneTypes';

interface CreateMemorialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateMemorialDrawer: React.FC<CreateMemorialDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createMemorial, isPending } = useCreateMemorial();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  // Get first available order ID for required FK constraint (hidden field)
  const defaultOrderId = ordersData && ordersData.length > 0 ? ordersData[0].id : undefined;

  const form = useForm<MemorialFormData>({
    resolver: zodResolver(memorialFormSchema),
    defaultValues: {
      name: '',
      price: 0,
      photoUrl: null,
      // Hidden fields with safe defaults (required by DB but not shown in UI)
      orderId: defaultOrderId,
      jobId: null,
      deceasedName: '',
      dateOfBirth: null,
      dateOfDeath: null,
      cemeteryName: '',
      cemeterySection: '',
      cemeteryPlot: '',
      memorialType: '',
      material: '',
      color: '',
      dimensions: '',
      inscriptionText: '',
      inscriptionLanguage: '',
      installationDate: null,
      status: 'planned',
      condition: '',
      notes: '',
    },
  });

  // Reset form when drawer opens and update defaultOrderId if orders load
  useEffect(() => {
    const currentDefaultOrderId = ordersData && ordersData.length > 0 ? ordersData[0].id : undefined;
    if (open) {
      form.reset({
        name: '',
        price: 0,
        photoUrl: null,
        // Hidden fields with safe defaults
        orderId: currentDefaultOrderId,
        jobId: null,
        deceasedName: '',
        dateOfBirth: null,
        dateOfDeath: null,
        cemeteryName: '',
        cemeterySection: '',
        cemeteryPlot: '',
        memorialType: '',
        material: '',
        color: '',
        dimensions: '',
        inscriptionText: '',
        inscriptionLanguage: '',
        installationDate: null,
        status: 'planned',
        condition: '',
        notes: '',
      });
    }
  }, [open, form, ordersData]);

  const handleHeadstoneTypeSelect = (type: HeadstoneType) => {
    form.setValue('photoUrl', type.imageUrl);
    if (!form.getValues('name')) {
      form.setValue('name', type.label);
    }
  };

  const onSubmit = (values: MemorialFormData) => {
    // Ensure orderId is set (use first available order if not set)
    const orderId = values.orderId || (ordersData && ordersData.length > 0 ? ordersData[0].id : undefined);
    if (!orderId) {
      toast({
        title: 'Error creating product',
        description: 'Cannot create product: At least one order must exist in the system.',
        variant: 'destructive',
      });
      return;
    }

    const payload = toMemorialInsert({ ...values, orderId });
    createMemorial(payload, {
      onSuccess: () => {
        toast({
          title: 'Product created',
          description: 'Product has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to create product.';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          title: 'Error creating product',
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
          <DrawerTitle>Create Product</DrawerTitle>
          <DrawerDescription>Add a new product record.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 px-4 pb-4 overflow-y-auto flex-1">
            {/* Headstone Type Picker */}
            <FormField
              control={form.control}
              name="photoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headstone Style</FormLabel>
                  <FormControl>
                    <HeadstoneTypePicker
                      value={field.value || null}
                      onChange={handleHeadstoneTypeSelect}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter product name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (GBP) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value ? parseFloat(value) : 0);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Photo URL (manual override) */}
            <FormField
              control={form.control}
              name="photoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photo URL (optional override)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Photo Preview */}
            {form.watch('photoUrl') && (
              <div className="space-y-2">
                <img
                  src={form.watch('photoUrl') || ''}
                  alt="Product preview"
                  className="w-full max-w-md h-48 object-contain border rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => form.setValue('photoUrl', null)}
                >
                  Remove Photo
                </Button>
              </div>
            )}
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
