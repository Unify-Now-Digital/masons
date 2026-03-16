import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Product {
  id: string;
  name: string | null;
  base_price: number | null;
  image_url: string | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  display_order: number | null;
  created_at: string;
}

export const productsKeys = {
  all: ['products'] as const,
  detail: (id: string) => ['products', id] as const,
};

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      [
        'id',
        'name',
        'base_price',
        'image_url',
        'is_active',
        'is_featured',
        'display_order',
        'created_at',
      ].join(', '),
    )
    .order('display_order', { ascending: true, nullsLast: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Product[];
}

export function useProductsList() {
  return useQuery({
    queryKey: productsKeys.all,
    queryFn: fetchProducts,
  });
}

export type ProductInsert = {
  name: string;
  slug?: string | null;
  description?: string | null;
  short_description?: string | null;
  base_price?: number | null;
  image_url?: string | null;
  is_active?: boolean | null;
  is_featured?: boolean | null;
  display_order?: number | null;
};

export type ProductUpdate = Partial<ProductInsert>;

async function createProduct(input: ProductInsert): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      slug: input.slug ?? null,
      description: input.description ?? null,
      short_description: input.short_description ?? null,
      base_price: input.base_price ?? null,
      image_url: input.image_url ?? null,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      display_order: input.display_order ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

async function updateProduct(id: string, updates: ProductUpdate): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.slug !== undefined ? { slug: updates.slug } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.short_description !== undefined ? { short_description: updates.short_description } : {}),
      ...(updates.base_price !== undefined ? { base_price: updates.base_price } : {}),
      ...(updates.image_url !== undefined ? { image_url: updates.image_url } : {}),
      ...(updates.is_active !== undefined ? { is_active: updates.is_active } : {}),
      ...(updates.is_featured !== undefined ? { is_featured: updates.is_featured } : {}),
      ...(updates.display_order !== undefined ? { display_order: updates.display_order } : {}),
    })
    .eq('id', id);
  if (error) throw error;
}

async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsKeys.all });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProductUpdate }) => updateProduct(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsKeys.all });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsKeys.all });
    },
  });
}

