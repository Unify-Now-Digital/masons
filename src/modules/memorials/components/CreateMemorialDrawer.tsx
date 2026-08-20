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
import { Button } from '@/shared/components/ui/button';
import { useCreateMemorial } from '../hooks/useMemorials';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';
import { memorialFormSchema, type MemorialFormData } from '../schemas/memorial.schema';
import { toMemorialInsert } from '../utils/memorialTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

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
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0 [--background:40_50%_98%]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Create Product"
              description="Add a new product record."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Creating...' : 'Create'}
              primaryDisabled={isPending}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
              <DrawerSection>
                <DrawerGrid cols={2}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Name *</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="Enter product name" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Price (GBP) *</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
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
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs font-medium">Photo URL (optional)</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                </DrawerGrid>
              </DrawerSection>
              {form.watch('photoUrl') && (
                <div className="px-4 pb-4 space-y-2">
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
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

