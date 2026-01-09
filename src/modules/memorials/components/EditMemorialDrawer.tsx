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
import { useUpdateMemorial, type Memorial } from '../hooks/useMemorials';
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
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Edit Product</DrawerTitle>
          <DrawerDescription>Update product information.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
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
                      value={field.value || ''}
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

            {/* Photo URL */}
            <FormField
              control={form.control}
              name="photoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photo URL (optional)</FormLabel>
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
                    // Fallback to placeholder on error
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

            <DrawerFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Updating...' : 'Update Memorial'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

