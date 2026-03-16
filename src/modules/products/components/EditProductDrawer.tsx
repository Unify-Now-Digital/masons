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
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import { Button } from '@/shared/components/ui/button';
import { AppDrawerLayout, DrawerGrid, DrawerSection } from '@/shared/components/drawer';
import { useToast } from '@/shared/hooks/use-toast';
import { productFormSchema, type ProductFormData } from '../schemas/product.schema';
import { useUpdateProduct } from '../hooks/useProducts';
import type { UIProduct } from '../utils/productTransform';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface EditProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: UIProduct;
}

export const EditProductDrawer: React.FC<EditProductDrawerProps> = ({ open, onOpenChange, product }) => {
  const { mutate: updateProduct, isPending } = useUpdateProduct();
  const { toast } = useToast();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product.name || '',
      slug: '',
      shortDescription: '',
      description: '',
      basePrice: product.price ?? 0,
      imageUrl: product.imageUrl ?? '',
      isActive: product.isActive ?? true,
      isFeatured: product.isFeatured ?? false,
      displayOrder: product.displayOrder ?? null,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: product.name || '',
      slug: '',
      shortDescription: '',
      description: '',
      basePrice: product.price ?? 0,
      imageUrl: product.imageUrl ?? '',
      isActive: product.isActive ?? true,
      isFeatured: product.isFeatured ?? false,
      displayOrder: product.displayOrder ?? null,
    });
  }, [open, form, product]);

  const onSubmit = (values: ProductFormData) => {
    const derivedSlug = (values.slug ?? '').trim() || slugify(values.name);

    updateProduct(
      {
        id: product.id,
        updates: {
          name: values.name.trim(),
          slug: derivedSlug || null,
          short_description: (values.shortDescription ?? '').trim() || null,
          description: (values.description ?? '').trim() || null,
          base_price: values.basePrice ?? null,
          image_url: (values.imageUrl ?? '').trim() || null,
          is_active: values.isActive,
          is_featured: values.isFeatured,
          display_order: values.displayOrder ?? null,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Product updated',
            description: 'Product has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : 'Failed to update product.';
          toast({
            title: 'Error updating product',
            description: msg,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Edit Product"
              description="Update product information."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Updating...' : 'Update'}
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
                      <FormItem className="col-span-2">
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
                    name="basePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Price (GBP) *</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            type="number"
                            step="0.01"
                            min="0"
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === '' ? 0 : Number(v));
                            }}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Display order</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            type="number"
                            step="1"
                            min="0"
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === '' ? null : Number(v));
                            }}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs font-medium">Image URL (optional)</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value || '')}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shortDescription"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs font-medium">Short description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Short description" className="min-h-[72px]" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs font-medium">Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Description" className="min-h-[96px]" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3 col-span-1">
                        <div className="space-y-0.5">
                          <FormLabel className="text-xs font-medium">Active</FormLabel>
                          <div className="text-[11px] text-muted-foreground">Show in product pickers</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3 col-span-1">
                        <div className="space-y-0.5">
                          <FormLabel className="text-xs font-medium">Featured</FormLabel>
                          <div className="text-[11px] text-muted-foreground">Highlight in catalog</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                </DrawerGrid>
              </DrawerSection>

              {form.watch('imageUrl') && (
                <div className="px-4 pb-4 space-y-2">
                  <img
                    src={form.watch('imageUrl') || ''}
                    alt="Product preview"
                    className="w-full max-w-md h-48 object-contain border rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('imageUrl', '')}>
                    Remove Image
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

