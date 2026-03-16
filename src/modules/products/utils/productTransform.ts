import type { Product } from '../hooks/useProducts';

export interface UIProduct {
  id: string;
  name: string;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number | null;
}

export function transformProductsFromDb(products: Product[]): UIProduct[] {
  return products.map((p) => ({
    id: p.id,
    name: (p.name ?? '').trim() || `Product ${p.id.substring(0, 8)}`,
    price: p.base_price ?? null,
    imageUrl: p.image_url ?? null,
    isActive: p.is_active ?? true,
    isFeatured: p.is_featured ?? false,
    displayOrder: p.display_order ?? null,
  }));
}

