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
import { useUpdateMemorial, type Memorial } from '../hooks/useMemorials';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';
import { memorialFormSchema, type MemorialFormData } from '../schemas/memorial.schema';
import { toMemorialUpdate } from '../utils/memorialTransform';
import { useToast } from '@/shared/hooks/use-toast';

interface EditMemorialDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memorial: Memorial;
}

export const EditMemorialDrawer: React.FC<EditMemorialDrawerProps> = ({
  open,
  onOpenChange,
  memorial,
}) => {
  const { mutate: updateMemorial, isPending } = useUpdateMemorial();
  const { toast } = useToast();

  const form = useForm<MemorialFormData>({
    resolver: zodResolver(memorialFormSchema),
    defaultValues: {
      name: memorial.name || '',
      price: memorial.price ?? 0,
      photoUrl: memorial.photo_url || null,
      // Hidden fields (preserved from existing memorial)
      orderId: memorial.order_id,
      jobId: memorial.job_id || null,
      deceasedName: memorial.deceased_name,
      dateOfBirth: memorial.date_of_birth || null,
      dateOfDeath: memorial.date_of_death || null,
      cemeteryName: memorial.cemetery_name,
      cemeterySection: memorial.cemetery_section || '',
      cemeteryPlot: memorial.cemetery_plot || '',
      memorialType: memorial.memorial_type,
      material: memorial.material || '',
      color: memorial.color || '',
      dimensions: memorial.dimensions || '',
      inscriptionText: memorial.inscription_text || '',
      inscriptionLanguage: memorial.inscription_language || '',
      installationDate: memorial.installation_date || null,
      status: memorial.status,
      condition: memorial.condition || '',
      notes: memorial.notes || '',
    },
  });

  // Reset form when memorial changes
  useEffect(() => {
    if (memorial && open) {
      form.reset({
        name: memorial.name || '',
        price: memorial.price ?? 0,
        photoUrl: memorial.photo_url || null,
        // Hidden fields (preserved from existing memorial)
        orderId: memorial.order_id,
        jobId: memorial.job_id || null,
        deceasedName: memorial.deceased_name,
        dateOfBirth: memorial.date_of_birth || null,
        dateOfDeath: memorial.date_of_death || null,
        cemeteryName: memorial.cemetery_name,
        cemeterySection: memorial.cemetery_section || '',
        cemeteryPlot: memorial.cemetery_plot || '',
        memorialType: memorial.memorial_type,
        material: memorial.material || '',
        color: memorial.color || '',
        dimensions: memorial.dimensions || '',
        inscriptionText: memorial.inscription_text || '',
        inscriptionLanguage: memorial.inscription_language || '',
        installationDate: memorial.installation_date || null,
        status: memorial.status,
        condition: memorial.condition || '',
        notes: memorial.notes || '',
      });
    }
  }, [memorial, open, form]);

  const onSubmit = (values: MemorialFormData) => {
    const payload = toMemorialUpdate(values);
    updateMemorial(
      { id: memorial.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Product updated',
            description: 'Product has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          let errorMessage = 'Failed to update product.';
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          toast({
            title: 'Error updating product',
            description: errorMessage,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0 [--background:40_50%_98%]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Edit Product"
              description="Update product information."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Updating...' : 'Update Memorial'}
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
                          <Input
                            className="h-9"
                            placeholder="Enter product name"
                            {...field}
                            value={field.value || ''}
                          />
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

